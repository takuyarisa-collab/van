import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';

export const HOMEOVERLAP_TEX_KEY = 'home-overlap-title';

export function getHomeLayout(WORLD_W, WORLD_H) {
  const W = WORLD_W;
  const H = WORLD_H;
  const centerX = W / 2;
  const cy = H / 2;
  // 残骸PNGと create() 内の配置と同じ幾何（LOG 下端 vs 残骸上端の干渉チェック用）
  const DEBRIS_NAT_W = 1024;
  const DEBRIS_NAT_H = 542;
  const _debrisScaleGeom = (W * 1.08) / DEBRIS_NAT_W;
  const debrisTopY = (H + 20) - DEBRIS_NAT_H * _debrisScaleGeom;

  const HOME_OFFSET_BASE = -H * 0.06;
  const HOME_OFFSET_MAX = -H * 0.07;
  // 画面中央 (cx, cy) を基準。START は中央寄り（操作主役 + Boot 警告残骸との縦分離）
  let startCenterY = cy + H * 0.028;
  const startWidth = W * 0.52;
  const startHeight = H * 0.075;
  const subButtonWidth = W * 0.44;
  const subButtonHeight = H * 0.055;
  /** サブ行のプレースホルダ（先頭 O/E/R は PNG 1 文字切り出し、後続のみテキスト） */
  const subRowTails = Object.freeze(['/CONF', '-VIEW', '/DATA']);
  // サブボタン中心 Y（START_y = START 中心）: 上段は広め、その下は比率間隔
  let enhanceY = startCenterY + H * 0.175;
  let loadoutY = enhanceY + H * 0.095;
  let logY = loadoutY + H * 0.095;

  const logBottomWithOffset = (oy) => logY + oy + subButtonHeight / 2;
  let HOME_Y_OFFSET = HOME_OFFSET_BASE;
  if (logBottomWithOffset(HOME_Y_OFFSET) >= debrisTopY) {
    HOME_Y_OFFSET = HOME_OFFSET_MAX;
  }

  startCenterY += HOME_Y_OFFSET;
  enhanceY += HOME_Y_OFFSET;
  loadoutY += HOME_Y_OFFSET;
  logY += HOME_Y_OFFSET;
  const subButtonCenterYs = Object.freeze([enhanceY, loadoutY, logY]);

  // ── outerFrame: 6-part decomposition of one outer border ────────────
  // padding from world edges
  const ofPad    = 28;
  const ofLeft   = ofPad;
  const ofRight  = WORLD_W - ofPad;
  const ofTop    = ofPad;
  const ofBottom = WORLD_H - ofPad;
  // vertical split at screen centre
  const ofMidY   = WORLD_H / 2;
  const outerFrame = Object.freeze({
    // horizontal bars (full width between left/right corners)
    top:          Object.freeze({ x1: ofLeft,  y1: ofTop,    x2: ofRight, y2: ofTop    }),
    bottom:       Object.freeze({ x1: ofLeft,  y1: ofBottom, x2: ofRight, y2: ofBottom }),
    // left vertical – upper half
    leftTop:      Object.freeze({ x1: ofLeft,  y1: ofTop,    x2: ofLeft,  y2: ofMidY   }),
    // left vertical – lower half
    leftBottom:   Object.freeze({ x1: ofLeft,  y1: ofMidY,   x2: ofLeft,  y2: ofBottom }),
    // right vertical – upper half
    rightTop:     Object.freeze({ x1: ofRight, y1: ofTop,    x2: ofRight, y2: ofMidY   }),
    // right vertical – lower half
    rightBottom:  Object.freeze({ x1: ofRight, y1: ofMidY,   x2: ofRight, y2: ofBottom }),
  });

  return Object.freeze({
    centerX,
    startCenterY,
    startWidth,
    startHeight,
    subButtonWidth,
    subButtonHeight,
    subButtonCenterYs,
    subRowTails,
    outerFrame,
    HOME_Y_OFFSET,
    debrisTopY,
  });
}

/** V crop の左斜線を落とし右斜線のみ残す（HOMEOVERLAP_CROPS.V を基準、順番依存なし）— 装飾用 */
export function homeBrokenYCropFromV() {
  const v = HOMEOVERLAP_CROPS['V'];
  const slice = Math.max(1, Math.floor(v.w * 0.38));
  return Object.freeze({
    x: v.x + slice,
    y: v.y,
    w: Math.max(12, v.w - slice),
    h: v.h,
  });
}

/**
 * Home 面 UI（ベース + inset グロー + 上ハイライト + 下シャドウ）— ドロップシャドウなし
 * @param {Phaser.GameObjects.Graphics} gMain
 * @param {Phaser.GameObjects.Graphics} gDet
 */
