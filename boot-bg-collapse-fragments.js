/**
 * Boot 背景: Voronoi 非矩形断片を create 時に焼き込み配置し、1 枚の板に見せる。
 * collapse 開始後のみ割れ・回転・落下。Canvas clip のみ（GeometryMask 不使用）。
 * 演出終了は Home 側 destroyBootBgPanelForHome で破棄（テクスチャ remove 含む）。
 */

import {
  getPlayFormationPresentationTuning,
  getPlayFormationBootCollapseHandoffMul,
  logPlayFormationDebugParamsOnce,
  playFormationDebugSurfaceEnabled,
  logPerfPlayFormSample,
} from './home-url-debug.js';
import {
  computePlayPanelLayoutForShardFormation,
  HOME_PLAY_NEUTRAL_START_FRAME,
} from './home-play-ui.js';
import {
  computePlayRepairButtonRect,
  destroyPlayRepairButton,
  syncPlayRepairButton,
} from './home-play-repair.js';
import { getHomeLayout } from './home-layout.js';
import { getHomeUrlBgDisplayOverrides } from './home-bg-panels.js';

/** Boot collapse 開始と同一時刻でセットし、Home の registry 削除後も残す */
export const REG_BOOT_BG_FRAG_EPOCH_MS = 'bootBgFragEpochMs';

/** collapse 継続時間 ms（PLAY 形成 norm と同期。index が registry に書き込む） */
export const REG_BOOT_COLLAPSE_DUR_MS = 'bootCollapseDurMs';

/** Home の PLAY/SUB 背景パネル（クロップ）を不透明にする wall-clock 閾値（overlap rebuild と同期） */
export const BOOT_BG_HOME_PANEL_REVEAL_MS = 995;

/** Boot 崩壊: 亀裂立ち上げ（index の fault 帯 ramp と揃える） */
export const BOOT_BG_COLLAPSE_CRACK_MS = 80;
/** 隙間拡大終了 → 破片落下開始 */
export const BOOT_BG_COLLAPSE_GAP_END_MS = 220;

const CRACK_MS = BOOT_BG_COLLAPSE_CRACK_MS;
const GAP_END_MS = BOOT_BG_COLLAPSE_GAP_END_MS;
const BASE_SHARD_ALPHA = 1;
/** fault band 内 shard alpha 乗算（?debug=1&noShardDim=0 のときのみ使用） */
const BAND_ALPHA_MULT = 0.93;

function readCollapseShardTuning() {
  const t = typeof window !== 'undefined' ? window.BOOT_COLLAPSE_SHARD : null;
  return {
    noFade: !t || t.noShardFade !== false,
    noDim: !t || t.noShardDim !== false,
    solidAlpha: !t || t.solidShardAlpha !== false,
  };
}

/** 既定 facet 強度（URL 非指定時）。text id=yjlwm8: 0.28〜0.4 程度 */
const DEFAULT_SHARD_FACET_STRENGTH = 0.34;

/** area / maxArea から facet の面積係数（大型のみ面感、小型は silhouette / edge 優先） */
function facetAreaScaleFromRatio(areaRatio) {
  const u = Phaser.Math.Clamp(areaRatio, 0, 1);
  if (u < 0.14) {
    return Phaser.Math.Linear(0, 0.14, u / 0.14);
  }
  if (u < 0.42) {
    return Phaser.Math.Linear(0.14, 0.45, (u - 0.14) / (0.42 - 0.14));
  }
  return Phaser.Math.Linear(0.45, 1, (u - 0.42) / (1 - 0.42));
}

/** index.html の BOOT_COLLAPSE_SHARD 由来（?debug=1 時 shardLighting 等） */
function readShardVisualFlags() {
  const t = typeof window !== 'undefined' ? window.BOOT_COLLAPSE_SHARD : null;
  const fs =
    t && typeof t.shardFacetStrength === 'number' && Number.isFinite(t.shardFacetStrength)
      ? Phaser.Math.Clamp(t.shardFacetStrength, 0, 1)
      : DEFAULT_SHARD_FACET_STRENGTH;
  if (!t) {
    return {
      shardLighting: true,
      shardEdgeShade: true,
      shardDepthFade: true,
      shardFacetShade: true,
      shardFacetStrength: fs,
    };
  }
  return {
    shardLighting: t.shardLighting !== false,
    shardEdgeShade: t.shardEdgeShade !== false,
    shardDepthFade: t.shardDepthFade !== false,
    shardFacetShade: t.shardFacetShade !== false,
    shardFacetStrength: fs,
  };
}

/** 光源は画面上の左上（Phaser 座標で -x -y 方向） */
const SHARD_LIGHT_TO_X = -0.7071067811865476;
const SHARD_LIGHT_TO_Y = -0.7071067811865476;

/**
 * 最長辺に直交する外向き単位法線（テクスチャ／キャンバス座標、y 下向き）
 * @param {{x:number,y:number}[]} pts
 */
function computeFacetNormalFromPoly(pts) {
  if (!pts?.length) return { nx: 1, ny: 0 };
  let best = 0;
  let nx = 1;
  let ny = 0;
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const ex = p1.x - p0.x;
    const ey = p1.y - p0.y;
    const el = Math.hypot(ex, ey);
    if (el > best) {
      best = el;
      let px = -ey / el;
      let py = ex / el;
      const mx = (p0.x + p1.x) * 0.5;
      const my = (p0.y + p1.y) * 0.5;
      if ((mx - cx) * px + (my - cy) * py < 0) {
        px = -px;
        py = -py;
      }
      nx = px;
      ny = py;
    }
  }
  const h = Math.hypot(nx, ny) || 1;
  return { nx: nx / h, ny: ny / h };
}

