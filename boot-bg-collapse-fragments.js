/**
 * Boot 崩壊時: home-bg-normal を非矩形ポリゴン断片に分割し飛散・一部を Home PLAY/SUB 位置へ収束。
 * 演出終了後は必ず destroy。毎フレームの新規生成はしない。
 */

import { getHomeLayout } from './home-layout.js';
import { HOME_BG_PANEL_CROPS } from './home-bg-panel-crops.js';
import { homeUrlDebugEnabled } from './home-url-debug.js';

/** Boot collapse 開始と同一時刻でセットし、Home の registry 削除後も残す */
export const REG_BOOT_BG_FRAG_EPOCH_MS = 'bootBgFragEpochMs';

const SCATTER_MS = 180;
const CONVERGE_END_MS = 850;

function mulberry32(seed) {
  return function rnd() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playUrlOffsets() {
  if (typeof window === 'undefined') {
    return { poX: 0, poY: 0, ppX: 0, ppY: 0 };
  }
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    poX: n(window.HOME_PARAM_playOffsetX),
    poY: n(window.HOME_PARAM_playOffsetY),
    ppX: n(window.HOME_PARAM_playPanelOffsetX),
    ppY: n(window.HOME_PARAM_playPanelOffsetY),
  };
}

function subPanelOffsetXY(i) {
  if (typeof window === 'undefined') return { ox: 0, oy: 0 };
  const ox = [
    window.HOME_PARAM_sub0PanelOffsetX,
    window.HOME_PARAM_sub1PanelOffsetX,
    window.HOME_PARAM_sub2PanelOffsetX,
  ][i];
  const oy = [
    window.HOME_PARAM_sub0PanelOffsetY,
    window.HOME_PARAM_sub1PanelOffsetY,
    window.HOME_PARAM_sub2PanelOffsetY,
  ][i];
  return {
    ox: typeof ox === 'number' && Number.isFinite(ox) ? ox : 0,
    oy: typeof oy === 'number' && Number.isFinite(oy) ? oy : 0,
  };
}

function subRowOffsetXY(i) {
  if (typeof window === 'undefined') return { ox: 0, oy: 0 };
  const ox = [
    window.HOME_PARAM_sub0OffsetX,
    window.HOME_PARAM_sub1OffsetX,
    window.HOME_PARAM_sub2OffsetX,
  ][i];
  const oy = [
    window.HOME_PARAM_sub0OffsetY,
    window.HOME_PARAM_sub1OffsetY,
    window.HOME_PARAM_sub2OffsetY,
  ][i];
  return {
    ox: typeof ox === 'number' && Number.isFinite(ox) ? ox : 0,
    oy: typeof oy === 'number' && Number.isFinite(oy) ? oy : 0,
  };
}

/**
 * Home の redraw と同じ基準の PLAY / SUB 背景パネル中心（world px）
 * @param {number} W
 * @param {number} H
 */
export function computeHomeBgPanelCenters(W, H) {
  const L = getHomeLayout(W, H);
  const { poX, poY, ppX, ppY } = playUrlOffsets();
  const baseCx = L.playCenterX + poX;
  const baseCy = L.playCenterY + poY;
  const playCx = baseCx + ppX;
  const playCy = baseCy + ppY;

  const baseRowCenterY = L.baseRowCenterY ?? L.subCenterY[0];
  const baseSubCenterX = L.baseSubCenterX ?? L.subCenterX;
  const subSpacing = L.subSpacing ?? L.subRowSpacing;
  const subCenters = [0, 1, 2].map((i) => {
    const { ox: subNOffsetX, oy: subNOffsetY } = subRowOffsetXY(i);
    const { ox: subNPanelOx, oy: subNPanelOy } = subPanelOffsetXY(i);
    const rowBaseX = baseSubCenterX + subNOffsetX;
    const rowBaseY = baseRowCenterY + subSpacing * i + subNOffsetY;
    return {
      x: rowBaseX + subNPanelOx,
      y: rowBaseY + subNPanelOy,
    };
  });
  return { playCx, playCy, subCenters };
}

/**
 * テクスチャ座標系の凸多角形（非矩形）。crop 矩形内の相対座標 0..1 を歪ませる。
 * @param {number} variant
 * @returns {{ x: number, y: number }[]}
 */