export function drawHomeFacePanel(gMain, gDet, x, y, w, h, opts) {
  const {
    seed,
    flashMul = 1,
    sfAlpha = 1,
    baseAlphaMin,
    baseAlphaMax,
  } = opts;
  gMain.clear();
  gDet.clear();
  const panelW = Math.max(1, w);
  const panelH = Math.max(1, h);
  const baseMainAlpha = _homeUiRandRange(seed, baseAlphaMin, baseAlphaMax) * flashMul * sfAlpha;
  gMain.fillStyle(0x0b1a2a, baseMainAlpha);
  gMain.fillRect(x, y, panelW, panelH);

  const innerInset = 3;
  const inL = x + innerInset;
  const inT = y + innerInset;
  const inW = Math.max(1, panelW - innerInset * 2);
  const inH = Math.max(1, panelH - innerInset * 2);
  const innerGlowAlpha = _homeUiRandRange(seed + 1, 0.12, 0.18) * flashMul * sfAlpha;
  gDet.fillStyle(0x6fbaff, innerGlowAlpha);
  gDet.fillRect(inL, inT, inW, inH);

  const hiEdgeInset = 2;
  const hiLineAlpha = _homeUiRandRange(seed + 2, 0.22, 0.32) * flashMul * sfAlpha;
  const hiW = Math.max(1, panelW - hiEdgeInset * 2);
  const hiX = x + (panelW - hiW) * 0.5;
  const hiY = y + hiEdgeInset;
  gDet.fillStyle(0xbfe3ff, hiLineAlpha);
  gDet.fillRect(hiX, hiY, hiW, 1);

  const shEdgeInset = 2;
  const shLineAlpha = _homeUiRandRange(seed + 3, 0.25, 0.35) * flashMul * sfAlpha;
  const shY = y + panelH - shEdgeInset - 1;
  gDet.fillStyle(0x000000, shLineAlpha);
  gDet.fillRect(x, shY, panelW, 1);
}

/** ?debug=1 時: overlap-title 上の crop 矩形をミニマップ表示（stroke + ラベル） */
const HOMEOVERLAP_CROP_DEBUG_ENTRIES = Object.freeze([
  { label: 'O', cropKey: 'O' },
  { label: 'V', cropKey: 'V' },
  { label: 'E', cropKey: 'E' },
  { label: 'R', cropKey: 'R' },
  { label: 'L', cropKey: 'L' },
  { label: 'A', cropKey: 'A' },
  { label: 'P', cropKey: 'P' },
  { label: 'line_top', cropKey: 'line_top' },
  { label: 'line_bottom', cropKey: 'line_bottom' },
]);

export function createHomeOverlapCropDebugOverlay(scene) {
  if (!window.DEBUG_HUD_ENABLED) return null;
  const S = 0.22;
  const ox = 12;
  const oy = 120;
  const depth = 10001;
  const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  const labels = [];
  HOMEOVERLAP_CROP_DEBUG_ENTRIES.forEach(({ label, cropKey }) => {
    const c = HOMEOVERLAP_CROPS[cropKey];
    if (!c) return;
    const x = ox + c.x * S;
    const y = oy + c.y * S;
    const w = c.w * S;
    const h = c.h * S;
    g.lineStyle(1, 0xff6b6b, 0.95);
    g.strokeRect(x, y, w, h);
    const t = scene.add
      .text(x + 2, y + 1, label, {
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: '11px',
        color: '#ffdede',
      })
      .setDepth(depth + 1)
      .setScrollFactor(0)
      .setOrigin(0, 0);
    labels.push(t);
  });
  return {
    destroy() {
      g.destroy();
      labels.forEach((t) => t.destroy());
    },
  };
}

// Returns a neutral (no-op) delta object.
// Collapse / rebuild: set fields on this object then call _redrawHomeUI().
export function createHomeDelta() {
  return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, alpha: 1, rotation: 0 };
}

