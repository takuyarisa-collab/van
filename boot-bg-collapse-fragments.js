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

const CRACK_MS = 138;
const BASE_SHARD_ALPHA = 0.96;
const BAND_ALPHA_MULT = 0.82;

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
 * Canvas clip でポリゴン領域を焼き込み、Phaser の canvas テクスチャとして登録。
 * @returns {{ texKey: string, dispW: number, dispH: number, localPts: {x:number,y:number}[] }}
 */
function bakeShardCanvasTexture(bootScene, texKey, ptsTex, cropL, cropT, cropW, cropH, dispW, dispH, uniqueKey) {
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

  for (let di = 0; di < cells.length; di++) {
    const ptsTex0 = cells[di].poly.map((p) => ({
      x: Phaser.Math.Clamp(p.x, 0.5, natW - 0.5),
      y: Phaser.Math.Clamp(p.y, 0.5, natH - 0.5),
    }));
    const bb = bboxOfPoly(ptsTex0);
    const padPx = 1;
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
    );
    if (!baked) continue;

    const restW = texToWorld(cenTex.x, cenTex.y);
    const mass = Math.max(400, cells[di].area);
    const sizeRank = Math.sqrt(mass / (natW * natH));

    const towardX = cenTex.x - natW * 0.5;
    const towardY = cenTex.y - natH * 0.5;
    const len = Math.hypot(towardX, towardY) + 1e-6;
    const nx = towardX / len;
    const ny = towardY / len;
    const sep = (3 + rnd() * 10) * bgScale * (0.55 + sizeRank);
    const crackDxW = nx * sep * (0.4 + rnd() * 0.9) + (rnd() - 0.5) * 4.2 * bgScale;
    const crackDyW = ny * sep * (0.35 + rnd() * 0.85) + (rnd() - 0.5) * 3.8 * bgScale;
    const crackRot = Phaser.Math.DegToRad((rnd() - 0.5) * (14 + 52 * (1 - sizeRank * 0.65)));
    const depthNudge = (rnd() - 0.5) * 0.08;

    const lateralBoost = rnd() < 0.18 ? (rnd() - 0.5) * 0.55 * bgScale : 0;
    const vx0 = (rnd() - 0.5) * 0.095 * (1.15 - sizeRank * 0.35) + lateralBoost;
    const vy0 = 0.055 + rnd() * 0.12 + (1 - sizeRank) * 0.05;
    const vr0 = Phaser.Math.DegToRad(((rnd() - 0.5) * 0.055) / (0.65 + sizeRank));

    const ay = (0.00028 + rnd() * 0.00012) / Math.sqrt(mass / 9000);
    const suckBand = rnd() < 0.38;
    const fadeEarly = mass < (natW * natH) * 0.012 && rnd() < 0.55;
    const bandBias = rnd();

    const img = bootScene.add.image(0, 0, baked.texKey).setOrigin(0.5, 0.5);
    img.setDisplaySize(baked.dispW, baked.dispH);

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
      crackX: restW.x + crackDxW,
      crackY: restW.y + crackDyW,
      crackR: crackRot,
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

  for (const it of items) {
    if (!it.container || it.container.destroyed) continue;

    let x;
    let y;
    let rot;

    if (collapseT < CRACK_MS) {
      x = Phaser.Math.Linear(it.restX, it.crackX, eCrack);
      y = Phaser.Math.Linear(it.restY, it.crackY, eCrack);
      rot = Phaser.Math.Linear(0, it.crackR, eCrack);
    } else {
      if (!it.fallStarted) {
        it.fallStarted = true;
        it.px = it.crackX;
        it.py = it.crackY;
        it.pr = it.crackR;
        it.vx = it.vx0;
        it.vy = it.vy0;
        it.vr = it.vr0;
      }
      it.vy += it.ay * dt;
      it.vx *= Math.pow(0.985, dt / 16.67);
      it.vr *= Math.pow(0.9988, dt / 16.67);

      if (it.suckBand && collapseT > CRACK_MS + 95) {
        const post = collapseT - CRACK_MS;
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
    if (pointInFaultBands(x, y, spec, W)) {
      baseA *= BAND_ALPHA_MULT;
    }
    if (it.fadeEarly && wallT > 520) {
      const uFade = Phaser.Math.Clamp((wallT - 520) / 420, 0, 1);
      baseA *= 1 - easeInQuad(uFade);
    }
    if (homeUrlDebugEnabled()) {
      it.img.setAlpha(Phaser.Math.Clamp(0.82 + Math.sin(collapseT * 0.003) * 0.06, 0.78, 0.95));
    } else {
      it.img.setAlpha(Phaser.Math.Clamp(baseA, 0.52, 1));
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
