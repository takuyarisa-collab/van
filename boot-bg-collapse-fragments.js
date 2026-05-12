/**
 * Boot 崩壊時: home-bg-normal を非矩形ポリゴン断片に分割し飛散・一部を Home PLAY/SUB 位置へ収束。
 * 各断片は生成時のみ RenderTexture に焼き込み（静止セットアップで一時 GeometryMask）、移動中はマスクなし。
 * 演出終了後は必ず destroy。毎フレームの新規生成はしない。
 *
 * 破片は「回収」（PLAY/SUB を構成）と「廃棄」（画面外・黒帯・フェード）に分離する。
 */

import { getHomeLayout } from './home-layout.js';
import { HOME_BG_PANEL_CROPS } from './home-bg-panel-crops.js';
import { homeUrlDebugEnabled } from './home-url-debug.js';

/** Boot collapse 開始と同一時刻でセットし、Home の registry 削除後も残す */
export const REG_BOOT_BG_FRAG_EPOCH_MS = 'bootBgFragEpochMs';

/** Home の PLAY/SUB 背景パネル（クロップ）を不透明にする wall-clock 閾値（overlap rebuild と同期） */
export const BOOT_BG_HOME_PANEL_REVEAL_MS = 995;

/** タイムライン（collapseT / wallT 基準） */
export const BOOT_BG_FRAG_SCATTER_MS = 250;
export const BOOT_BG_FRAG_CONVERGE_T0_MS = 250;
export const BOOT_BG_FRAG_CONVERGE_END_MS = 1000;
export const BOOT_BG_FRAG_STABILIZE_T0_MS = 900;
export const BOOT_BG_FRAG_STABILIZE_END_MS = 1030;

const SCATTER_MS = BOOT_BG_FRAG_SCATTER_MS;
const CONVERGE_END_MS = BOOT_BG_FRAG_CONVERGE_END_MS;
const STABILIZE_T0_MS = BOOT_BG_FRAG_STABILIZE_T0_MS;
const STABILIZE_END_MS = BOOT_BG_FRAG_STABILIZE_END_MS;

/** 廃棄破片のフェード開始・強制破棄（Boot collapse 内） */
const WASTE_FADE_T0_MS = 680;
const WASTE_DESTROY_MS = 1080;

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
 * テクスチャ座標系の凸多角形（非矩形・非対称）。crop 矩形内の相対座標 0..1 を歪ませる。
 * @param {number} variant
 * @returns {{ x: number, y: number }[]}
 */
function irregularPolyInUnitSquare(variant) {
  const v = variant % 11;
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
    [
      { x: 0.04, y: 0.62 },
      { x: 0.44, y: 0.18 },
      { x: 0.91, y: 0.22 },
      { x: 0.86, y: 0.71 },
      { x: 0.36, y: 0.95 },
    ],
    [
      { x: 0.14, y: 0.04 },
      { x: 0.62, y: 0.12 },
      { x: 0.96, y: 0.48 },
      { x: 0.58, y: 0.91 },
      { x: 0.08, y: 0.78 },
    ],
    [
      { x: 0.22, y: 0.72 },
      { x: 0.08, y: 0.32 },
      { x: 0.48, y: 0.08 },
      { x: 0.94, y: 0.26 },
      { x: 0.88, y: 0.68 },
      { x: 0.52, y: 0.94 },
    ],
    [
      { x: 0.1, y: 0.48 },
      { x: 0.35, y: 0.1 },
      { x: 0.78, y: 0.06 },
      { x: 0.95, y: 0.55 },
      { x: 0.5, y: 0.9 },
    ],
    [
      { x: 0.05, y: 0.18 },
      { x: 0.52, y: 0.04 },
      { x: 0.98, y: 0.38 },
      { x: 0.72, y: 0.88 },
      { x: 0.2, y: 0.82 },
    ],
    [
      { x: 0.16, y: 0.88 },
      { x: 0.06, y: 0.42 },
      { x: 0.42, y: 0.08 },
      { x: 0.9, y: 0.2 },
      { x: 0.84, y: 0.76 },
    ],
  ][v];
  return raw.map((p) => ({ x: p.x, y: p.y }));
}