function irregularPolyInUnitSquare(variant) {
  const v = variant % 5;
  const raw = [
    [
      { x: 0.02, y: 0.22 },
      { x: 0.38, y: 0.02 },
      { x: 0.96, y: 0.12 },
      { x: 0.88, y: 0.78 },
      { x: 0.52, y: 0.96 },
      { x: 0.08, y: 0.72 },
    ],
    [
      { x: 0.08, y: 0.08 },
      { x: 0.72, y: 0.02 },
      { x: 0.98, y: 0.42 },
      { x: 0.62, y: 0.94 },
      { x: 0.12, y: 0.88 },
      { x: 0.02, y: 0.48 },
    ],
    [
      { x: 0.12, y: 0.06 },
      { x: 0.55, y: 0.18 },
      { x: 0.92, y: 0.08 },
      { x: 0.78, y: 0.62 },
      { x: 0.35, y: 0.92 },
      { x: 0.04, y: 0.55 },
    ],
    [
      { x: 0.18, y: 0.12 },
      { x: 0.68, y: 0.04 },
      { x: 0.94, y: 0.35 },
      { x: 0.72, y: 0.88 },
      { x: 0.22, y: 0.82 },
      { x: 0.04, y: 0.48 },
    ],
    [
      { x: 0.06, y: 0.35 },
      { x: 0.42, y: 0.06 },
      { x: 0.88, y: 0.28 },
      { x: 0.82, y: 0.72 },
      { x: 0.48, y: 0.94 },
      { x: 0.1, y: 0.78 },
    ],
  ][v];
  return raw.map((p) => ({ x: p.x, y: p.y }));
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

/** ?debug=1 用: mask と同一ローカル座標の非矩形外縁（container の移動・回転に追従） */
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

function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
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

/**
 * @param {Phaser.Scene} bootScene
 * @param {number} W
 * @param {number} H
 * @param {number} bgCx
 * @param {number} bgCy
 * @param {number} bgScale
 * @param {number} natW
 * @param {number} natH
 * @param {object|null} faultBandSpec
 */
export function spawnBootBgCollapseFragments(
  bootScene,
  W,
  H,
  bgCx,
  bgCy,
  bgScale,
  natW,
  natH,
  faultBandSpec,
  epochMs,
) {
  destroyBootBgCollapseFragments(bootScene);
  const rnd = mulberry32(((epochMs | 0) ^ (W << 8) ^ (H << 2)) >>> 0);
  const nTotal = 8 + Math.floor(rnd() * 7);
  const { playCx, playCy, subCenters } = computeHomeBgPanelCenters(W, H);

  const playCrop = HOME_BG_PANEL_CROPS.PLAY_PANEL;
  const subCrops = [
    HOME_BG_PANEL_CROPS.SUB_PANEL_0,
    HOME_BG_PANEL_CROPS.SUB_PANEL_1,
    HOME_BG_PANEL_CROPS.SUB_PANEL_2,
  ];

  /** @type {object[]} */
  const defs = [];

  const addPanelFrag = (role, crop) => {
    const polyRel = irregularPolyInUnitSquare(defs.length + role.length * 3);
    const ptsTex = polyRel.map((p) => ({
      x: crop.x + p.x * crop.w,
      y: crop.y + p.y * crop.h,
    }));
    const subIdx = role.startsWith('sub') ? Number(role.slice(3)) : -1;
    defs.push({
      role,
      ptsTex,
      targetX: role === 'play' ? playCx : subCenters[subIdx]?.x ?? playCx,
      targetY: role === 'play' ? playCy : subCenters[subIdx]?.y ?? playCy,
    });
  };

  addPanelFrag('play', playCrop);
  addPanelFrag('sub0', subCrops[0]);
  addPanelFrag('sub1', subCrops[1]);
  addPanelFrag('sub2', subCrops[2]);

  const freeCount = Math.max(0, nTotal - 4);
  for (let i = 0; i < freeCount; i += 1) {
    const cx = natW * (0.12 + rnd() * 0.76);
    const cy = natH * (0.1 + rnd() * 0.72);
    const span = 90 + rnd() * 140;
    const polyRel = irregularPolyInUnitSquare(i + 17);
    const ptsTex = polyRel.map((p) => ({
      x: cx + (p.x - 0.5) * span,
      y: cy + (p.y - 0.5) * span * (0.75 + rnd() * 0.35),
    }));
    defs.push({ role: 'free', ptsTex, targetX: null, targetY: null });
  }

  const texToWorld = (tx, ty) => ({
    x: bgCx + (tx - natW * 0.5) * bgScale,
    y: bgCy + (ty - natH * 0.5) * bgScale,
  });

  const items = [];
  for (let di = 0; di < defs.length; di += 1) {
    const d = defs[di];
    let ptsTex = d.ptsTex.map((p) => ({
      x: Phaser.Math.Clamp(p.x, 1, natW - 2),
      y: Phaser.Math.Clamp(p.y, 1, natH - 2),
    }));
    const bb = bboxOfPoly(ptsTex);
    const pad = 2;
    let cropL = Math.floor(bb.minX - pad);
    let cropT = Math.floor(bb.minY - pad);
    let cropR = Math.ceil(bb.maxX + pad);
    let cropB = Math.ceil(bb.maxY + pad);
    cropL = Phaser.Math.Clamp(cropL, 0, natW - 2);
    cropT = Phaser.Math.Clamp(cropT, 0, natH - 2);
    cropR = Phaser.Math.Clamp(cropR, cropL + 2, natW);
    cropB = Phaser.Math.Clamp(cropB, cropT + 2, natH);
    const cropW = cropR - cropL;
    const cropH = cropB - cropT;

    const cenTex = {
      x: ptsTex.reduce((s, p) => s + p.x, 0) / ptsTex.length,
      y: ptsTex.reduce((s, p) => s + p.y, 0) / ptsTex.length,
    };
    const startW = texToWorld(cenTex.x, cenTex.y);

    const mainTop = faultBandSpec
      ? faultBandSpec.mainCy - faultBandSpec.mainH * 0.5
      : H * 0.3;
    const bandMid = mainTop + (faultBandSpec?.mainH ?? H * 0.08) * 0.5;
    const emergeSign = rnd() < 0.5 ? -1 : 1;
    const jitterAng = (rnd() - 0.5) * 0.9;
    const dist = 40 + rnd() * 120;
    const burstX = Math.cos(jitterAng) * dist * (0.4 + rnd() * 0.6);
    const burstY =
      emergeSign * (18 + rnd() * 55) + (startW.y < bandMid ? -rnd() * 40 : rnd() * 40);

    const scatterX = startW.x + burstX;
    const scatterY = startW.y + burstY;

    const img = bootScene.add
      .image(0, 0, 'home-bg-normal')
      .setOrigin(0.5, 0.5);
    img.setCrop(cropL, cropT, cropW, cropH);
    const dispW = cropW * bgScale;
    const dispH = cropH * bgScale;
    img.setDisplaySize(dispW, dispH);

    const maskGfx = bootScene.add.graphics().setVisible(false);
    const localPts = ptsTex.map((p) => ({
      x: ((p.x - cropL) / cropW - 0.5) * dispW,
      y: ((p.y - cropT) / cropH - 0.5) * dispH,
    }));
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillPoints(localPts, true, true);
    img.setMask(maskGfx.createGeometryMask());

    let outlineGfx = null;
    if (homeUrlDebugEnabled()) {
      const DBG_COLORS = [0x00ffff, 0xff00ff, 0xffff00];
      const lw = 1 + (di % 2);
      const a = Phaser.Math.Clamp(0.8 + (di % 5) * 0.05, 0.8, 1);
      outlineGfx = bootScene.add.graphics();
      drawBootBgCollapseFragOutline(
        outlineGfx,
        localPts,
        lw,
        DBG_COLORS[di % DBG_COLORS.length],
        a,
      );
    }

    const layerList = outlineGfx ? [img, maskGfx, outlineGfx] : [img, maskGfx];
    const c = bootScene.add.container(scatterX, scatterY, layerList);
    c.setDepth(-48);

    const ang0 = Phaser.Math.DegToRad((rnd() - 0.5) * 28);
    c.setRotation(ang0);

    const driftFree = {
      vx: (rnd() - 0.5) * 1.1,
      vy: 0.35 + rnd() * 0.85,
      vr: (rnd() - 0.5) * 0.0022,
    };

    items.push({
      container: c,
      img,
      maskGfx,
      outlineGfx,
      role: d.role,
      startX: startW.x,
      startY: startW.y,
      scatterX,
      scatterY,
      targetX: d.targetX,
      targetY: d.targetY,
      ang0,
      driftFree,
      panelHandoffDone: false,
    });
  }

  bootScene._bootBgCollapseFragItems = items;
  bootScene._bootBgCollapseFaultSpec = faultBandSpec;
  if (typeof epochMs === 'number' && Number.isFinite(epochMs)) {
    bootScene.game.registry.set(REG_BOOT_BG_FRAG_EPOCH_MS, epochMs);
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
  if (!items?.length) return;

  const epoch = bootScene.game.registry.get(REG_BOOT_BG_FRAG_EPOCH_MS);
  const wallT =
    typeof epoch === 'number' && Number.isFinite(epoch)
      ? performance.now() - epoch
      : collapseT;

  const spec = bootScene._bootBgCollapseFaultSpec;
  const uScatter = Phaser.Math.Clamp(collapseT / SCATTER_MS, 0, 1);
  const eSc = easeOutCubic(uScatter);
  const uConv =
    collapseT <= SCATTER_MS
      ? 0
      : Phaser.Math.Clamp((collapseT - SCATTER_MS) / (CONVERGE_END_MS - SCATTER_MS), 0, 1);
  const eConv = easeInOutQuad(uConv);

  for (const it of items) {
    if (!it.container || it.container.destroyed) continue;

    if (it.role !== 'free' && wallT >= CONVERGE_END_MS && !it.panelHandoffDone) {
      it.panelHandoffDone = true;
      if (it.img && !it.img.destroyed) {
        it.img.clearMask(true);
      }
      it.maskGfx?.destroy?.();
      it.outlineGfx?.destroy?.();
      it.img?.destroy?.();
      it.container?.destroy?.();
      continue;
    }

    let x;
    let y;
    let rot = it.ang0;

    if (it.role === 'free') {
      const sx = Phaser.Math.Linear(it.startX, it.scatterX, eSc);
      const sy = Phaser.Math.Linear(it.startY, it.scatterY, eSc);
      const extra = Math.max(0, collapseT - SCATTER_MS) * 0.001;
      x = sx + it.driftFree.vx * extra * 22 + Math.sin(extra * 1.7) * 6;
      y = sy + it.driftFree.vy * extra * 28;
      rot = it.ang0 + it.driftFree.vr * collapseT * 18;
      if (pointInFaultBands(x, y, spec, W)) {
        const flick = 0.22 + 0.12 * Math.sin(collapseT * 0.019 + it.startX * 0.01);
        it.img.setAlpha(Phaser.Math.Clamp(flick, 0.12, 0.48));
      } else {
        it.img.setAlpha(Phaser.Math.Clamp(0.78 + Math.sin(collapseT * 0.003) * 0.08, 0.55, 0.95));
      }
    } else {
      const sx = Phaser.Math.Linear(it.startX, it.scatterX, eSc);
      const sy = Phaser.Math.Linear(it.startY, it.scatterY, eSc);
      x = Phaser.Math.Linear(sx, it.targetX, eConv);
      y = Phaser.Math.Linear(sy, it.targetY, eConv);
      rot = Phaser.Math.Linear(it.ang0, 0, eConv);
      let a = 0.88;
      if (pointInFaultBands(x, y, spec, W)) {
        a *= 0.42;
      }
      it.img.setAlpha(a);
    }

    it.container.setPosition(x, y);
    it.container.setRotation(rot);
  }
}

/**
 * @param {Phaser.Scene} bootScene
 */
export function destroyBootBgCollapseFragments(bootScene) {
  const items = bootScene._bootBgCollapseFragItems;
  if (items?.length) {
    for (const it of items) {
      try {
        if (it.img && !it.img.destroyed) {
          it.img.clearMask(true);
        }
        it.maskGfx?.destroy?.();
        it.outlineGfx?.destroy?.();
        it.img?.destroy?.();
        it.container?.destroy?.();
      } catch (_) {
        /* ignore */
      }
    }
  }
  bootScene._bootBgCollapseFragItems = null;
  bootScene._bootBgCollapseFaultSpec = null;
  bootScene.game.registry.remove(REG_BOOT_BG_FRAG_EPOCH_MS);
}