function mulberry32(seed) {
  return function rnd() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygonAreaSigned(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a * 0.5;
}

function centroidOfPoly(pts) {
  const A = polygonAreaSigned(pts);
  if (Math.abs(A) < 1e-4) {
    const sx = pts.reduce((s, p) => s + p.x, 0);
    const sy = pts.reduce((s, p) => s + p.y, 0);
    return { x: sx / pts.length, y: sy / pts.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const cr = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    cx += (pts[i].x + pts[j].x) * cr;
    cy += (pts[i].y + pts[j].y) * cr;
  }
  const k = 1 / (6 * A);
  return { x: cx * k, y: cy * k };
}

function lineIntersectHalfPlane(P, Q, nx, ny, d) {
  const fP = nx * P.x + ny * P.y;
  const fQ = nx * Q.x + ny * Q.y;
  const t = (d - fP) / (fQ - fP + 1e-12);
  return {
    x: Phaser.Math.Clamp(P.x + t * (Q.x - P.x), -1e6, 1e6),
    y: Phaser.Math.Clamp(P.y + t * (Q.y - P.y), -1e6, 1e6),
  };
}

/** Convex clip: keep nx*x+ny*y <= d */
function clipConvexPolygon(poly, nx, ny, d) {
  if (!poly?.length) return [];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = nx * cur.x + ny * cur.y <= d + 1e-5;
    const prevIn = nx * prev.x + ny * prev.y <= d + 1e-5;
    if (curIn) {
      if (!prevIn) out.push(lineIntersectHalfPlane(prev, cur, nx, ny, d));
      out.push(cur);
    } else if (prevIn) {
      out.push(lineIntersectHalfPlane(prev, cur, nx, ny, d));
    }
  }
  return out;
}

function voronoiCellForSite(seeds, siteIndex, natW, natH, pad) {
  let poly = [
    { x: -pad, y: -pad },
    { x: natW + pad, y: -pad },
    { x: natW + pad, y: natH + pad },
    { x: -pad, y: natH + pad },
  ];
  const si = seeds[siteIndex];
  for (let j = 0; j < seeds.length; j++) {
    if (j === siteIndex) continue;
    const sj = seeds[j];
    const vx = sj.x - si.x;
    const vy = sj.y - si.y;
    const nx = 2 * vx;
    const ny = 2 * vy;
    const d = sj.x * sj.x + sj.y * sj.y - si.x * si.x - si.y * si.y;
    poly = clipConvexPolygon(poly, nx, ny, d);
    if (poly.length < 3) return null;
  }
  poly = clipConvexPolygon(poly, -1, 0, 0);
  if (poly.length < 3) return null;
  poly = clipConvexPolygon(poly, 1, 0, natW);
  if (poly.length < 3) return null;
  poly = clipConvexPolygon(poly, 0, -1, 0);
  if (poly.length < 3) return null;
  poly = clipConvexPolygon(poly, 0, 1, natH);
  if (poly.length < 3) return null;
  return poly;
}

function bboxOfPoly(pts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function drawBootBgCollapseFragOutline(gfx, localPts, lineWidth, color, alpha) {
  if (!gfx || gfx.destroyed || !localPts?.length) return;
  gfx.clear();
  gfx.lineStyle(lineWidth, color, alpha);
  gfx.beginPath();
  gfx.moveTo(localPts[0].x, localPts[0].y);
  for (let i = 1; i < localPts.length; i += 1) {
    gfx.lineTo(localPts[i].x, localPts[i].y);
  }
  gfx.closePath();
  gfx.strokePath();
}

/**
 * 背景クリップ後に液晶／ガラス断片向けの微細な面バラつきを乗算・ソフトライトで重ねる。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cw
 * @param {number} ch
 * @param {() => number} rnd
 */
function drawShardSurfaceDetailInClip(ctx, cw, ch, rnd) {
  const cx = cw * 0.5;
  const cy = ch * 0.5;
  const minD = Math.min(cw, ch);

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const coolA = 0.035 + rnd() * 0.045;
  ctx.fillStyle = `rgba(168, 188, 218, ${coolA})`;
  ctx.fillRect(0, 0, cw, ch);
  const warmA = rnd() * 0.028;
  ctx.fillStyle = `rgba(210, 206, 200, ${warmA})`;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const grains = 4 + ((rnd() * 5) | 0);
  for (let g = 0; g < grains; g++) {
    const gx = rnd() * cw;
    const gy = rnd() * ch;
    const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, 0.5 + rnd() * minD * 0.09);
    grd.addColorStop(0, `rgba(218,226,238,${0.018 + rnd() * 0.026})`);
    grd.addColorStop(1, 'rgba(120,132,148,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.strokeStyle = `rgba(72, 82, 98, ${0.045 + rnd() * 0.035})`;
  ctx.lineWidth = 1;
  const scratches = 1 + ((rnd() * 3) | 0);
  for (let s = 0; s < scratches; s++) {
    let x0 = rnd() * cw;
    let y0 = rnd() * ch;
    const ang = rnd() * Math.PI * 2;
    const len = minD * (0.22 + rnd() * 0.45);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 内側に薄いリム暗部（multiply + ごく弱いアウトラインストローク）
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number}[]} polyCanvas
 * @param {number} cw
 * @param {number} ch
 */
function drawShardEdgeShadeInClip(ctx, polyCanvas, cw, ch) {
  const cx = cw * 0.5;
  const cy = ch * 0.5;
  const maxR = Math.hypot(cw, ch) * 0.55;

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createRadialGradient(cx, cy, Math.max(2, Math.min(cw, ch) * 0.08), cx, cy, maxR);
  g.addColorStop(0, 'rgb(252,252,254)');
  g.addColorStop(0.58, 'rgb(244,246,250)');
  g.addColorStop(1, 'rgb(188,198,218)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.42);
  g2.addColorStop(0, 'rgba(248,250,255,0.11)');
  g2.addColorStop(0.42, 'rgba(240,244,252,0.04)');
  g2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();

  const strokeW = Phaser.Math.Clamp(Math.min(cw, ch) * 0.034, 2, 5);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = 'rgba(32, 40, 54, 0.13)';
  ctx.lineWidth = strokeW;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(polyCanvas[0].x, polyCanvas[0].y);
  for (let i = 1; i < polyCanvas.length; i++) {
    ctx.lineTo(polyCanvas[i].x, polyCanvas[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/**
 * 左上光源に沿った単一线形グラデで「面」をほんのり感じさせる（三角分割線なし）。
 * effectStrength = 面積係数 × shardFacetStrength。text id=4vvw4z: 明暗は約 0.92〜1.03 相当に抑える。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number}[]} polyCanvas
 * @param {number} cw
 * @param {number} ch
 * @param {number} effectStrength 0 で無効
 */
function drawShardFacetSoftGradientInClip(ctx, polyCanvas, cw, ch, effectStrength) {
  if (effectStrength < 0.001) return;
  const n = polyCanvas.length;
  if (n < 3) return;
  const cen = centroidOfPoly(polyCanvas);
  const Lx = SHARD_LIGHT_TO_X;
  const Ly = SHARD_LIGHT_TO_Y;
  const halfLen = Math.hypot(cw, ch) * 0.5;
  const s = Phaser.Math.Clamp(effectStrength, 0, 1.2);
  const spanMul = 0.055 * s;
  const lo = Phaser.Math.Clamp(0.975 - spanMul, 0.9, 0.975);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(polyCanvas[0].x, polyCanvas[0].y);
  for (let i = 1; i < n; i++) {
    ctx.lineTo(polyCanvas[i].x, polyCanvas[i].y);
  }
  ctx.closePath();
  ctx.clip();

  const gx0 = cen.x - Lx * halfLen;
  const gy0 = cen.y - Ly * halfLen;
  const gx1 = cen.x + Lx * halfLen;
  const gy1 = cen.y + Ly * halfLen;

  const r0 = Math.round(255 * lo * 0.96);
  const g0 = Math.round(255 * lo * 0.99);
  const b0 = Math.round(Math.min(255, 255 * lo * 1.02));
  const mid = (lo + 1) * 0.5;
  const r1 = Math.round(255 * mid * 0.98);
  const g1 = Math.round(255 * mid * 0.995);
  const b1 = Math.round(Math.min(255, 255 * mid * 1.01));

  const grd = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  grd.addColorStop(0, `rgb(${r0},${g0},${b0})`);
  grd.addColorStop(0.5, `rgb(${r1},${g1},${b1})`);
  grd.addColorStop(1, 'rgb(252,253,255)');

  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 1;
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, cw, ch);

  const hlA = 0.022 * s;
  if (hlA > 0.0015) {
    const grd2 = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    grd2.addColorStop(0, 'rgba(198,208,228,0)');
    grd2.addColorStop(0.52, 'rgba(210,218,236,0)');
    grd2.addColorStop(1, `rgba(224,232,248,${hlA})`);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = grd2;
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.restore();
}

/**
 * Canvas clip でポリゴン領域を焼き込み、Phaser の canvas テクスチャとして登録。
 * @param {number} facetStrength01 面積係数×shardFacetStrength（facet 合成強度、0 で実質無効）
 * @returns {{ texKey: string, dispW: number, dispH: number, localPts: {x:number,y:number}[] }}
 */
function bakeShardCanvasTexture(
  bootScene,
  texKey,
  ptsTex,
  cropL,
  cropT,
  cropW,
  cropH,
  dispW,
  dispH,
  uniqueKey,
  shardRnd,
  edgeShadeOn,
  facetShadeOn,
  facetStrength01,
) {
  const cw = Math.max(1, Math.ceil(dispW));
  const ch = Math.max(1, Math.ceil(dispH));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const tex = bootScene.textures.get(texKey);
  const src = tex.getSourceImage();
  const polyCanvas = ptsTex.map((p) => ({
    x: ((p.x - cropL) / cropW) * cw,
    y: ((p.y - cropT) / cropH) * ch,
  }));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(polyCanvas[0].x, polyCanvas[0].y);
  for (let i = 1; i < polyCanvas.length; i++) {
    ctx.lineTo(polyCanvas[i].x, polyCanvas[i].y);
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(src, cropL, cropT, cropW, cropH, 0, 0, cw, ch);

  if (facetShadeOn) {
    drawShardFacetSoftGradientInClip(ctx, polyCanvas, cw, ch, facetStrength01);
  }

  drawShardSurfaceDetailInClip(ctx, cw, ch, shardRnd);
  if (edgeShadeOn) {
    drawShardEdgeShadeInClip(ctx, polyCanvas, cw, ch);
  }
  ctx.restore();

  const key = `boot-bg-shard-${uniqueKey}`;
  if (bootScene.textures.exists(key)) {
    bootScene.textures.remove(key);
  }
  bootScene.textures.addCanvas(key, canvas);

  const localPts = ptsTex.map((p) => ({
    x: ((p.x - cropL) / cropW - 0.5) * dispW,
    y: ((p.y - cropT) / cropH - 0.5) * dispH,
  }));

  return { texKey: key, dispW, dispH, localPts };
}

function pointInFaultBands(wx, wy, spec, W) {
  if (!spec) return false;
  const mainTop = spec.mainCy - spec.mainH * 0.5;
  const mainBot = mainTop + spec.mainH;
  const inMain = wx >= 0 && wx <= W && wy >= mainTop && wy <= mainBot;
  if (inMain) return true;
  if (spec.sub) {
    const st = spec.sub.cy - spec.sub.h * 0.5;
    const sb = st + spec.sub.h;
    return wx >= 0 && wx <= W && wy >= st && wy <= sb;
  }
  return false;
}

function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInQuad(t) {
  return t * t;
}

function easeInOutCubic(t) {
  const u = Phaser.Math.Clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function easeInOutSine(t) {
  const u = Phaser.Math.Clamp(t, 0, 1);
  return -0.5 * (Math.cos(Math.PI * u) - 1);
}

/** 背景グリッドより前・通常破片より手前・PLAY 文字より奥（home-scene の glyph 11 より下） */
const PLAY_SHARD_FORMATION_DEPTH = 10.05;
/** 形成破片同士の前後差（2〜4 段。過剰な段差にしない） */
const PLAY_FORM_SHARD_DEPTH_STEP = 0.11;

function smoothstep01(t) {
  const u = Phaser.Math.Clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

/**
 * 大型〜中型のみ・3〜6 枚で PLAY 形成用シャードをタグ付け（小破片は対象外）
 * @param {{ mass: number, restX: number, restY: number }[]} items
 * @param {() => number} rnd
 */
function tagPlayFormationShards(items, rnd) {
  if (!items?.length) return;
  let maxM = 0;
  for (const it of items) maxM = Math.max(maxM, it.mass);
  if (!(maxM > 0)) return;
  /** 最大セルに対する面積比の下限（小破片を PLAY 形成から除外） */
  let minRatio = 0.11;
  let elig = items
    .map((it, i) => (it.mass >= maxM * minRatio ? i : -1))
    .filter((i) => i >= 0);
  while (elig.length < 3 && minRatio > 0.042) {
    minRatio *= 0.86;
    elig = items.map((it, i) => (it.mass >= maxM * minRatio ? i : -1)).filter((i) => i >= 0);
  }
  const eligSet = new Set(elig);
  const scored = items
    .map((it, i) => ({ i, mass: it.mass, x: it.restX, y: it.restY }))
    .filter((s) => eligSet.has(s.i));
  if (!scored.length) return;

  /** 形成役割は最大 5（centerCore + 両翼 + 上下 cap）。6 枚目は「寄せ」に見えるため上限 5。 */
  const hi = Math.min(5, scored.length);
  const lo = Math.min(3, hi);
  let nWant = 3 + ((rnd() * 3) | 0);
  if (nWant > hi) nWant = hi;
  if (nWant < lo) nWant = lo;
  scored.sort((a, b) => b.mass - a.mass);
  const picked = new Set();
  const seedIdx = scored[0]?.i ?? 0;
  picked.add(seedIdx);
  while (picked.size < nWant) {
    let bestI = -1;
    let bestScore = -Infinity;
    for (const { i, x, y } of scored) {
      if (picked.has(i)) continue;
      let mind = 1e12;
      for (const pj of picked) {
        const o = items[pj];
        const d = Math.hypot(x - o.restX, y - o.restY);
        mind = Math.min(mind, d);
      }
      const score = mind + rnd() * 120;
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }
    if (bestI < 0) break;
    picked.add(bestI);
  }
  for (const i of picked) {
    items[i].playFormation = true;
    items[i].retireMode = 0;
  }
  for (let j = 0; j < items.length; j++) {
    if (items[j].playFormation) continue;
    const r = rnd();
    items[j].retireMode = r < 0.34 ? 1 : r < 0.67 ? 2 : 3;
  }
}

/** P/L/A 行の中心 Y（redrawHomePlayUI と同一式） */
function computePlayGlyphRowCenterY(layout) {
  const { textCy, triDispH, midGap, playRowDispH } = layout;
  const playContentH = triDispH + midGap + playRowDispH;
  const playBlockTop = textCy - playContentH * 0.5;
  return playBlockTop + triDispH + midGap + playRowDispH * 0.5;
}

function _playFormShardHalfSize(it) {
  const w = it?.img?.displayWidth;
  const h = it?.img?.displayHeight;
  const roleScale = _playFormRoleScale(it?.playFormationRole);
  const hw = typeof w === 'number' && w > 4 ? w * 0.5 : 40;
  const hh = typeof h === 'number' && h > 4 ? h * 0.5 : 40;
  return { hw: hw * roleScale.x, hh: hh * roleScale.y };
}

/** min(w,h)/max(w,h) — 極細長ほど小さい */
function _shardBbCompactness01(it) {
  const w = it?.img?.displayWidth;
  const h = it?.img?.displayHeight;
  if (!(typeof w === 'number' && w > 2 && typeof h === 'number' && h > 2)) return 0;
  return Math.min(w, h) / Math.max(w, h);
}

function _shardDisplayArea(it) {
  const w = it?.img?.displayWidth;
  const h = it?.img?.displayHeight;
  if (!(typeof w === 'number' && w > 2 && typeof h === 'number' && h > 2)) return 0;
  return w * h;
}

const PLAY_FORM_ROLE_SCALE = Object.freeze({
  centerCore: { x: 2.08, y: 1.28 },
  leftWing: { x: 1.34, y: 1.04 },
  rightWing: { x: 1.34, y: 1.04 },
  topCap: { x: 1.24, y: 0.82 },
  bottomCap: { x: 1.28, y: 0.84 },
});

function _playFormRoleScale(role) {
  return PLAY_FORM_ROLE_SCALE[role] ?? { x: 1, y: 1 };
}

function _playFormRoleLightMul(role) {
  if (role === 'centerCore') return 1.09;
  if (role === 'leftWing' || role === 'rightWing') return 0.968;
  if (role === 'topCap' || role === 'bottomCap') return 0.928;
  return 1;
}

function _playFormRoleAlphaMul(role) {
  if (role === 'centerCore') return 1.08;
  if (role === 'leftWing' || role === 'rightWing') return 0.968;
  if (role === 'topCap' || role === 'bottomCap') return 0.9;
  return 1;
}

/** centerCore に極細長を割り当てない下限 */
const PLAY_FORM_CORE_COMPACT_MIN = 0.18;

/**
 * PLAY 行外接幅（totalW）の 50〜70% 付近を覆える横長シャードを主面に選ぶ
 * @param {object[]} formItems
 * @param {number} playRowSpanW
 */
function pickPlayFormationCenterCore(formItems, playRowSpanW) {
  const byMass = [...formItems].sort((a, b) => b.mass - a.mass);
  if (!byMass.length) return null;
  const span = typeof playRowSpanW === 'number' && playRowSpanW > 48 ? playRowSpanW : 0;
  const compactOk = byMass.filter((c) => _shardBbCompactness01(c) >= PLAY_FORM_CORE_COMPACT_MIN);
  const pool = compactOk.length ? compactOk : byMass;
  if (!span) return pool[0];
  const loW = span * 0.5;
  const hiW = span * 0.7;
  let best = pool[0];
  let bestScore = -Infinity;
  for (const c of pool) {
    const w = typeof c.img?.displayWidth === 'number' && c.img.displayWidth > 2 ? c.img.displayWidth : 0;
    const h = typeof c.img?.displayHeight === 'number' && c.img.displayHeight > 2 ? c.img.displayHeight : 1;
    const horiz = w / Math.max(h, 1e-3);
    let score = 0;
    if (w >= loW && w <= hiW) {
      score = 520 + w * 0.02 + Math.min(horiz, 2.4) * 42;
    } else if (w < loW) {
      score = 180 + w * 1.05 + (w / Math.max(loW, 1e-3)) * 88 + Math.min(horiz, 2.2) * 28;
    } else {
      score = 165 + hiW * 1.15 - (w - hiW) * 0.32 + Math.min(horiz, 2.2) * 22;
    }
    if (horiz >= 1.04) score += 26;
    else if (horiz < 0.78) score -= 38;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** 数値は段差 weight（center を翼より手前に） */
const PLAY_FORM_ROLE_DEPTH = Object.freeze({
  topCap: 0.12,
  bottomCap: 0.14,
  leftWing: 1.32,
  rightWing: 1.36,
  centerCore: 2.58,
});

function assignPlayFormationRoles(formItems, playRowSpanW) {
  for (const it of formItems) delete it.playFormationRole;
  if (!formItems.length) return;
  const byMass = [...formItems].sort((a, b) => b.mass - a.mass);
  const core = pickPlayFormationCenterCore(formItems, playRowSpanW) ?? byMass[0];
  const pool = byMass.filter((x) => x !== core);
  pool.sort((a, b) => a.restX - b.restX || a.restY - b.restY || a.mass - b.mass);
  const leftWing = pool[0];
  const rightWing = pool[pool.length - 1];
  const mids = pool.slice(1, -1);
  mids.sort((a, b) => {
    const da = _shardDisplayArea(a);
    const dba = _shardDisplayArea(b);
    if (da !== dba) return da - dba;
    return a.mass - b.mass;
  });
  let topCap = null;
  let bottomCap = null;
  if (mids.length >= 2) {
    topCap = mids[0];
    bottomCap = mids[1];
  } else if (mids.length === 1) {
    const avgY = (leftWing.restY + rightWing.restY + core.restY) / 3;
    if (avgY > core.restY) topCap = mids[0];
    else bottomCap = mids[0];
  }
  core.playFormationRole = 'centerCore';
  leftWing.playFormationRole = 'leftWing';
  rightWing.playFormationRole = 'rightWing';
  if (topCap) topCap.playFormationRole = 'topCap';
  if (bottomCap) bottomCap.playFormationRole = 'bottomCap';
}

function applyClusterShiftToFitPanel(targets, panelL, panelT, panelW, panelH, margin) {
  const loX = panelL + margin;
  const hiX = panelL + panelW - margin;
  const loY = panelT + margin;
  const hiY = panelT + panelH - margin;
  for (let pass = 0; pass < 6; pass++) {
    let minL = Infinity;
    let maxR = -Infinity;
    let minT = Infinity;
    let maxB = -Infinity;
    for (const t of targets) {
      const { hw, hh } = _playFormShardHalfSize(t.it);
      minL = Math.min(minL, t.tx - hw);
      maxR = Math.max(maxR, t.tx + hw);
      minT = Math.min(minT, t.ty - hh);
      maxB = Math.max(maxB, t.ty + hh);
    }
    let dx = 0;
    let dy = 0;
    if (minL < loX) dx = loX - minL;
    else if (maxR > hiX) dx = hiX - maxR;
    if (minT < loY) dy = loY - minT;
    else if (maxB > hiY) dy = hiY - maxB;
    if (dx === 0 && dy === 0) break;
    for (const t of targets) {
      t.tx += dx;
      t.ty += dy;
    }
  }
  let minL = Infinity;
  let maxR = -Infinity;
  for (const t of targets) {
    const { hw } = _playFormShardHalfSize(t.it);
    minL = Math.min(minL, t.tx - hw);
    maxR = Math.max(maxR, t.tx + hw);
  }
  if (maxR - minL > hiX - loX - 0.5) {
    const cx = (minL + maxR) * 0.5;
    const sh = (loX + hiX) * 0.5 - cx;
    for (const t of targets) t.tx += sh;
  }
}

/**
 * @param {Phaser.Scene} bootScene
 * @param {object[]} items
 * @param {ReturnType<typeof computePlayPanelLayoutForShardFormation>} layout
 * @param {() => number} rnd
 */
function ensurePlayFormationTargetsAssigned(bootScene, items, layout, rnd) {
  if (bootScene._playFormationTargetsAssigned) return;
  const form = items.filter((it) => it.playFormation);
  if (!form.length) {
    bootScene._playFormationTargetsAssigned = true;
    return;
  }
  assignPlayFormationRoles(form, layout.totalW);

  const { panelL, panelT, panelW, panelH, textCx } = layout;
  const playCy = computePlayGlyphRowCenterY(layout);
  const margin = 8;

  const core = form.find((x) => x.playFormationRole === 'centerCore');
  const leftW = form.find((x) => x.playFormationRole === 'leftWing');
  const rightW = form.find((x) => x.playFormationRole === 'rightWing');
  const topC = form.find((x) => x.playFormationRole === 'topCap');
  const botC = form.find((x) => x.playFormationRole === 'bottomCap');

  const olap = Phaser.Math.Clamp(70 + rnd() * 28, 70, 98);
  const olapR = Phaser.Math.Clamp(70 + rnd() * 28, 70, 98);
  /** 補修板は主面に深く重ね、端だけを横長ボタン外周の欠けとして使う。 */
  const wingOutX = 2 + rnd() * 5;

  let ccX = textCx + (rnd() - 0.5) * 6;
  let ccY = playCy + (rnd() - 0.5) * 3;

  /** @type {{ it: object, tx: number, ty: number, rot: number }[]} */
  const targets = [];

  if (core) {
    targets.push({
      it: core,
      tx: ccX,
      ty: ccY,
      rot: Phaser.Math.DegToRad((rnd() - 0.5) * 4),
    });
  }

  if (leftW && core) {
    const { hw: lhw, hh: lhh } = _playFormShardHalfSize(leftW);
    const { hw: cwh, hh: cchh } = _playFormShardHalfSize(core);
    const wingOverlap = Math.min(cwh * 0.64, olap);
    targets.push({
      it: leftW,
      tx: ccX - cwh - lhw + wingOverlap - wingOutX,
      ty: ccY + cchh * 0.08 + (rnd() - 0.5) * Math.min(7, lhh * 0.18),
      rot: Phaser.Math.DegToRad((rnd() - 0.5) * 5),
    });
  }

  if (rightW && core) {
    const { hw: rhw, hh: rhh } = _playFormShardHalfSize(rightW);
    const { hw: cwh2, hh: cchh2 } = _playFormShardHalfSize(core);
    const wingOverlap = Math.min(cwh2 * 0.64, olapR);
    targets.push({
      it: rightW,
      tx: ccX + cwh2 + rhw - wingOverlap + wingOutX,
      ty: ccY + cchh2 * 0.08 + (rnd() - 0.5) * Math.min(7, rhh * 0.18),
      rot: Phaser.Math.DegToRad((rnd() - 0.5) * 5),
    });
  }

  if (topC && core) {
    const { hh: thh } = _playFormShardHalfSize(topC);
    const { hw: cwh, hh: cchh } = _playFormShardHalfSize(core);
    const coreTop = ccY - cchh;
    const topTrim = 2 + rnd() * 4;
    const rawTy = coreTop + thh - topTrim;
    const seamSide = rnd() < 0.5 ? -1 : 1;
    const tx = ccX + seamSide * (cwh * 0.28 + rnd() * panelW * 0.035);
    const ty = Phaser.Math.Clamp(rawTy, panelT + margin + thh, ccY - cchh * 0.08);
    targets.push({
      it: topC,
      tx,
      ty,
      rot: Phaser.Math.DegToRad((rnd() - 0.5) * 4.8),
    });
  }

  if (botC && core) {
    const { hh: bhh } = _playFormShardHalfSize(botC);
    const { hw: cwh2, hh: cchh2 } = _playFormShardHalfSize(core);
    const coreBottom = ccY + cchh2;
    const bottomDrift = (rnd() - 0.2) * 3;
    const rawBy = coreBottom + bottomDrift - bhh;
    const seamSide = rnd() < 0.5 ? -1 : 1;
    const tx = ccX + seamSide * (cwh2 * 0.22 + rnd() * panelW * 0.03);
    const ty = Phaser.Math.Clamp(rawBy, ccY + cchh2 * 0.08, panelT + panelH - margin - bhh);
    targets.push({
      it: botC,
      tx,
      ty,
      rot: Phaser.Math.DegToRad((rnd() - 0.5) * 4.4),
    });
  }

  applyClusterShiftToFitPanel(targets, panelL, panelT, panelW, panelH, margin);

  for (const t of targets) {
    const { it, tx, ty, rot } = t;
    it.playTargetX = Phaser.Math.Clamp(tx, panelL + margin, panelL + panelW - margin);
    it.playTargetY = Phaser.Math.Clamp(ty, panelT + margin, panelT + panelH - margin);
    it.playTargetRot = rot;
    const role = it.playFormationRole;
    const di = PLAY_FORM_ROLE_DEPTH[role];
    if (typeof di === 'number') it.playFormationDepthIdx = di;
  }

  bootScene._playFormationTargetsAssigned = true;

  if (playFormationDebugSurfaceEnabled() && !bootScene._playFormRoleDebugLogged) {
    bootScene._playFormRoleDebugLogged = true;
    const lines = ['[PLAY_FORM_ROLE]'];
    const order = ['centerCore', 'leftWing', 'rightWing', 'topCap', 'bottomCap'];
    for (const role of order) {
      const it = form.find((x) => x.playFormationRole === role);
      if (!it || typeof it.playTargetX !== 'number') continue;
      const id = it.texKey || 'shard';
      const rotDeg = (it.playTargetRot * 180) / Math.PI;
      lines.push(
        `${role} ${id} / ${it.playTargetX.toFixed(1)} / ${it.playTargetY.toFixed(1)} / ${rotDeg.toFixed(2)}`,
      );
    }
    console.log(lines.join('\n'));
  }
}

/**
 * Boot create 時: 背景断片シートを構築（1 枚に見える静止配置）。
 * @param {Phaser.Scene} bootScene
 */
export function mountBootBgCollapseShardSheet(bootScene, W, H, bgCx, bgCy, bgScale, natW, natH) {
  destroyBootBgCollapseFragments(bootScene);

  const seed0 = ((natW | 0) ^ ((natH | 0) << 11) ^ 0x4f6a2c17) >>> 0;
  const rnd = mulberry32(seed0);

  let nSites = 22 + Math.floor(rnd() * 32);
  if (nSites < 20) nSites = 20;
  if (nSites > 56) nSites = 56;

  const seeds = [];
  const margin = Math.min(natW, natH) * 0.04;
  for (let i = 0; i < nSites; i++) {
    seeds.push({
      x: margin + rnd() * Math.max(1, natW - 2 * margin),
      y: margin + rnd() * Math.max(1, natH - 2 * margin),
    });
  }

  const pad = Math.max(natW, natH) * 2;
  const cells = [];
  for (let i = 0; i < seeds.length; i++) {
    const poly = voronoiCellForSite(seeds, i, natW, natH, pad);
    if (!poly || poly.length < 3) continue;
    const area = Math.abs(polygonAreaSigned(poly));
    if (area < (natW * natH) / 8000) continue;
    cells.push({ poly, area });
  }

  if (cells.length < 12) {
    console.warn('[boot-bg-collapse] too few voronoi cells, retrying with grid jitter');
    seeds.length = 0;
    const nx = 6;
    const ny = 5;
    for (let gy = 0; gy < ny; gy++) {
      for (let gx = 0; gx < nx; gx++) {
        const cx = ((gx + 0.5) / nx) * natW + (rnd() - 0.5) * natW * 0.06;
        const cy = ((gy + 0.5) / ny) * natH + (rnd() - 0.5) * natH * 0.06;
        seeds.push({
          x: Phaser.Math.Clamp(cx, margin, natW - margin),
          y: Phaser.Math.Clamp(cy, margin, natH - margin),
        });
      }
    }
    cells.length = 0;
    for (let i = 0; i < seeds.length; i++) {
      const poly = voronoiCellForSite(seeds, i, natW, natH, pad);
      if (!poly || poly.length < 3) continue;
      const area = Math.abs(polygonAreaSigned(poly));
      if (area < 80) continue;
      cells.push({ poly, area });
    }
  }

  const texToWorld = (tx, ty) => ({
    x: bgCx + (tx - natW * 0.5) * bgScale,
    y: bgCy + (ty - natH * 0.5) * bgScale,
  });

  const root = bootScene.add.container(0, 0);
  root.setDepth(-51);

  const uniq = `${(performance.now() % 1e7).toFixed(0)}_${(Math.random() * 1e6) | 0}`;
  const items = [];
  const visMount = readShardVisualFlags();

  let maxCellArea = 1;
  for (const c of cells) {
    maxCellArea = Math.max(maxCellArea, c.area);
  }

  for (let di = 0; di < cells.length; di++) {
    const ptsTex0 = cells[di].poly.map((p) => ({
      x: Phaser.Math.Clamp(p.x, 0.5, natW - 0.5),
      y: Phaser.Math.Clamp(p.y, 0.5, natH - 0.5),
    }));
    const bb = bboxOfPoly(ptsTex0);
    const padPx = 2;
    let cropL = Math.floor(bb.minX - padPx);
    let cropT = Math.floor(bb.minY - padPx);
    let cropR = Math.ceil(bb.maxX + padPx);
    let cropB = Math.ceil(bb.maxY + padPx);
    cropL = Phaser.Math.Clamp(cropL, 0, natW - 2);
    cropT = Phaser.Math.Clamp(cropT, 0, natH - 2);
    cropR = Phaser.Math.Clamp(cropR, cropL + 2, natW);
    cropB = Phaser.Math.Clamp(cropB, cropT + 2, natH);
    const cropW = cropR - cropL;
    const cropH = cropB - cropT;

    const cenTex = centroidOfPoly(ptsTex0);
    const dispW = cropW * bgScale;
    const dispH = cropH * bgScale;

    const shardRnd = mulberry32(((seed0 ^ (di * 0x9e3779b9)) >>> 0) ^ 0x85ebca6b);
    const areaRatio = maxCellArea > 0 ? cells[di].area / maxCellArea : 0;
    const facetPaintStrength = facetAreaScaleFromRatio(areaRatio) * visMount.shardFacetStrength;
    const baked = bakeShardCanvasTexture(
      bootScene,
      'home-bg-normal',
      ptsTex0,
      cropL,
      cropT,
      cropW,
      cropH,
      dispW,
      dispH,
      `${uniq}_${di}`,
      shardRnd,
      visMount.shardEdgeShade,
      visMount.shardFacetShade,
      facetPaintStrength,
    );
    if (!baked) continue;

    const ptsNorm = ptsTex0.map((p) => ({
      x: (p.x - cropL) / cropW,
      y: (p.y - cropT) / cropH,
    }));
    const facet = computeFacetNormalFromPoly(ptsNorm);

    const restW = texToWorld(cenTex.x, cenTex.y);
    const mass = Math.max(400, cells[di].area);
    const sizeRank = Math.sqrt(mass / (natW * natH));

    const towardX = cenTex.x - natW * 0.5;
    const towardY = cenTex.y - natH * 0.5;
    const len = Math.hypot(towardX, towardY) + 1e-6;
    const nx = towardX / len;
    const ny = towardY / len;
    const spread = (7 + rnd() * 22) * bgScale * (0.58 + sizeRank * 0.55);
    const jitterX = (rnd() - 0.5) * 12 * bgScale;
    const jitterY = (rnd() - 0.5) * 10 * bgScale;
    const gx = nx * spread + jitterX;
    const gy = ny * spread * 0.9 + jitterY;
    const crackU = Phaser.Math.FloatBetween(0.32, 0.5);
    const crackX = restW.x + gx * crackU;
    const crackY = restW.y + gy * crackU;
    const gapX = restW.x + gx;
    const gapY = restW.y + gy;
    const crackRot = Phaser.Math.DegToRad((rnd() - 0.5) * (18 + 58 * (1 - sizeRank * 0.62)));
    const gapRot = crackRot * Phaser.Math.FloatBetween(1.28, 1.72);
    const depthNudge = (rnd() - 0.5) * 0.08;
    const depth01 = Phaser.Math.Clamp((depthNudge + 0.04) / 0.08, 0, 1);

    const lateralBoost = rnd() < 0.42 ? (rnd() - 0.5) * 1.05 * bgScale : 0;
    const vx0 = (rnd() - 0.5) * 0.175 * (1.22 - sizeRank * 0.38) + lateralBoost;
    const vy0 = 0.095 + rnd() * 0.22 + (1 - sizeRank) * 0.1;
    const vr0 = Phaser.Math.DegToRad(((rnd() - 0.5) * 0.2) / (0.52 + sizeRank * 0.38));

    const ay = (0.00044 + rnd() * 0.0002) / Math.sqrt(mass / 9000);
    const suckBand = rnd() < 0.38;
    const fadeEarly = mass < (natW * natH) * 0.012 && rnd() < 0.55;
    const bandBias = rnd();

    const img = bootScene.add.image(0, 0, baked.texKey).setOrigin(0.5, 0.5);
    const bleedPx = 2;
    img.setDisplaySize(baked.dispW + bleedPx, baked.dispH + bleedPx);

    let outlineGfx = null;
    if (playFormationDebugSurfaceEnabled()) {
      outlineGfx = bootScene.add.graphics();
      drawBootBgCollapseFragOutline(outlineGfx, baked.localPts, 1.2, 0x00ffff, 0.85);
    }

    const c = bootScene.add.container(restW.x, restW.y, outlineGfx ? [img, outlineGfx] : [img]);
    c.setRotation(0);
    c.setDepth(-51 + depthNudge);
    root.add(c);

    items.push({
      container: c,
      img,
      outlineGfx,
      texKey: baked.texKey,
      restX: restW.x,
      restY: restW.y,
      crackX,
      crackY,
      crackR: crackRot,
      gapX,
      gapY,
      gapR: gapRot,
      mass,
      vx0,
      vy0,
      vr0,
      ay,
      suckBand,
      fadeEarly,
      bandBias,
      fallStarted: false,
      px: 0,
      py: 0,
      pr: 0,
      vx: 0,
      vy: 0,
      vr: 0,
      facetNx: facet.nx,
      facetNy: facet.ny,
      depth01,
      lightShadeAmp: (0.015 + sizeRank * 0.072) * (0.52 + 0.48 * sizeRank),
    });
  }

  root.setAlpha(0);
  const tagRnd = mulberry32(((seed0 ^ 0x17c4b2a9) >>> 0) ^ 0x4bc3ef1d);
  tagPlayFormationShards(items, tagRnd);
  bootScene._bootBgShardRoot = root;
  bootScene._bootBgCollapseFragItems = items;
  bootScene._bootBgCollapseFaultSpec = null;
  bootScene._bootBgShardPhysicsActive = false;

  if (!items.length) {
    console.error('[boot-bg-collapse] shard mount produced zero pieces; falling back to flat boot bg');
    try {
      root.destroy(true);
    } catch (_) {
      /* ignore */
    }
    bootScene._bootBgShardRoot = null;
    bootScene._bootBgCollapseFragItems = null;
    if (bootScene._bootBg && !bootScene._bootBg.destroyed) {
      bootScene._bootBg.setVisible(true);
    }
  }
}

/** progress フェーズで背景 alpha と同期 */
export function syncBootBgShardSheetAlpha(bootScene, alpha) {
  const r = bootScene._bootBgShardRoot;
  if (r && !r.destroyed) {
    r.setAlpha(Phaser.Math.Clamp(alpha, 0, 1));
  }
}

/**
 * collapse 開始時: 断片物理を有効化（既にマウント済みのシートを動かす）。
 */
export function activateBootBgCollapseShardPhysics(bootScene, faultBandSpec, epochMs) {
  bootScene._bootBgCollapseFaultSpec = faultBandSpec;
  bootScene._bootBgShardPhysicsActive = true;
  bootScene._playFormationTargetsAssigned = false;
  bootScene._playFormRoleDebugLogged = false;
  if (typeof epochMs === 'number' && Number.isFinite(epochMs)) {
    bootScene.game.registry.set(REG_BOOT_BG_FRAG_EPOCH_MS, epochMs);
  }
  const items = bootScene._bootBgCollapseFragItems;
  if (items?.length) {
    for (const it of items) {
      it.fallStarted = false;
      it.vx = 0;
      it.vy = 0;
      it.vr = 0;
      it.playFormationLocked = false;
    }
  }
}

/**
 * ?debug=1 時: 形成ターゲット・ロック・主面ハイライト・役割色分け
 * @param {Phaser.Scene} scene
 * @param {ReturnType<typeof computePlayPanelLayoutForShardFormation>|null|undefined} layout
 * @param {object[]} items
 * @param {ReturnType<typeof getPlayFormationPresentationTuning>} fd
 * @param {string} [gfxProp='_playFormDebugGfx']
 */
function playFormationDebugOverlayFlagsActive(fd) {
  return Boolean(
    fd.showFormationTargets ||
      fd.showFormationLock ||
      fd.highlightCenterCore ||
      fd.showPlayFormationRoles ||
      fd.showPlayButtonMask ||
      fd.showRepairPatches ||
      fd.showRepairProcessing ||
      fd.showEdgeCracks,
  );
}

function syncPlayFormationDebugOverlay(scene, layout, items, fd, gfxProp = '_playFormDebugGfx') {
  if (!playFormationDebugSurfaceEnabled()) {
    try {
      scene[gfxProp]?.clear?.();
    } catch (_) {
      /* ignore */
    }
    return;
  }
  const want =
    Boolean(fd.showFormationTargets) ||
    Boolean(fd.showFormationLock) ||
    Boolean(fd.highlightCenterCore) ||
    Boolean(fd.showPlayFormationRoles);
  let g = scene[gfxProp];
  if (!want) {
    g?.clear?.();
    return;
  }
  if (!scene.add) return;
  if (!g || g.destroyed) {
    g = scene.add.graphics().setDepth(12000).setScrollFactor(0);
    scene[gfxProp] = g;
  }
  g.clear();
  const formItems = items.filter((it) => it.playFormation && typeof it.playTargetX === 'number');

  if (layout && fd.showFormationTargets) {
    g.lineStyle(1, 0x6cf0c8, 0.55);
    for (const it of formItems) {
      g.strokeCircle(it.playTargetX, it.playTargetY, 5);
    }
    g.lineStyle(1, 0xff8866, 0.35);
    g.strokeRect(layout.panelL, layout.panelT, layout.panelW, layout.panelH);
  }

  if (fd.showPlayFormationRoles) {
    const col = {
      centerCore: 0xffcc66,
      leftWing: 0x5cdbd0,
      rightWing: 0x5ca0ff,
      topCap: 0xaa88dd,
      bottomCap: 0xcc88aa,
    };
    for (const it of formItems) {
      const role = it.playFormationRole;
      if (!role) continue;
      const c = col[role] ?? 0xffffff;
      const rad = role === 'centerCore' ? 12 : 8;
      g.lineStyle(1.3, c, 0.72);
      g.strokeCircle(it.playTargetX, it.playTargetY, rad);
    }
  }

  if (fd.highlightCenterCore) {
    const cc = formItems.find((x) => x.playFormationRole === 'centerCore');
    if (cc && typeof cc.playTargetX === 'number') {
      g.lineStyle(2.8, 0xffee66, 0.9);
      g.strokeCircle(cc.playTargetX, cc.playTargetY, 24);
    }
  }

  if (fd.showFormationLock) {
    g.lineStyle(1.2, 0x9ad8ff, 0.72);
    for (const it of formItems) {
      if (!it.playFormationLocked) continue;
      const cx = typeof it.playTargetX === 'number' ? it.playTargetX : it.px;
      const cy = typeof it.playTargetY === 'number' ? it.playTargetY : it.py;
      g.strokeRect(cx - 6, cy - 6, 12, 12);
    }
  }
}

/**
 * @param {Phaser.Scene} bootScene
 * @param {number} collapseT ms since collapse start
 * @param {number} dt
 * @param {number} W
 * @param {number} H
 * @param {number} [collapseDurOpt] index.html の _collapseDur と同期
 */
export function updateBootBgCollapseFragments(bootScene, collapseT, dt, W, H, collapseDurOpt) {
  const items = bootScene._bootBgCollapseFragItems;
  if (!items?.length || !bootScene._bootBgShardPhysicsActive) return;

  const _perfT0 = playFormationDebugSurfaceEnabled() ? performance.now() : 0;

  const epoch = bootScene.game.registry.get(REG_BOOT_BG_FRAG_EPOCH_MS);
  const wallT =
    typeof epoch === 'number' && Number.isFinite(epoch) ? performance.now() - epoch : collapseT;

  const regDur = bootScene.game.registry?.get?.(REG_BOOT_COLLAPSE_DUR_MS);
  const collapseDur =
    typeof collapseDurOpt === 'number' && collapseDurOpt > 40
      ? collapseDurOpt
      : typeof regDur === 'number' && regDur > 40
        ? regDur
        : bootScene._collapseDur || 1080;
  const collapseNormMax = Math.max(1, getPlayFormationBootCollapseHandoffMul());
  const collapseNorm = Phaser.Math.Clamp(collapseT / collapseDur, 0, collapseNormMax);

  const pfTune = getPlayFormationPresentationTuning();
  const dbgGfx = playFormationDebugSurfaceEnabled();
  const overlayWanted = playFormationDebugOverlayFlagsActive(pfTune);
  const needPanelLayout = !bootScene._playFormationTargetsAssigned || (dbgGfx && overlayWanted);

  let layout = null;
  if (needPanelLayout) {
    const L = getHomeLayout(W, H);
    const disp = getHomeUrlBgDisplayOverrides();
    layout = computePlayPanelLayoutForShardFormation(
      bootScene,
      L,
      disp,
      HOME_PLAY_NEUTRAL_START_FRAME,
    );
  }
  const tgtRnd = mulberry32(((W | 0) ^ ((H | 0) << 15) ^ 0x62d1f403) >>> 0);
  if (!bootScene._playFormationTargetsAssigned) {
    ensurePlayFormationTargetsAssigned(bootScene, items, layout, tgtRnd);
  }
  const spd = Math.max(0.48, pfTune.playFormationSpeedMul);
  const formStart = Phaser.Math.Clamp(0.58 + (spd - 2.2) * 0.008, 0.55, 0.64);
  const rawFormEnd = formStart + (0.58 * spd) / 2.05;
  const endCap = Math.min(collapseNormMax - 0.02, 1.58);
  const formEnd = Math.min(endCap, Math.max(formStart + 0.24, rawFormEnd));
  const formSpan = Math.max(0.26, formEnd - formStart);
  let playFormRaw = 0;
  if (collapseNorm >= formStart) {
    playFormRaw = Phaser.Math.Clamp((collapseNorm - formStart) / formSpan, 0, 1);
  }
  const playFormEase = easeInOutCubic(smoothstep01(playFormRaw));
  const playFormDrift = playFormRaw < 0.28 ? Phaser.Math.Linear(0.12, 1, playFormRaw / 0.28) : 1;
  const playFormPull = smoothstep01(easeInOutSine(playFormRaw)) * playFormDrift;
  const lockDistPx = pfTune.playFormationOvershoot ? 10 : 8;
  const lockSpdPxPerMs = pfTune.playFormationOvershoot ? 0.095 : 0.072;

  const spec = bootScene._bootBgCollapseFaultSpec;
  const mainTop = spec ? spec.mainCy - spec.mainH * 0.5 : H * 0.3;
  const bandMid = mainTop + (spec?.mainH ?? H * 0.08) * 0.5;
  const bandPullX = W * 0.5;
  const bandPullY = bandMid;

  const uCrack = Phaser.Math.Clamp(collapseT / CRACK_MS, 0, 1);
  const eCrack = easeOutCubic(uCrack);
  const tune = readCollapseShardTuning();
  const vis = readShardVisualFlags();

  for (const it of items) {
    if (!it.container || it.container.destroyed) continue;

    let x;
    let y;
    let rot;

    if (collapseT < CRACK_MS) {
      x = Phaser.Math.Linear(it.restX, it.crackX, eCrack);
      y = Phaser.Math.Linear(it.restY, it.crackY, eCrack);
      rot = Phaser.Math.Linear(0, it.crackR, eCrack);
    } else if (collapseT < GAP_END_MS) {
      const uGap = easeInOutCubic((collapseT - CRACK_MS) / (GAP_END_MS - CRACK_MS));
      x = Phaser.Math.Linear(it.crackX, it.gapX, uGap);
      y = Phaser.Math.Linear(it.crackY, it.gapY, uGap);
      rot = Phaser.Math.Linear(it.crackR, it.gapR, uGap);
    } else {
      if (!it.fallStarted) {
        it.fallStarted = true;
        it.px = it.gapX;
        it.py = it.gapY;
        it.pr = it.gapR;
        it.vx = it.vx0;
        it.vy = it.vy0;
        it.vr = it.vr0;
      }

      if (it.playFormation && it.playFormationLocked && typeof it.playTargetX === 'number') {
        it.vx = 0;
        it.vy = 0;
        it.vr = 0;
        it.px = it.playTargetX;
        it.py = it.playTargetY;
        it.pr = it.playTargetRot;
      } else {
        let ayEff = it.ay;
        if (it.playFormation) {
          if (collapseNorm > 0.42 && collapseNorm < formStart + 0.05) {
            const wob = Phaser.Math.Clamp((collapseNorm - 0.42) / Math.max(0.08, formStart - 0.41), 0, 1);
            ayEff *= Phaser.Math.Linear(1, 0.52, wob);
          }
        } else if (collapseNorm > 0.38) {
          const uR = Phaser.Math.Clamp((collapseNorm - 0.38) / 0.58, 0, 1);
          const rm = it.retireMode ?? 1;
          if (rm === 1) {
            const ex = it.px < W * 0.5 ? -1.38 : 1.38;
            it.vx += ex * 0.00031 * uR * dt;
            it.vy -= 0.00009 * uR * dt;
          } else if (rm === 2) {
            ayEff *= Phaser.Math.Linear(1, 0.38, uR);
            it.vx *= Math.pow(0.9955, dt / 16.67);
            it.vy *= Math.pow(0.9955, dt / 16.67);
          } else {
            ayEff *= Phaser.Math.Linear(1, 0.62, uR);
          }
        }

        it.vy += ayEff * dt;
        const airDrag = it.playFormation ? 0.9935 : 0.992;
        it.vx *= Math.pow(airDrag, dt / 16.67);
        it.vy *= Math.pow(airDrag, dt / 16.67);
        it.vr *= Math.pow(0.9992, dt / 16.67);

        if (it.suckBand && !it.playFormation && collapseT > GAP_END_MS + 95) {
          const post = collapseT - GAP_END_MS;
          const tug = Phaser.Math.Clamp((post - 95) / 420, 0, 1) * 0.42;
          it.vx += ((bandPullX - it.px) * 0.00009 + (rndBandTug(it) - 0.5) * 0.02) * tug;
          it.vy += ((bandPullY - it.py) * 0.00011 + (rndBandTug(it) - 0.5) * 0.015) * tug;
        }

        if (it.playFormation && typeof it.playTargetX === 'number' && collapseNorm >= formStart) {
          const pull = playFormPull * (0.08 + 0.92 * playFormEase);
          const dx = it.playTargetX - it.px;
          const dy = it.playTargetY - it.py;
          const kxy = 0.0000115 * (0.12 + 0.88 * pull) * (pfTune.playFormationOvershoot ? 1.22 : 1);
          const kRot = 0.000018 * (0.12 + 0.88 * pull);
          const cd = (pfTune.playFormationOvershoot ? 1.12 : 1.38) * Math.sqrt(Math.max(kxy, 1e-12)) * (0.88 + 0.12 * playFormEase);
          it.vx += (dx * kxy - it.vx * cd) * dt;
          it.vy += (dy * kxy * 0.95 - it.vy * cd) * dt;
          const dRot = it.playTargetRot - it.pr;
          it.vr += (dRot * kRot - it.vr * cd * 0.82) * dt;
          if (playFormEase > 0.55) {
            const settleD = Math.pow(0.987, dt / 16.67);
            it.vx *= settleD;
            it.vy *= settleD;
            it.vr *= Math.pow(0.985, dt / 16.67);
          }
        }

        it.px += it.vx * dt;
        it.py += it.vy * dt;
        it.pr += it.vr * dt;

        if (
          it.playFormation &&
          !it.playFormationLocked &&
          typeof it.playTargetX === 'number' &&
          collapseNorm >= formStart
        ) {
          const ddx = it.playTargetX - it.px;
          const ddy = it.playTargetY - it.py;
          const dist = Math.hypot(ddx, ddy);
          const sp = Math.hypot(it.vx, it.vy);
          if (dist < lockDistPx && sp < lockSpdPxPerMs) {
            it.playFormationLocked = true;
            it.px = it.playTargetX;
            it.py = it.playTargetY;
            it.pr = it.playTargetRot;
            it.vx = 0;
            it.vy = 0;
            it.vr = 0;
          }
        }
      }
      x = it.px;
      y = it.py;
      rot = it.pr;
    }

    it.container.setPosition(x, y);
    it.container.setRotation(rot);

    if (it.playFormation && collapseNorm > 0.46) {
      const layer = typeof it.playFormationDepthIdx === 'number' ? it.playFormationDepthIdx : 0;
      it.container.setDepth(
        PLAY_SHARD_FORMATION_DEPTH +
          layer * PLAY_FORM_SHARD_DEPTH_STEP +
          (it.depth01 - 0.5) * 0.034,
      );
    }

    let baseA = BASE_SHARD_ALPHA;
    if (!tune.noDim && pointInFaultBands(x, y, spec, W)) {
      let dim = BAND_ALPHA_MULT;
      if (collapseT < GAP_END_MS + 100) {
        dim = Phaser.Math.Linear(1, BAND_ALPHA_MULT, Phaser.Math.Clamp(collapseT / (GAP_END_MS + 100), 0, 1));
      }
      baseA *= dim;
    }
    if (!tune.noFade && it.fadeEarly && wallT > GAP_END_MS + 140) {
      const uFade = Phaser.Math.Clamp((wallT - (GAP_END_MS + 140)) / 480, 0, 1);
      baseA *= 1 - easeInQuad(uFade);
    }
    if (!it.playFormation && collapseNorm > 0.44) {
      const wf = Phaser.Math.Clamp((collapseNorm - 0.44) / 0.52, 0, 1);
      const rm = it.retireMode ?? 1;
      if (rm === 2) baseA *= 1 - 0.42 * wf * wf;
      else if (rm === 3) baseA *= 1 - 0.28 * wf;
      else if (rm === 1 && collapseNorm > 0.72) baseA *= 1 - 0.18 * Phaser.Math.Clamp((collapseNorm - 0.72) / 0.35, 0, 1);
    }

    const depthA = vis.shardDepthFade ? Phaser.Math.Linear(0.76, 1, it.depth01) : 1;
    const depthScale = vis.shardDepthFade ? Phaser.Math.Linear(0.982, 1.048, it.depth01) : 1;
    const roleScale = it.playFormation ? _playFormRoleScale(it.playFormationRole) : { x: 1, y: 1 };
    it.container.setScale(depthScale * roleScale.x, depthScale * roleScale.y);

    let lb = 1;
    if (vis.shardLighting) {
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      const wx = it.facetNx * cr - it.facetNy * sr;
      const wy = it.facetNx * sr + it.facetNy * cr;
      const shade = Phaser.Math.Clamp(wx * SHARD_LIGHT_TO_X + wy * SHARD_LIGHT_TO_Y, -1, 1);
      lb = Phaser.Math.Clamp(0.97 + shade * it.lightShadeAmp, 0.93, 1.03);
    }
    let db = 1;
    let dContr = 1;
    if (vis.shardDepthFade) {
      db = Phaser.Math.Linear(0.94, 1.02, it.depth01);
      dContr = Phaser.Math.Linear(0.97, 1, it.depth01);
    }
    const roleLightMul = it.playFormation ? _playFormRoleLightMul(it.playFormationRole) : 1;
    const comb = Phaser.Math.Clamp(lb * db * dContr * roleLightMul, 0.9, 1.075);
    const bi = Math.round(comb * 255);
    const tr = Phaser.Math.Clamp(Math.round(bi * 0.98), 0, 255);
    const tg = Phaser.Math.Clamp(Math.round(bi * 0.996), 0, 255);
    const tb = Phaser.Math.Clamp(Math.round(bi * 1.012), 0, 255);
    it.img.setTint((tr << 16) | (tg << 8) | tb);

    const roleAlphaMul = it.playFormation ? _playFormRoleAlphaMul(it.playFormationRole) : 1;

    if (tune.solidAlpha) {
      it.img.setAlpha(Phaser.Math.Clamp(depthA * roleAlphaMul, 0.04, 1));
    } else if (playFormationDebugSurfaceEnabled()) {
      const pulse = 0.82 + Math.sin(collapseT * 0.003) * 0.06;
      it.img.setAlpha(Phaser.Math.Clamp(pulse * depthA * roleAlphaMul, 0.04, 1));
    } else {
      const minPieceA = Phaser.Math.Linear(0.62, 0.78, Phaser.Math.Clamp(uCrack * 1.25, 0, 1));
      const aPiece = Phaser.Math.Clamp(baseA, minPieceA, 1);
      it.img.setAlpha(Phaser.Math.Clamp(aPiece * depthA * roleAlphaMul, 0.04, 1));
    }
  }

  if (dbgGfx) {
    syncPlayFormationDebugOverlay(bootScene, layout, items, pfTune, '_playFormDebugGfx');
  } else if (bootScene._playFormDebugGfx && !bootScene._playFormDebugGfx.destroyed) {
    bootScene._playFormDebugGfx.clear();
  }

  if (_perfT0) {
    const formationShardCount = items.filter((it) => it.playFormation).length;
    logPerfPlayFormSample({
      collapseT: Math.round(collapseT),
      formationShardCount,
      debugOverlayActive: overlayWanted,
      updateMs: Math.round(performance.now() - _perfT0),
    });
  }
}

function rndBandTug(it) {
  return Math.sin((it.bandBias || 0) * 12.9898 + it.restX * 0.01) * 0.5 + 0.5;
}

/**
 * collapse 完了時: PLAY 形成シャードを Boot ルートから切り離し Home へ（destroy 前に呼ぶ）
 * @param {Phaser.Scene} bootScene
 * @param {Phaser.Scene} homeScene
 */
export function extractPlayFormationShardsToHome(bootScene, homeScene) {
  const items = bootScene._bootBgCollapseFragItems;
  const root = bootScene._bootBgShardRoot;
  if (!items?.length || !homeScene) return;
  const kept = [];
  for (const it of items) {
    if (!it.playFormation || !it.container || it.container.destroyed) continue;
    try {
      if (root && !root.destroyed && it.container.parentContainer === root) {
        root.remove(it.container, false);
      }
    } catch (_) {
      /* ignore */
    }
    homeScene.add.existing(it.container);
    const layer = typeof it.playFormationDepthIdx === 'number' ? it.playFormationDepthIdx : 0;
    it.container.setDepth(PLAY_SHARD_FORMATION_DEPTH + layer * PLAY_FORM_SHARD_DEPTH_STEP + 0.02);
    it.extractedToHome = true;
    kept.push(it);
  }
  if (kept.length) {
    homeScene._playFormationShardItems = kept;
    homeScene._playFormationShardBgActive = true;
    homeScene._playFormationTailIdle = false;
    homeScene._playFormationPhysicsDoneWall = undefined;
    homeScene._playFormationTailFinalized = false;
    homeScene._playFormationAllLockedAt = undefined;
    const dbg = getPlayFormationPresentationTuning();
    if (playFormationDebugSurfaceEnabled() && dbg.showPlayFormation) {
      console.log('[PLAY_FORMATION:jlwm14]', {
        transferred: kept.length,
        collapseDurMs: homeScene.game.registry?.get?.(REG_BOOT_COLLAPSE_DUR_MS) ?? null,
      });
    }
    logPlayFormationDebugParamsOnce(homeScene);
  }
  bootScene._bootBgCollapseFragItems = items.filter((it) => !it.extractedToHome);
}

function repairPhaseMsFromItems(items, dur) {
  const b = typeof items?.[0]?.bandBias === 'number' ? items[0].bandBias : 0.41;
  const n = Math.abs(Math.sin(b * 19.37 + dur * 0.0013));
  return 180 + n * 140;
}

function repairProgress01(wallMs, startMs, spanMs) {
  if (typeof startMs !== 'number' || !Number.isFinite(startMs)) return 0;
  return Phaser.Math.Clamp((wallMs - startMs) / Math.max(1, spanMs), 0, 1);
}

function repairCrackReveal01(wallMs, startMs, spanMs) {
  if (typeof startMs !== 'number' || !Number.isFinite(startMs)) return 0;
  return smoothstep01((wallMs - (startMs + spanMs)) / 170);
}

function ensurePlayRepairNudgeTargets(homeScene, items, rect) {
  if (!homeScene || !items?.length || !rect) return;
  const key = [
    Math.round(rect.cx),
    Math.round(rect.cy),
    Math.round(rect.w),
    Math.round(rect.h),
    items.length,
  ].join(':');
  if (homeScene._playRepairNudgeKey === key) return;
  homeScene._playRepairNudgeKey = key;
  const roles = ['centerCore', 'leftWing', 'rightWing', 'topCap', 'bottomCap'];
  for (const it of items) {
    if (typeof it.playTargetX !== 'number' || typeof it.playTargetY !== 'number') continue;
    const roleIdx = Math.max(0, roles.indexOf(it.playFormationRole));
    const seed =
      (roleIdx + 1) * 17.13 +
      (typeof it.bandBias === 'number' ? it.bandBias * 31 : 0) +
      (typeof it.restX === 'number' ? it.restX * 0.003 : 0);
    const rnd = Math.abs(Math.sin(seed * 12.9898 + 78.233));
    const amount = 1 + (rnd - Math.floor(rnd)) * 3;
    const dx = it.playTargetX - rect.cx;
    const dy = it.playTargetY - rect.cy;
    const ax = Math.abs(dx) / Math.max(1, rect.w * 0.5);
    const ay = Math.abs(dy) / Math.max(1, rect.h * 0.5);
    const inwardX = ax > 0.28 ? -Math.sign(dx) * amount : (rnd - 0.5) * 1.2;
    const inwardY = ay > 0.24 ? -Math.sign(dy) * amount * 0.72 : (0.5 - rnd) * 0.9;
    it.playRepairTargetX = it.playTargetX + inwardX;
    it.playRepairTargetY = it.playTargetY + inwardY;
    it.playRepairTargetRot =
      it.playTargetRot + Phaser.Math.DegToRad((0.5 - rnd) * (it.playFormationRole === 'centerCore' ? 0.8 : 1.6));
  }
}

function getPlayRepairTarget(it, repairShift01) {
  const u = easeInOutSine(Phaser.Math.Clamp(repairShift01, 0, 1));
  const rx = typeof it.playRepairTargetX === 'number' ? it.playRepairTargetX : it.playTargetX;
  const ry = typeof it.playRepairTargetY === 'number' ? it.playRepairTargetY : it.playTargetY;
  const rr = typeof it.playRepairTargetRot === 'number' ? it.playRepairTargetRot : it.playTargetRot;
  return {
    x: Phaser.Math.Linear(it.playTargetX, rx, u),
    y: Phaser.Math.Linear(it.playTargetY, ry, u),
    rot: Phaser.Math.Linear(it.playTargetRot, rr, u),
  };
}

/**
 * Home overlap 経過時間で PLAY 形成シャードを微収束させ、パネルへクロスフェードする。
 * @param {Phaser.Scene} homeScene
 * @param {number} wallMs overlapRebuildT0 からの経過 ms
 * @param {number} dt
 * @returns {boolean} 物理 tail 完了（disableDefaultPlayPanel 既定時は破片を残す）
 */
export function updatePlayFormationShardTail(homeScene, wallMs, dt) {
  const items = homeScene._playFormationShardItems;
  if (!items?.length) {
    destroyPlayRepairButton(homeScene);
    try {
      homeScene._playFormHomeDebugGfx?.destroy?.();
    } catch (_) {
      /* ignore */
    }
    homeScene._playFormHomeDebugGfx = null;
    return true;
  }
  const _perfT0 = playFormationDebugSurfaceEnabled() ? performance.now() : 0;
  const tune = getPlayFormationPresentationTuning();
  const speedMul = Math.max(0.48, tune.playFormationSpeedMul);
  const regDur = homeScene.game.registry?.get?.(REG_BOOT_COLLAPSE_DUR_MS);
  const dur = typeof regDur === 'number' && regDur > 40 ? regDur : 1080;
  const nWall = wallMs / (dur * 0.9 * speedMul);
  const cross = smoothstep01(Phaser.Math.Clamp((nWall - 0.36) / 0.78, 0, 1));
  const settle = smoothstep01(Phaser.Math.Clamp((nWall - 0.28) / 0.82, 0, 1));
  const settleEase = easeInOutSine(settle);

  const lockDistPx = tune.playFormationOvershoot ? 10 : 8;
  const lockSpdPxPerMs = tune.playFormationOvershoot ? 0.09 : 0.068;

  const bias =
    typeof items[0]?.bandBias === 'number' && Number.isFinite(items[0].bandBias)
      ? items[0].bandBias
      : 0.35;
  const settleHoldMs = 120 + Math.abs(Math.sin(bias * 11.7 + dur * 0.0007)) * 98;
  const repairSpanMs = repairPhaseMsFromItems(items, dur);
  const repairStartMs =
    typeof homeScene._playFormationAllLockedAt === 'number'
      ? homeScene._playFormationAllLockedAt + Math.max(0, settleHoldMs - 40)
      : Infinity;
  const repairLinear = tune.disableRepairProcessing
    ? 1
    : repairProgress01(wallMs, repairStartMs, repairSpanMs);
  const repairStrength = tune.disableDefaultPlayPanel
    ? tune.disableRepairProcessing
      ? 1
      : smoothstep01(repairLinear)
    : cross;
  const repairActive =
    tune.disableDefaultPlayPanel &&
    !tune.disableRepairProcessing &&
    typeof repairStartMs === 'number' &&
    Number.isFinite(repairStartMs) &&
    wallMs >= repairStartMs &&
    repairLinear < 1;
  const repairPulse = repairActive ? Math.sin(Math.PI * repairLinear) : 0;
  const repairShift01 =
    tune.disableDefaultPlayPanel && !tune.disableRepairProcessing
      ? smoothstep01((repairLinear - 0.18) / 0.64)
      : 0;
  const repairCrackReveal =
    tune.disableDefaultPlayPanel && !tune.disableRepairProcessing
      ? repairCrackReveal01(wallMs, repairStartMs, repairSpanMs)
      : 0;

  let repairLayout = null;
  let repairRect = null;
  if (tune.disableDefaultPlayPanel) {
    const W = homeScene.scale?.width ?? homeScene.sys?.game?.config?.width ?? 800;
    const H = homeScene.scale?.height ?? homeScene.sys?.game?.config?.height ?? 600;
    const L = getHomeLayout(W, H);
    const disp = getHomeUrlBgDisplayOverrides();
    repairLayout = computePlayPanelLayoutForShardFormation(
      homeScene,
      L,
      disp,
      HOME_PLAY_NEUTRAL_START_FRAME,
    );
    repairRect = computePlayRepairButtonRect(repairLayout);
    if (!tune.disableRepairProcessing) {
      ensurePlayRepairNudgeTargets(homeScene, items, repairRect);
    }
  }

  let maxErr = 0;
  for (const it of items) {
    if (!it.container || it.container.destroyed || !it.img || it.img.destroyed) continue;
    if (typeof it.playTargetX !== 'number') continue;
    const repairTarget = getPlayRepairTarget(it, repairShift01);

    if (it.playFormationLocked) {
      it.vx = 0;
      it.vy = 0;
      it.vr = 0;
      it.px = repairTarget.x;
      it.py = repairTarget.y;
      it.pr = repairTarget.rot;
      it.container.setPosition(it.px, it.py);
      it.container.setRotation(it.pr);
    } else {
      const dx = repairTarget.x - it.px;
      const dy = repairTarget.y - it.py;
      const dist = Math.hypot(dx, dy);
      maxErr = Math.max(maxErr, dist);
      const k = 0.000024 * (0.18 + 0.82 * settleEase);
      const cd = 1.36 * Math.sqrt(Math.max(k, 1e-12));
      it.vx += (dx * k - it.vx * cd) * dt;
      it.vy += (dy * k * 0.96 - it.vy * cd) * dt;
      const dr = repairTarget.rot - it.pr;
      const kR = 0.00002 * (0.18 + 0.82 * settleEase);
      it.vr += (dr * kR - it.vr * cd * 0.78) * dt;
      it.vx *= Math.pow(0.991, dt / 16.67);
      it.vy *= Math.pow(0.991, dt / 16.67);
      it.vr *= Math.pow(0.99, dt / 16.67);
      it.px += it.vx * dt;
      it.py += it.vy * dt;
      it.pr += it.vr * dt;
      const sp = Math.hypot(it.vx, it.vy);
      if (dist < lockDistPx && sp < lockSpdPxPerMs) {
        it.playFormationLocked = true;
        it.px = repairTarget.x;
        it.py = repairTarget.y;
        it.pr = repairTarget.rot;
        it.vx = 0;
        it.vy = 0;
        it.vr = 0;
      }
      it.container.setPosition(it.px, it.py);
      it.container.setRotation(it.pr);
    }

    const roleScale = _playFormRoleScale(it.playFormationRole);
    it.container.setScale(roleScale.x, roleScale.y);

    if (tune.disableDefaultPlayPanel) {
      let shardA = Phaser.Math.Clamp(0.84 + 0.12 * easeInOutSine(cross * 0.42), 0.72, 0.97);
      if (!tune.disableRepairProcessing) {
        shardA *= 1 - repairPulse * 0.035;
        shardA *= Phaser.Math.Linear(1, 1.018, repairShift01);
      }
      shardA = Phaser.Math.Clamp(shardA * _playFormRoleAlphaMul(it.playFormationRole), 0.58, 0.99);
      it.img.setAlpha(shardA);
      if (!tune.disableRepairProcessing && repairShift01 > 0.02) {
        const tint = repairActive ? 0xe8eaec : 0xf0f1ef;
        it.img.setTint(tint);
      }
    } else {
      const shardA = Phaser.Math.Clamp(0.94 * (1 - cross * 0.88), 0.04, 1);
      it.img.setAlpha(shardA);
    }
  }

  const allLocked = items.every(
    (it) =>
      it.playFormationLocked &&
      typeof it.playTargetX === 'number' &&
      it.container &&
      !it.container.destroyed,
  );
  if (allLocked) {
    if (homeScene._playFormationAllLockedAt == null) {
      homeScene._playFormationAllLockedAt = wallMs;
    }
  } else {
    homeScene._playFormationAllLockedAt = undefined;
  }

  if (tune.disableDefaultPlayPanel) {
    homeScene._playFormationPanelRevealMul = Phaser.Math.Linear(
      0.04,
      0.11,
      easeInOutCubic(smoothstep01(cross)),
    );
    homeScene._playFormationShardBgActive = true;
  } else {
    homeScene._playFormationPanelRevealMul = Phaser.Math.Linear(0.05, 1, cross);
  }

  const lockedLong =
    typeof homeScene._playFormationAllLockedAt === 'number' &&
    wallMs - homeScene._playFormationAllLockedAt >= settleHoldMs;

  if (tune.disableDefaultPlayPanel) {
    homeScene._playRepairGlyphContrastMul = tune.disableRepairProcessing
      ? 1
      : Phaser.Math.Linear(1, 1.055, repairShift01);
    syncPlayRepairButton(homeScene, repairLayout, items, repairStrength, tune, {
      active: repairActive,
      progress: repairLinear,
      processingPulse: repairPulse,
      crackReveal: repairCrackReveal,
    });
  } else {
    homeScene._playRepairGlyphContrastMul = 1;
  }

  let done = false;
  if (tune.disableDefaultPlayPanel) {
    done =
      allLocked &&
      lockedLong &&
      nWall >= 0.4 &&
      repairStrength >= 0.985 &&
      (tune.disableRepairProcessing || repairCrackReveal >= 0.985);
  } else {
    done = nWall >= 1.12 || (nWall >= 0.96 && maxErr < 16);
  }

  if (done && tune.disableDefaultPlayPanel && !homeScene._playFormationTailFinalized) {
    homeScene._playFormationTailFinalized = true;
    homeScene._playFormationPanelRevealMul = 0.09;
    homeScene._playRepairGlyphContrastMul = tune.disableRepairProcessing ? 1 : 1.055;
    if (repairLayout) {
      syncPlayRepairButton(homeScene, repairLayout, items, 1, tune, {
        active: false,
        progress: 1,
        processingPulse: 0,
        crackReveal: tune.disableRepairProcessing ? 0 : 1,
      });
    }
  }

  if (done) {
    try {
      homeScene._playFormHomeDebugGfx?.destroy?.();
    } catch (_) {
      /* ignore */
    }
    homeScene._playFormHomeDebugGfx = null;
    try {
      homeScene.game.registry.remove(REG_BOOT_COLLAPSE_DUR_MS);
    } catch (_) {
      /* ignore */
    }
    if (tune.disableDefaultPlayPanel) {
      return true;
    }
    for (const it of items) {
      try {
        it.container?.destroy?.(true);
      } catch (_) {
        /* ignore */
      }
      const k = it.texKey;
      if (k && homeScene.textures?.exists?.(k)) {
        try {
          homeScene.textures.remove(k);
        } catch (_) {
          /* ignore */
        }
      }
    }
    homeScene._playFormationShardItems = null;
    homeScene._playFormationPanelRevealMul = undefined;
    homeScene._playFormationShardBgActive = false;
    return true;
  }

  const fdTail = tune;
  const dbgSurface = playFormationDebugSurfaceEnabled();
  const overlayTailWanted = playFormationDebugOverlayFlagsActive(fdTail);
  if (dbgSurface && overlayTailWanted) {
    const W = homeScene.scale?.width ?? homeScene.sys?.game?.config?.width ?? 800;
    const H = homeScene.scale?.height ?? homeScene.sys?.game?.config?.height ?? 600;
    const L = getHomeLayout(W, H);
    const disp = getHomeUrlBgDisplayOverrides();
    const dbgLayout = computePlayPanelLayoutForShardFormation(
      homeScene,
      L,
      disp,
      HOME_PLAY_NEUTRAL_START_FRAME,
    );
    syncPlayFormationDebugOverlay(homeScene, dbgLayout, items, fdTail, '_playFormHomeDebugGfx');
  } else if (homeScene._playFormHomeDebugGfx && !homeScene._playFormHomeDebugGfx.destroyed) {
    try {
      homeScene._playFormHomeDebugGfx.destroy();
    } catch (_) {
      /* ignore */
    }
    homeScene._playFormHomeDebugGfx = null;
  }

  if (_perfT0) {
    logPerfPlayFormSample({
      collapseT: Math.round(wallMs),
      formationShardCount: items.filter((it) => it.playFormation).length,
      debugOverlayActive: overlayTailWanted,
      updateMs: Math.round(performance.now() - _perfT0),
    });
  }

  return false;
}

/**
 * @param {Phaser.Scene} bootScene
 */
export function destroyBootBgCollapseFragments(bootScene) {
  const items = bootScene._bootBgCollapseFragItems;
  const texKeys = items?.length ? items.map((it) => it.texKey).filter(Boolean) : [];
  try {
    bootScene._playFormDebugGfx?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  bootScene._playFormDebugGfx = null;
  bootScene._playFormationTargetsAssigned = false;
  bootScene._playFormRoleDebugLogged = false;
  try {
    bootScene._bootBgShardRoot?.destroy?.(true);
  } catch (_) {
    /* ignore */
  }
  bootScene._bootBgShardRoot = null;
  bootScene._bootBgCollapseFragItems = null;
  bootScene._bootBgCollapseFaultSpec = null;
  bootScene._bootBgShardPhysicsActive = false;
  bootScene.game.registry.remove(REG_BOOT_BG_FRAG_EPOCH_MS);
  for (const k of texKeys) {
    try {
      if (k && bootScene.textures.exists(k)) bootScene.textures.remove(k);
    } catch (_) {
      /* ignore */
    }
  }
}