function polyInTexRect(rect, variant) {
  const polyRel = irregularPolyInUnitSquare(variant);
  return polyRel.map((p) => ({
    x: rect.x + p.x * rect.w,
    y: rect.y + p.y * rect.h,
  }));
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

/**
 * 静止コンテナ上で一時 GeometryMask を使い、crop 済み背景を非矩形に焼き込んだ RenderTexture を返す。
 * 返却オブジェクトは移動中に setMask しない（マスク座標ズレ回避）。
 *
 * @param {Phaser.Scene} bootScene
 * @param {number} cropL
 * @param {number} cropT
 * @param {number} cropW
 * @param {number} cropH
 * @param {number} dispW
 * @param {number} dispH
 * @param {{ x: number, y: number }[]} localPts
 * @returns {Phaser.GameObjects.RenderTexture}
 */
function bakeBootBgFragmentToRenderTexture(
  bootScene,
  cropL,
  cropT,
  cropW,
  cropH,
  dispW,
  dispH,
  localPts,
) {
  const rtW = Math.max(1, Math.ceil(dispW));
  const rtH = Math.max(1, Math.ceil(dispH));

  const fragRt = bootScene.add
    .renderTexture(0, 0, rtW, rtH)
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  fragRt.clear();

  const srcImg = bootScene.add
    .image(0, 0, 'home-bg-normal')
    .setOrigin(0.5, 0.5);
  srcImg.setCrop(cropL, cropT, cropW, cropH);
  srcImg.setDisplaySize(dispW, dispH);

  const maskGfx = bootScene.add.graphics();
  maskGfx.fillStyle(0xffffff, 1);
  maskGfx.fillPoints(localPts, true, true);
  srcImg.setMask(maskGfx.createGeometryMask());

  const bakeC = bootScene.add.container(0, 0, [srcImg, maskGfx]);

  fragRt.draw(bakeC, rtW * 0.5, rtH * 0.5);

  if (srcImg && !srcImg.destroyed) {
    srcImg.clearMask(true);
  }
  if (bakeC && !bakeC.destroyed) {
    bakeC.destroy(true);
  }

  fragRt.setDisplaySize(dispW, dispH);
  return fragRt;
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

/** PLAY クロップ内の回収用サブ矩形（横長・台形分割風、重なりあり） */
function playRecycleTexRects(crop, rnd) {
  const { x, y, w, h } = crop;
  const u0 = rnd() * 0.06;
  const u1 = rnd() * 0.05;
  return [
    { x: x + u0 * w, y: y + 0.02 * h, w: w * (0.56 + rnd() * 0.06), h: h * (0.62 + rnd() * 0.08) },
    { x: x + w * (0.48 + u1), y: y + 0.04 * h, w: w * (0.48 - u1), h: h * (0.4 + rnd() * 0.1) },
    { x: x + w * (0.42 + rnd() * 0.04), y: y + h * (0.38 + rnd() * 0.06), w: w * (0.52 - rnd() * 0.04), h: h * (0.42 + rnd() * 0.08) },
    { x: x + w * (0.05 + rnd() * 0.04), y: y + h * (0.58 + rnd() * 0.04), w: w * (0.52 + rnd() * 0.06), h: h * (0.38 + rnd() * 0.06) },
  ];
}

/** SUB 行クロップを 2〜3 枚のサブ矩形へ */
function subRecycleTexRects(crop, count, rnd) {
  const { x, y, w, h } = crop;
  if (count <= 2) {
    const split = 0.46 + rnd() * 0.08;
    return [
      { x: x + rnd() * 3, y: y + rnd() * 2, w: w * split - 2, h: h - 3 },
      { x: x + w * split + 1, y: y + rnd() * 2, w: w * (1 - split) - 3, h: h - 2 },
    ];
  }
  const a = 0.34 + rnd() * 0.08;
  const b = 0.34 + rnd() * 0.08;
  const c = Math.max(0.1, 1 - a - b);
  return [
    { x: x + 1, y: y + 1, w: w * a - 2, h: h - 2 },
    { x: x + w * a + 1, y: y + rnd() * 2, w: w * b - 2, h: h - 3 },
    { x: x + w * (a + b) + 1, y: y + 1, w: Math.max(24, w * c - 2), h: h - 2 },
  ];
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
  const { playCx, playCy, subCenters } = computeHomeBgPanelCenters(W, H);

  const playCrop = HOME_BG_PANEL_CROPS.PLAY_PANEL;
  const subCrops = [
    HOME_BG_PANEL_CROPS.SUB_PANEL_0,
    HOME_BG_PANEL_CROPS.SUB_PANEL_1,
    HOME_BG_PANEL_CROPS.SUB_PANEL_2,
  ];

  /** @type {object[]} */
  const defs = [];

  const pushRecycle = (role, ptsTex, panelCx, panelCy, offX, offY, endRot) => {
    defs.push({
      kind: 'recycle',
      role,
      ptsTex,
      panelCx,
      panelCy,
      offX,
      offY,
      endRot,
    });
  };

  const playRects = playRecycleTexRects(playCrop, rnd);
  const playOffsets = [
    { ox: -10, oy: -6, er: -0.05 },
    { ox: 22, oy: -14, er: 0.055 },
    { ox: 18, oy: 8, er: -0.04 },
    { ox: -16, oy: 18, er: 0.045 },
  ];
  playRects.forEach((rect, i) => {
    const po = playOffsets[i % playOffsets.length];
    pushRecycle(
      `play_${i}`,
      polyInTexRect(rect, 100 + i * 17),
      playCx,
      playCy,
      po.ox + (rnd() - 0.5) * 8,
      po.oy + (rnd() - 0.5) * 8,
      po.er + (rnd() - 0.5) * 0.02,
    );
  });

  for (let si = 0; si < 3; si += 1) {
    const nSub = 2 + (rnd() < 0.55 ? 1 : 0);
    const rects = subRecycleTexRects(subCrops[si], nSub, rnd);
    const cx = subCenters[si]?.x ?? playCx;
    const cy = subCenters[si]?.y ?? playCy;
    const spread = 26 + rnd() * 10;
    const offs =
      nSub === 2
        ? [
            { ox: -spread * 0.45, oy: (rnd() - 0.5) * 8, er: 0.04 },
            { ox: spread * 0.48, oy: (rnd() - 0.5) * 10, er: -0.035 },
          ]
        : [
            { ox: -spread * 0.52, oy: -5 + rnd() * 4, er: 0.032 },
            { ox: (rnd() - 0.5) * 6, oy: 6 + rnd() * 5, er: -0.028 },
            { ox: spread * 0.5, oy: -4 + rnd() * 8, er: 0.038 },
          ];
    rects.forEach((rect, j) => {
      const o = offs[j] ?? offs[0];
      pushRecycle(
        `sub${si}_${j}`,
        polyInTexRect(rect, 200 + si * 40 + j * 19),
        cx,
        cy,
        o.ox + (rnd() - 0.5) * 6,
        o.oy + (rnd() - 0.5) * 6,
        o.er + (rnd() - 0.5) * 0.018,
      );
    });
  }

  const nRecycled = defs.length;
  const minWaste = 12;
  let nTotal = 20 + Math.floor(rnd() * 41);
  if (nTotal < nRecycled + minWaste) nTotal = nRecycled + minWaste;
  if (nTotal > 60) nTotal = 60;

  const freeCount = nTotal - nRecycled;
  for (let i = 0; i < freeCount; i += 1) {
    const cx = natW * (0.08 + rnd() * 0.84);
    const cy = natH * (0.06 + rnd() * 0.82);
    const span = 72 + rnd() * 118;
    const polyRel = irregularPolyInUnitSquare(i + 311);
    const ptsTex = polyRel.map((p) => ({
      x: cx + (p.x - 0.5) * span,
      y: cy + (p.y - 0.5) * span * (0.72 + rnd() * 0.38),
    }));
    const bandBias = rnd();
    defs.push({
      kind: 'waste',
      role: 'waste',
      ptsTex,
      bandBias,
      suckBand: rnd() < 0.42,
      fadeEarly: rnd() < 0.35,
    });
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
    const jitterAng = (rnd() - 0.5) * 1.15;
    const isWaste = d.kind === 'waste';
    const dist = (isWaste ? 95 : 42) + rnd() * (isWaste ? 220 : 130);
    const burstX = Math.cos(jitterAng) * dist * (0.45 + rnd() * 0.65);
    const burstY =
      emergeSign * (22 + rnd() * 72) + (startW.y < bandMid ? -rnd() * 55 : rnd() * 55);

    const scatterX = startW.x + burstX;
    const scatterY = startW.y + burstY;

    const dispW = cropW * bgScale;
    const dispH = cropH * bgScale;
    const localPts = ptsTex.map((p) => ({
      x: ((p.x - cropL) / cropW - 0.5) * dispW,
      y: ((p.y - cropT) / cropH - 0.5) * dispH,
    }));

    const fragRt = bakeBootBgFragmentToRenderTexture(
      bootScene,
      cropL,
      cropT,
      cropW,
      cropH,
      dispW,
      dispH,
      localPts,
    );

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

    const layerList = outlineGfx ? [fragRt, outlineGfx] : [fragRt];
    const c = bootScene.add.container(scatterX, scatterY, layerList);
    fragRt.setVisible(true);
    c.setDepth(homeUrlDebugEnabled() ? 60 : -48);

    const ang0 = Phaser.Math.DegToRad((rnd() - 0.5) * (isWaste ? 48 : 32));
    c.setRotation(ang0);

    if (homeUrlDebugEnabled()) {
      console.log('[BOOT_BG_FRAG]', {
        kind: d.kind,
        role: d.role,
        cropL,
        cropT,
        cropW,
        cropH,
        dispW,
        dispH,
        localPtsLen: localPts.length,
        containerDepth: c.depth,
        bakedRt: true,
        rtW: fragRt.width,
        rtH: fragRt.height,
      });
    }

    const driftFree = {
      vx: (rnd() - 0.5) * (isWaste ? 2.4 : 1.1),
      vy: (isWaste ? 0.55 : 0.35) + rnd() * (isWaste ? 1.2 : 0.85),
      vr: (rnd() - 0.5) * (isWaste ? 0.0045 : 0.0022),
    };

    const wasteExtra = isWaste
      ? {
          suckBand: d.suckBand,
          fadeEarly: d.fadeEarly,
          bandBias: d.bandBias,
        }
      : null;

    const recycleExtra =
      !isWaste && d.panelCx != null
        ? {
            panelCx: d.panelCx,
            panelCy: d.panelCy,
            offX: d.offX,
            offY: d.offY,
            endRot: d.endRot,
          }
        : null;

    items.push({
      container: c,
      img: fragRt,
      outlineGfx,
      kind: d.kind,
      role: d.role,
      startX: startW.x,
      startY: startW.y,
      scatterX,
      scatterY,
      ang0,
      driftFree,
      wasteExtra,
      recycleExtra,
      destroyedEarly: false,
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

  const uConv = Phaser.Math.Clamp((collapseT - SCATTER_MS) / (CONVERGE_END_MS - SCATTER_MS), 0, 1);
  const eConv = easeInOutQuad(uConv);

  const uStab =
    collapseT <= STABILIZE_T0_MS
      ? 0
      : Phaser.Math.Clamp((collapseT - STABILIZE_T0_MS) / (STABILIZE_END_MS - STABILIZE_T0_MS), 0, 1);
  const eStab = easeOutCubic(uStab);

  const mainTop = spec ? spec.mainCy - spec.mainH * 0.5 : H * 0.3;
  const bandMid = mainTop + (spec?.mainH ?? H * 0.08) * 0.5;
  const bandPullX = W * 0.5;
  const bandPullY = bandMid;

  for (const it of items) {
    if (!it.container || it.container.destroyed || it.destroyedEarly) continue;

    if (it.kind === 'waste' && wallT >= WASTE_DESTROY_MS) {
      it.destroyedEarly = true;
      try {
        it.container.destroy(true);
      } catch (_) {
        /* ignore */
      }
      continue;
    }

    let x;
    let y;
    let rot = it.ang0;

    if (it.kind === 'waste') {
      const sx = Phaser.Math.Linear(it.startX, it.scatterX, eSc);
      const sy = Phaser.Math.Linear(it.startY, it.scatterY, eSc);
      const post = Math.max(0, collapseT - SCATTER_MS);
      const postW = post * 0.0011;
      let driftX = it.driftFree.vx * postW * 38 + Math.sin(postW * 1.9 + it.startX * 0.02) * 14;
      let driftY = it.driftFree.vy * postW * 44;

      if (it.wasteExtra?.suckBand && post > 120) {
        const tug = Phaser.Math.Clamp((post - 120) / 520, 0, 1) * 0.55;
        driftX += (bandPullX - sx - driftX) * tug * (0.35 + it.wasteExtra.bandBias * 0.4);
        driftY += (bandPullY - sy - driftY) * tug * (0.42 + it.wasteExtra.bandBias * 0.35);
      }

      x = sx + driftX;
      y = sy + driftY;
      rot = it.ang0 + it.driftFree.vr * collapseT * 22;

      let baseA = 0.82;
      if (pointInFaultBands(x, y, spec, W)) {
        const flick = 0.18 + 0.14 * Math.sin(collapseT * 0.021 + it.startX * 0.01);
        baseA = Phaser.Math.Clamp(flick, 0.1, 0.42);
      }

      const fade0 = it.wasteExtra?.fadeEarly ? WASTE_FADE_T0_MS - 120 : WASTE_FADE_T0_MS;
      if (wallT > fade0) {
        const uFade = Phaser.Math.Clamp((wallT - fade0) / (WASTE_DESTROY_MS - fade0 - 40), 0, 1);
        baseA *= 1 - easeInOutQuad(uFade);
      }
      if (homeUrlDebugEnabled()) {
        it.img.setAlpha(Phaser.Math.Clamp(0.78 + Math.sin(collapseT * 0.003) * 0.08, 0.85, 0.95));
      } else {
        it.img.setAlpha(Phaser.Math.Clamp(baseA, 0, 1));
      }
    } else if (it.kind === 'recycle' && it.recycleExtra) {
      const { panelCx, panelCy, offX, offY, endRot } = it.recycleExtra;
      const sx = Phaser.Math.Linear(it.startX, it.scatterX, eSc);
      const sy = Phaser.Math.Linear(it.startY, it.scatterY, eSc);

      const midX = panelCx + offX * 1.38;
      const midY = panelCy + offY * 1.38;
      const finX = panelCx + offX;
      const finY = panelCy + offY;

      const x1 = Phaser.Math.Linear(sx, midX, eConv);
      const y1 = Phaser.Math.Linear(sy, midY, eConv);
      x = Phaser.Math.Linear(x1, finX, eStab);
      y = Phaser.Math.Linear(y1, finY, eStab);

      const rot1 = Phaser.Math.Linear(it.ang0, endRot * 2.2, eConv);
      rot = Phaser.Math.Linear(rot1, endRot, eStab);

      if (homeUrlDebugEnabled()) {
        it.img.setAlpha(0.88);
      } else {
        let a = 0.88;
        if (pointInFaultBands(x, y, spec, W)) {
          a *= 0.48;
        }
        it.img.setAlpha(a);
      }
    } else {
      x = it.scatterX;
      y = it.scatterY;
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
        it.container?.destroy?.(true);
      } catch (_) {
        /* ignore */
      }
    }
  }
  bootScene._bootBgCollapseFragItems = null;
  bootScene._bootBgCollapseFaultSpec = null;
  bootScene.game.registry.remove(REG_BOOT_BG_FRAG_EPOCH_MS);
}