/** Stable pseudo-random for Home UI micro-offsets (no per-frame animation). */
function _homeUiHash32(seed) {
  let x = (seed >>> 0) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
function _homeUiUnit(seed) {
  return (_homeUiHash32(seed) & 0xffff) / 0xffff;
}
function _homeUiRandRange(seed, lo, hi) {
  return lo + _homeUiUnit(seed) * (hi - lo);
}
function _homeUiRandInt(seed, lo, hi) {
  return lo + (_homeUiHash32(seed) % (hi - lo + 1));
}

/**
 * overlap-title から canvas テクスチャを生成して Image を返す（Graphics 不使用）。
 */
export function addOverlapCropImage(scene, texKey, crop, depth) {
  const key = `ov_${texKey}_${crop.x}_${crop.y}_${crop.w}_${crop.h}`;
  if (!scene.textures.exists(key)) {
    const src = scene.textures.get(texKey).getSourceImage();
    const c = document.createElement('canvas');
    c.width = crop.w;
    c.height = crop.h;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    scene.textures.addCanvas(key, c);
  }
  return scene.add.image(0, 0, key).setOrigin(0.5, 0.5).setDepth(depth);
}

/**
 * Home 表示時: Boot の背景パネル除去に加え、タイトル PNG・構造体・警告・ログ・
 * マスク用テキストを破棄する（Home 上にエラー系・OVERLAP 残骸が残らないようにする）。
 */
export function destroyBootBgPanelForHome(bootScene) {
  const bs = bootScene;
  const bg = bs?._bootBg;
  if (bg && !bg.destroyed) {
    bg.destroy();
    bs._bootBg = null;
  }
  if (!bs) return;
  bs._bootTitleImg?.destroy?.();
  bs._bootTitleImg = null;
  bs._bootTitleParts?.destroy?.();
  bs._bootTitleParts = null;
  bs._warnText1?.destroy?.();
  bs._warnText2?.destroy?.();
  bs._warnFrame?.destroy?.();
  bs._warnText1 = bs._warnText2 = bs._warnFrame = null;
  bs._warnLayout = null;
  bs._logPool?.forEach((t) => t.destroy());
  bs._logPool = null;
  bs._overlapText?.destroy?.();
  bs._overlapText = null;
  bs._overlapMaskGfx?.destroy?.();
  bs._overlapMask = null;
  bs._overlapMaskGfx = null;
}

export function redrawHomeUI(scene, HOME_LAYOUT) {
  const L = HOME_LAYOUT;
  const sf = scene._delta.startFrame;
  const baseX = L.centerX + sf.offsetX;
  const baseY = L.startCenterY + sf.offsetY;
  const flashMul = scene._startPressFlash ? 1.15 : 1.0;

  const Cr = HOMEOVERLAP_CROPS;
  const P = Cr.P;
  const Ltr = Cr.L;
  const A = Cr.A;
  const playRefNatH = Math.max(P.h, Ltr.h, A.h);
  scene._homePlayRefNatH = playRefNatH;

  const glyphShrink = _homeUiRandRange(0x4910a1, 0.75, 0.85);
  const targetDispH = _homeUiRandRange(0x4910a0, 54, 62) * glyphShrink;
  const gS = (targetDispH / playRefNatH) * sf.scaleX;
  const gSy = (targetDispH / playRefNatH) * sf.scaleY;

  const wP = P.w * gS;
  const wL = Ltr.w * gS;
  const wA = A.w * gS;
  const gapPL = _homeUiRandRange(0x492010, 10, 16);
  const gapLA = _homeUiRandRange(0x492011, 20, 30);
  const gapAY = _homeUiRandRange(0x492012, 12, 18);

  scene._startY.setStyle({ fontSize: `${Math.round(targetDispH)}px` });
  const wY = scene._startY.width;

  const totalW = wP + gapPL + wL + gapLA + wA + gapAY + wY;
  const padX = _homeUiRandRange(0x491101, 16, 24);
  const padY = _homeUiRandRange(0x491102, 16, 22);
  const triScale = _homeUiRandRange(0x491103, 1.22, 1.30);
  const triSize = targetDispH * triScale;
  const midGap = _homeUiRandRange(0x491104, 8, 14);

  const panelW = Math.max(totalW, triSize * 1.05) + padX * 2;
  const panelH = padY * 2 + triSize + midGap + targetDispH;
  const panelL = baseX - panelW * 0.5;
  const panelT = baseY - panelH * 0.5;

  const j = (seed) => _homeUiRandInt(seed, -1, 1);
  const alphaPlay = Math.min(
    1,
    flashMul * sf.alpha * _homeUiRandRange(0x492100, 0.8, 0.9),
  );

  const triCx = baseX + j(0x492200);
  const triCy = panelT + padY + triSize * 0.5 + j(0x492201);
  const playCy =
    panelT + padY + triSize + midGap + targetDispH * 0.5 + j(0x492202);

  const placeGlyph = (img, cx, cy, sx, sy, rotDeg, seed, alpha, applyFrameRot = true) => {
    img.setPosition(cx + j(seed + 1), cy + j(seed + 2));
    img.setScale(sx, sy);
    const extraRot = applyFrameRot ? sf.rotation : 0;
    img.setRotation(Phaser.Math.DegToRad(rotDeg + extraRot));
    img.setAlpha(alpha);
  };

  let xCursor = baseX - totalW * 0.5;
  const cP = xCursor + wP * 0.5;
  placeGlyph(scene._startP, cP, playCy, gS, gSy, 0, 0x492050, alphaPlay, false);
  xCursor += wP + gapPL;
  const cL = xCursor + wL * 0.5;
  placeGlyph(scene._startL, cL, playCy, gS, gSy, 0, 0x492060, alphaPlay);
  xCursor += wL + gapLA;
  const cA = xCursor + wA * 0.5;
  placeGlyph(scene._startA, cA, playCy, gS, gSy, 0, 0x492030, alphaPlay);
  xCursor += wA + gapAY;
  scene._startY.setPosition(xCursor + wY * 0.5 + j(0x492070), playCy + j(0x492071));
  scene._startY.setAlpha(alphaPlay);

  drawHomeFacePanel(scene._playBaseMain, scene._playBaseDetail, panelL, panelT, panelW, panelH, {
    seed: 0x491300,
    flashMul,
    sfAlpha: sf.alpha,
    baseAlphaMin: 0.32,
    baseAlphaMax: 0.4,
  });

  const gTri = scene._playTriangle;
  gTri.clear();
  const tipX = triCx + triSize * 0.48;
  const baseLX = triCx - triSize * 0.42;
  const halfH = triSize * 0.4;
  gTri.fillStyle(0xe8f4ff, 1);
  gTri.beginPath();
  gTri.moveTo(tipX, triCy);
  gTri.lineTo(baseLX, triCy - halfH);
  gTri.lineTo(baseLX, triCy + halfH);
  gTri.closePath();
  gTri.fillPath();

  scene._startHitZone.setPosition(baseX, baseY);
  scene._startHitZone.setSize(panelW + 8, panelH + 8);

  const subColBias = _homeUiRandRange(0x493f00, 4, 8) * (_homeUiRandInt(0x493f01, 0, 1) ? 1 : -1);
  const subColX = L.centerX + subColBias;
  const subScaleMul = _homeUiRandRange(0x493e00, 0.64, 0.74);

  scene._delta.sub.forEach((sub, i) => {
    const row = scene._subRows[i];
    if (!row) return;
    const baseCY = L.subButtonCenterYs[i];
    const seed = 0x493000 + i * 997;
    const jx = _homeUiRandInt(seed, -7, 7);
    const jy = _homeUiRandInt(seed + 11, -7, 7);
    const rowShiftX = (i - 1) * _homeUiRandRange(seed + 3, 5, 9);

    const subHeadScale = gS * subScaleMul;

    row.head.setPosition(subColX + sub.offsetX + jx + rowShiftX, baseCY + sub.offsetY + jy);
    row.head.setScale(subHeadScale * sub.alpha, subHeadScale * sub.alpha);
    row.head.setRotation(0);
    row.head.setAlpha(sub.alpha * _homeUiRandRange(seed + 4, 0.88, 1.0));

    const gap = 6 + _homeUiRandInt(seed + 5, 0, 3);
    row.tail.setPosition(
      subColX + row.head.width * row.head.scaleX * 0.5 + gap + sub.offsetX + jx + rowShiftX,
      baseCY + sub.offsetY + jy + _homeUiRandInt(seed + 6, -5, 5),
    );
    row.tail.setAlpha(sub.alpha * _homeUiRandRange(seed + 7, 0.88, 1.0));

    const hb = row.head.getBounds();
    const tb = row.tail.getBounds();
    const rowMinX = Math.min(hb.x, tb.x);
    const rowMaxX = Math.max(hb.right, tb.right);
    const rowMinY = Math.min(hb.y, tb.y);
    const rowMaxY = Math.max(hb.bottom, tb.bottom);
    const padXSub = _homeUiRandRange(seed + 50, 12, 18);
    const padYSub = _homeUiRandRange(seed + 51, 8, 12);
    const boxL = rowMinX - padXSub;
    const boxR = rowMaxX + padXSub;
    const boxT = rowMinY - padYSub;
    const boxB = rowMaxY + padYSub;
    const boxW = boxR - boxL;
    const boxH = boxB - boxT;

    drawHomeFacePanel(row.subMain, row.subDet, boxL, boxT, boxW, boxH, {
      seed: seed + 600,
      flashMul: 1,
      sfAlpha: sub.alpha,
      baseAlphaMin: 0.22,
      baseAlphaMax: 0.3,
    });

    const zx = boxL - 2;
    const zy = boxT - 2;
    const zw = boxR - zx + 4;
    const zh = boxB - zy + 4;
    row.zone.setPosition(zx + zw * 0.5, zy + zh * 0.5);
    row.zone.setSize(zw, zh);
  });
}
