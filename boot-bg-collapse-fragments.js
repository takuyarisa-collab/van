/**
 * Boot 背景: Voronoi 非矩形断片を create 時に焼き込み配置し、1 枚の板に見せる。
 * collapse 開始後のみ割れ・回転・落下。Canvas clip のみ（GeometryMask 不使用）。
 * 演出終了は Home 側 destroyBootBgPanelForHome で破棄（テクスチャ remove 含む）。
 */

import { homeUrlDebugEnabled } from './home-url-debug.js';

/** Boot collapse 開始と同一時刻でセットし、Home の registry 削除後も残す */
export const REG_BOOT_BG_FRAG_EPOCH_MS = 'bootBgFragEpochMs';

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
    if (homeUrlDebugEnabled()) {
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
    }
  }
}

/**
 * @param {Phaser.Scene} bootScene
 * @param {number} collapseT ms since collapse start
 * @param {number} dt
 * @param {number} W
 * @param {number} H
 */
export function updateBootBgCollapseFragments(bootScene, collapseT, dt, W, H) {
  const items = bootScene._bootBgCollapseFragItems;
  if (!items?.length || !bootScene._bootBgShardPhysicsActive) return;

  const epoch = bootScene.game.registry.get(REG_BOOT_BG_FRAG_EPOCH_MS);
  const wallT =
    typeof epoch === 'number' && Number.isFinite(epoch) ? performance.now() - epoch : collapseT;

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
      it.vy += it.ay * dt;
      it.vx *= Math.pow(0.992, dt / 16.67);
      it.vr *= Math.pow(0.9992, dt / 16.67);

      if (it.suckBand && collapseT > GAP_END_MS + 95) {
        const post = collapseT - GAP_END_MS;
        const tug = Phaser.Math.Clamp((post - 95) / 420, 0, 1) * 0.42;
        it.vx += ((bandPullX - it.px) * 0.00009 + (rndBandTug(it) - 0.5) * 0.02) * tug;
        it.vy += ((bandPullY - it.py) * 0.00011 + (rndBandTug(it) - 0.5) * 0.015) * tug;
      }

      it.px += it.vx * dt;
      it.py += it.vy * dt;
      it.pr += it.vr * dt;
      x = it.px;
      y = it.py;
      rot = it.pr;
    }

    it.container.setPosition(x, y);
    it.container.setRotation(rot);

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

    const depthA = vis.shardDepthFade ? Phaser.Math.Linear(0.76, 1, it.depth01) : 1;
    const depthScale = vis.shardDepthFade ? Phaser.Math.Linear(0.982, 1.048, it.depth01) : 1;
    it.container.setScale(depthScale);

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
    const comb = Phaser.Math.Clamp(lb * db * dContr, 0.9, 1.04);
    const bi = Math.round(comb * 255);
    const tr = Phaser.Math.Clamp(Math.round(bi * 0.98), 0, 255);
    const tg = Phaser.Math.Clamp(Math.round(bi * 0.996), 0, 255);
    const tb = Phaser.Math.Clamp(Math.round(bi * 1.012), 0, 255);
    it.img.setTint((tr << 16) | (tg << 8) | tb);

    if (tune.solidAlpha) {
      it.img.setAlpha(Phaser.Math.Clamp(depthA, 0.04, 1));
    } else if (homeUrlDebugEnabled()) {
      const pulse = 0.82 + Math.sin(collapseT * 0.003) * 0.06;
      it.img.setAlpha(Phaser.Math.Clamp(pulse * depthA, 0.04, 1));
    } else {
      const minPieceA = Phaser.Math.Linear(0.62, 0.78, Phaser.Math.Clamp(uCrack * 1.25, 0, 1));
      const aPiece = Phaser.Math.Clamp(baseA, minPieceA, 1);
      it.img.setAlpha(Phaser.Math.Clamp(aPiece * depthA, 0.04, 1));
    }
  }
}

function rndBandTug(it) {
  return Math.sin((it.bandBias || 0) * 12.9898 + it.restX * 0.01) * 0.5 + 0.5;
}

/**
 * @param {Phaser.Scene} bootScene
 */
export function destroyBootBgCollapseFragments(bootScene) {
  const items = bootScene._bootBgCollapseFragItems;
  const texKeys = items?.length ? items.map((it) => it.texKey).filter(Boolean) : [];
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
