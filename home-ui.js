import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';

export const HOMEOVERLAP_TEX_KEY = 'home-overlap-title';

/** BootScene の boot-title-png と同じ比率（index.html: (WORLD_W * 0.82) / imgNatW） */
export function getBootOverlapTitleScale(scene) {
  const tex = scene.textures.get(HOMEOVERLAP_TEX_KEY);
  const srcW = tex.getSourceImage().width || 1;
  return (scene.scale.width * 0.82) / srcW;
}

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

  const HOME_OFFSET_BASE = -H * 0.045;
  const HOME_OFFSET_MAX = -H * 0.055;
  // 画面中央 (cx, cy) を基準。START は中央寄り（操作主役 + Boot 警告残骸との縦分離）
  let startCenterY = cy + H * 0.028;
  const startWidth = W * 0.52;
  const startHeight = H * 0.075;
  const subButtonWidth = W * 0.44;
  /** ヒットゾーン高さ（home-scene.js の zone と一致させる） */
  const subButtonHeight = 40;
  /** サブ行のプレースホルダ（先頭 O/E/R は PNG 1 文字切り出し、後続のみテキスト） */
  const subRowTails = Object.freeze(['/CONF', '-VIEW', '/DATA']);

  /** redrawHomeUI と同じ BOOT タイトルスケール（PLAY パネル下端の見積り用） */
  const bootTitleScale = (W * 0.82) / DEBRIS_NAT_W;
  const gSy = bootTitleScale;
  const playRefNatH = Math.max(
    HOMEOVERLAP_CROPS.P.h,
    HOMEOVERLAP_CROPS.L.h,
    HOMEOVERLAP_CROPS.A.h,
  );
  const playRowDispH = playRefNatH * gSy;
  const triDispH = HOMEOVERLAP_CROPS.V.h * gSy;
  const padYPlay = 12;
  const midGapPlay = 7;
  const playPanelHalfH = (padYPlay * 2 + triDispH + midGapPlay + playRowDispH) * 0.5;
  const playBottomY = (scy) => scy + playPanelHalfH;

  /** サブ面の描画が中心より下へはみ出す分（redrawHomeUI: padYSub + visualPadY の保守的下限） */
  const subVisualFootBelowCenter = H * 0.028;
  const clearanceAboveDebris = H * 0.012;

  const subLogRowBottomExtent = (enhanceY0, step) => {
    const logY0 = enhanceY0 + step * 2;
    return logY0 + subButtonHeight * 0.5 + subVisualFootBelowCenter;
  };

  /** ログ行中心の上限: 面の下端が残骸に届かないよう logY + subHalf + foot を抑える */
  const logCenterYMax =
    debrisTopY - clearanceAboveDebris - subVisualFootBelowCenter - subButtonHeight * 0.5;

  let HOME_Y_OFFSET = HOME_OFFSET_BASE;
  let subCenterStep = H * 0.132;
  const playSubGapMin = H * 0.052;
  const stepMin = H * 0.062;
  const stepMax = H * 0.1;
  const homeYScanMin = -H * 0.28;

  const layoutForHomeY = (oy) => {
    const scy = startCenterY + oy;
    const pb = playBottomY(scy);
    let enhanceY0 = Math.max(scy + H * 0.175, pb + playSubGapMin);
    const stepCap = (logCenterYMax - enhanceY0) * 0.5;
    if (stepCap < stepMin) return null;
    const step = Math.min(stepMax, Math.max(stepMin, stepCap));
    if (subLogRowBottomExtent(enhanceY0, step) > debrisTopY - clearanceAboveDebris) {
      return null;
    }
    return { enhanceY0, step };
  };

  let chosen = layoutForHomeY(HOME_Y_OFFSET);
  if (!chosen) {
    HOME_Y_OFFSET = HOME_OFFSET_MAX;
    chosen = layoutForHomeY(HOME_Y_OFFSET);
  }
  while (!chosen && HOME_Y_OFFSET > homeYScanMin) {
    HOME_Y_OFFSET -= 4;
    chosen = layoutForHomeY(HOME_Y_OFFSET);
  }
  if (chosen) {
    subCenterStep = chosen.step;
  } else {
    HOME_Y_OFFSET = homeYScanMin;
    chosen = layoutForHomeY(HOME_Y_OFFSET);
    if (chosen) subCenterStep = chosen.step;
  }

  startCenterY += HOME_Y_OFFSET;
  let enhanceY = startCenterY + H * 0.175;
  const playBottom = playBottomY(startCenterY);
  if (enhanceY < playBottom + playSubGapMin) {
    enhanceY = playBottom + playSubGapMin;
  }
  if (chosen && enhanceY + subCenterStep * 2 + subButtonHeight * 0.5 + subVisualFootBelowCenter > debrisTopY - clearanceAboveDebris) {
    enhanceY = chosen.enhanceY0;
  }
  let loadoutY = enhanceY + subCenterStep;
  let logY = loadoutY + subCenterStep;

  /** URL 未指定時と同等のベース位置（px、正で下）。?homeYOffset= はこれに加算 */
  const HOME_Y_OFFSET_BASE_PX = 150;
  const homeYOffsetPxParam =
    typeof window !== 'undefined' && window.HOME_PARAM_homeYOffsetPx != null
      ? window.HOME_PARAM_homeYOffsetPx
      : null;
  const homeYOffsetPxApplied = HOME_Y_OFFSET_BASE_PX + (homeYOffsetPxParam ?? 0);
  startCenterY += homeYOffsetPxApplied;
  enhanceY += homeYOffsetPxApplied;
  loadoutY += homeYOffsetPxApplied;
  logY += homeYOffsetPxApplied;

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
    homeYOffsetPxParam,
    /** ベース150px + URL の追加オフセットの合計 */
    homeYOffsetPxApplied,
    homeYAutoOffset: HOME_Y_OFFSET,
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

/** ニュートラルダークグレー（青・緑寄りを避ける） */
function _homeNeutralBaseRgb(seed) {
  const r = Math.floor(_homeUiRandRange(seed + 10, 42, 58));
  const g = Math.floor(_homeUiRandRange(seed + 11, 46, 56));
  const b = Math.floor(_homeUiRandRange(seed + 12, 50, 60));
  return (r << 16) | (g << 8) | b;
}

/** 角・辺を 1〜2px だけ欠けた多角形の板（クリック用矩形は変更しない） */
function _homeFillJaggedPanelFace(g, vx, vy, vW, vH, rgb, alpha, seed) {
  const cTl = _homeUiRandInt(seed, 1, 2);
  const cTr = _homeUiRandInt(seed + 1, 1, 2);
  const cBr = _homeUiRandInt(seed + 2, 1, 2);
  const cBl = _homeUiRandInt(seed + 3, 1, 2);
  const eTop = _homeUiRandInt(seed + 4, 0, 1);
  const eBot = _homeUiRandInt(seed + 5, 0, 1);
  g.fillStyle(rgb, alpha);
  g.beginPath();
  g.moveTo(vx, vy + cTl);
  g.lineTo(vx + cTl, vy);
  g.lineTo(vx + vW - eTop - cTr, vy);
  g.lineTo(vx + vW - eTop, vy + cTr);
  g.lineTo(vx + vW, vy + vH - cBr - eBot);
  g.lineTo(vx + vW - cBr, vy + vH - eBot);
  g.lineTo(vx + cBl, vy + vH);
  g.lineTo(vx, vy + vH - cBl);
  g.closePath();
  g.fillPath();
}

/** わずかなムラ（固定シード、複数帯の合成アルファ） */
function _homeFillPanelMottle(g, vx, vy, vW, vH, baseRgb, baseAlpha, seed) {
  const br = (baseRgb >> 16) & 0xff;
  const bg = (baseRgb >> 8) & 0xff;
  const bb = baseRgb & 0xff;
  const nBands = 5;
  for (let i = 0; i < nBands; i += 1) {
    const t = (i + 0.5) / nBands;
    const y0 = vy + vH * t * 0.92;
    const bh = Math.max(2, Math.floor(vH * (0.04 + _homeUiRandRange(seed + 20 + i, 0.02, 0.05))));
    const drift = _homeUiRandInt(seed + 30 + i, -4, 4);
    const d = _homeUiRandInt(seed + 40 + i, -7, 7);
    const rr = Math.max(0, Math.min(255, br + d));
    const rg = Math.max(0, Math.min(255, bg + d - 2));
    const rb = Math.max(0, Math.min(255, bb + d - 1));
    const rgb = (rr << 16) | (rg << 8) | rb;
    const a = baseAlpha * _homeUiRandRange(seed + 50 + i, 0.06, 0.12);
    g.fillStyle(rgb, a);
    g.fillRect(vx + drift, y0, vW - Math.abs(drift) * 2, bh);
  }
}

/**
 * Boot / Home の full-bleed 背景（home-bg-normal）と同じ cover 幾何で、ワールド矩形に対応する
 * テクスチャ領域を setCrop し、表示サイズを panelW×panelH に合わせる。
 * _homeRebuildPanel（center, max(rsx,rsy)）と同じ Ox, Oy, coverScale。
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Image} img
 * @param {number} panelL
 * @param {number} panelT
 * @param {number} panelW
 * @param {number} panelH
 * @param {object} [opts]
 * @param {string} [opts.textureKey='home-bg-normal']
 * @param {number} [opts.alpha=1]
 */
export function layoutHomeBgNormalCropPanel(scene, img, panelL, panelT, panelW, panelH, opts = {}) {
  if (!img || img.destroyed) return;
  const texKey = opts.textureKey ?? 'home-bg-normal';
  const alpha = opts.alpha ?? 1;
  if (!scene.textures.exists(texKey)) {
    img.setVisible(false);
    return;
  }
  const W = scene.scale.width;
  const H = scene.scale.height;
  const tex = scene.textures.get(texKey);
  const srcW = tex.source[0]?.width ?? W;
  const srcH = tex.source[0]?.height ?? H;
  const coverScale = Math.max(W / srcW, H / srcH);
  const dispW = srcW * coverScale;
  const dispH = srcH * coverScale;
  const Ox = (W - dispW) * 0.5;
  const Oy = (H - dispH) * 0.5;

  let tx0 = (panelL - Ox) / coverScale;
  let ty0 = (panelT - Oy) / coverScale;
  let tw = panelW / coverScale;
  let th = panelH / coverScale;

  tx0 = Math.max(0, tx0);
  ty0 = Math.max(0, ty0);
  tw = Math.max(1, Math.min(tw, srcW - tx0));
  th = Math.max(1, Math.min(th, srcH - ty0));

  img.setTexture(texKey);
  img.setPosition(panelL + panelW * 0.5, panelT + panelH * 0.5);
  img.setOrigin(0.5, 0.5);
  img.setCrop(
    Math.max(0, Math.floor(tx0)),
    Math.max(0, Math.floor(ty0)),
    Math.min(Math.ceil(tw), srcW - Math.max(0, Math.floor(tx0))),
    Math.min(Math.ceil(th), srcH - Math.max(0, Math.floor(ty0))),
  );
  img.setDisplaySize(panelW, panelH);
  img.setAlpha(alpha);
  img.setVisible(true);
}

/**
 * Home 面 UI（ニュートラル板 + わずかなムラ + inset + 上ハイライト + 下シャドウ）— ドロップシャドウなし
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
    visualPadX = 0,
    visualPadY = 0,
  } = opts;
  gMain.clear();
  gDet.clear();
  const panelW = Math.max(1, w);
  const panelH = Math.max(1, h);
  const vx = x - visualPadX;
  const vy = y - visualPadY;
  const vW = panelW + visualPadX * 2;
  const vH = panelH + visualPadY * 2;

  const baseRgb = _homeNeutralBaseRgb(seed);
  const baseMainAlpha =
    _homeUiRandRange(seed, baseAlphaMin, baseAlphaMax) * flashMul * sfAlpha;

  _homeFillJaggedPanelFace(gMain, vx, vy, vW, vH, baseRgb, baseMainAlpha, seed);
  _homeFillPanelMottle(gMain, vx, vy, vW, vH, baseRgb, baseMainAlpha, seed);

  const innerInset = 3;
  const inL = vx + innerInset;
  const inT = vy + innerInset;
  const inW = Math.max(1, vW - innerInset * 2);
  const inH = Math.max(1, vH - innerInset * 2);
  const innerGlowAlpha = _homeUiRandRange(seed + 1, 0.08, 0.14) * flashMul * sfAlpha;
  const gR = Math.floor(_homeUiRandRange(seed + 13, 52, 68));
  const gG = Math.floor(_homeUiRandRange(seed + 14, 52, 66));
  const gB = Math.floor(_homeUiRandRange(seed + 15, 56, 70));
  const innerRgb = (gR << 16) | (gG << 8) | gB;
  gDet.fillStyle(innerRgb, innerGlowAlpha);
  gDet.fillRect(inL, inT, inW, inH);

  const hiEdgeInset = 2;
  const hiLineAlpha = _homeUiRandRange(seed + 2, 0.32, 0.42) * flashMul * sfAlpha;
  const hiW = Math.max(1, vW - hiEdgeInset * 2);
  const hiX = vx + (vW - hiW) * 0.5;
  const hiY = vy + hiEdgeInset;
  const hiH = 2;
  const hiRgb = 0xd8d4ce;
  gDet.fillStyle(hiRgb, hiLineAlpha);
  gDet.fillRect(hiX, hiY, hiW, hiH);

  const shEdgeInset = 2;
  const shLineAlpha = _homeUiRandRange(seed + 3, 0.38, 0.52) * flashMul * sfAlpha;
  const shH = 2;
  const shY = vy + vH - shEdgeInset - shH;
  gDet.fillStyle(0x000000, shLineAlpha);
  gDet.fillRect(vx, shY, vW, shH);
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
 * Home 表示時: Boot の背景パネル除去に加え、タイトル PNG・警告・ログを破棄する
 * （Home 上にエラー系・OVERLAP 残骸が残らないようにする）。
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
  bs._warnText1?.destroy?.();
  bs._warnText2?.destroy?.();
  bs._warnFrame?.destroy?.();
  bs._warnText1 = bs._warnText2 = bs._warnFrame = null;
  bs._warnLayout = null;
  bs._logPool?.forEach((t) => t.destroy());
  bs._logPool = null;
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
  const Vcrop = Cr.V;
  const playRefNatH = Math.max(P.h, Ltr.h, A.h);
  scene._homePlayRefNatH = playRefNatH;

  const bootTitleScale = getBootOverlapTitleScale(scene);
  const gS = bootTitleScale * sf.scaleX;
  const gSy = bootTitleScale * sf.scaleY;

  const wP = P.w * gS;
  const wL = Ltr.w * gS;
  const wA = A.w * gS;
  const gapPL = _homeUiRandRange(0x492010, 10, 16);
  const gapLA = _homeUiRandRange(0x492011, 20, 30);
  const gapAY = _homeUiRandRange(0x492012, 12, 18);

  const wY = scene._startY.width;
  const playRowDispH = playRefNatH * gSy;

  const totalW = wP + gapPL + wL + gapLA + wA + gapAY + wY;
  const padX = _homeUiRandRange(0x491101, 26, 38);
  const padY = _homeUiRandRange(0x491102, 10, 14);
  const triDispW = Vcrop.w * gS;
  const triDispH = Vcrop.h * gSy;
  const triSize = Math.max(triDispW, triDispH);
  const midGap = _homeUiRandRange(0x491104, 5, 9);

  const panelW = Math.max(totalW, triSize * 1.05) + padX * 2;
  const panelH = padY * 2 + triDispH + midGap + playRowDispH;
  const panelL = baseX - panelW * 0.5;
  const panelT = baseY - panelH * 0.5;

  const gx = (s) => _homeUiRandInt(s, -2, 2);
  const gy = (s) => _homeUiRandInt(s, -2, 2);
  const alphaPlay = Math.min(
    1,
    flashMul * sf.alpha * _homeUiRandRange(0x492100, 0.85, 1.0),
  );

  layoutHomeBgNormalCropPanel(scene, scene._playBgPanelImg, panelL, panelT, panelW, panelH, {
    alpha: alphaPlay,
  });

  const playRowShiftX = _homeUiRandInt(0x49205d, -2, 2);
  const triCx = baseX + playRowShiftX + gx(0x492200);
  const triCy = panelT + padY + triDispH * 0.5 + gy(0x492201);
  const playCy =
    panelT + padY + triDispH + midGap + playRowDispH * 0.5 + gy(0x492202);

  const placeGlyph = (img, cx, cy, sx, sy, rotDeg, seed, alpha, applyFrameRot = true) => {
    img.setPosition(cx + gx(seed + 1), cy + gy(seed + 2));
    img.setScale(sx, sy);
    const extraRot = applyFrameRot ? sf.rotation : 0;
    img.setRotation(Phaser.Math.DegToRad(rotDeg + extraRot));
    img.setAlpha(alpha);
  };

  let xCursor = baseX - totalW * 0.5 + playRowShiftX;
  const cP = xCursor + wP * 0.5;
  placeGlyph(scene._startP, cP, playCy, gS, gSy, 0, 0x492050, alphaPlay, false);
  xCursor += wP + gapPL;
  const cL = xCursor + wL * 0.5;
  placeGlyph(scene._startL, cL, playCy, gS, gSy, 0, 0x492060, alphaPlay);
  xCursor += wL + gapLA;
  const cA = xCursor + wA * 0.5;
  placeGlyph(scene._startA, cA, playCy, gS, gSy, 0, 0x492030, alphaPlay);
  xCursor += wA + gapAY;
  scene._startY.setPosition(
    xCursor + wY * 0.5 + gx(0x492070),
    playCy + gy(0x492071) + (scene._startYBaselineOffset ?? 0),
  );
  scene._startY.setAlpha(alphaPlay * (scene._startYGlyphAlpha ?? 1));

  placeGlyph(scene._startV, triCx, triCy, gS, gSy, -90, 0x492210, alphaPlay, false);

  scene._startHitZone.setPosition(baseX, baseY);
  scene._startHitZone.setSize(panelW + 8, panelH + 8);

  const subColBias = _homeUiRandRange(0x493f00, 4, 8) * (_homeUiRandInt(0x493f01, 0, 1) ? 1 : -1);
  const subColX = L.centerX + subColBias;

  const _cy0 = L.subButtonCenterYs[0];
  const _cy1 = L.subButtonCenterYs[1];
  const _cy2 = L.subButtonCenterYs[2];
  const _subGap01 = _cy1 - _cy0;
  const _subGap12 = _cy2 - _cy1;

  scene._delta.sub.forEach((sub, i) => {
    const row = scene._subRows[i];
    if (!row) return;
    const baseCY = L.subButtonCenterYs[i];
    const seed = 0x493000 + i * 997;
    const jx = _homeUiRandInt(seed, -2, 2);
    const jy = _homeUiRandInt(seed + 11, -2, 2);
    const rowShiftX = (i - 1) * _homeUiRandInt(seed + 3, 3, 7);

    const subRowAlpha = sub.alpha * _homeUiRandRange(seed + 4, 0.85, 1.0);

    row.head.setPosition(subColX + sub.offsetX + jx + rowShiftX, baseCY + sub.offsetY + jy);
    row.head.setScale(gS * sub.alpha, gSy * sub.alpha);
    row.head.setRotation(0);
    row.head.setAlpha(subRowAlpha);

    const gap = 6 + _homeUiRandInt(seed + 5, 0, 3);
    row.tail.setPosition(
      subColX + row.head.width * row.head.scaleX * 0.5 + gap + sub.offsetX + jx + rowShiftX,
      baseCY + sub.offsetY + jy + _homeUiRandInt(seed + 6, -2, 2),
    );
    row.tail.setAlpha(sub.alpha * _homeUiRandRange(seed + 7, 0.85, 1.0));

    const hb = row.head.getBounds();
    const tb = row.tail.getBounds();
    const rowMinX = Math.min(hb.x, tb.x);
    const rowMaxX = Math.max(hb.right, tb.right);
    const rowMinY = Math.min(hb.y, tb.y);
    const rowMaxY = Math.max(hb.bottom, tb.bottom);
    const padXSub = _homeUiRandRange(seed + 50, 32, 46);
    const padYSub = _homeUiRandRange(seed + 51, 20, 30);
    const boxL = rowMinX - padXSub;
    const boxR = rowMaxX + padXSub;
    const boxT = rowMinY - padYSub;
    const boxB = rowMaxY + padYSub;
    const boxW = boxR - boxL;
    let boxH = boxB - boxT;
    /** 描画は visualPadY 分上下に広がるため、隣接行中心間で重ならないよう高さを抑える */
    const _vPadSub = 10;
    const _gapSafe = 6;
    const maxH0 = Math.max(28, _subGap01 - 2 * _vPadSub - _gapSafe);
    const maxH1 = Math.max(28, Math.min(_subGap01, _subGap12) - 2 * _vPadSub - _gapSafe);
    const maxH2 = Math.max(28, _subGap12 - 2 * _vPadSub - _gapSafe);
    if (i === 0) boxH = Math.min(boxH, maxH0);
    else if (i === 1) boxH = Math.min(boxH, maxH1);
    else boxH = Math.min(boxH, maxH2);
    const cyBox = (rowMinY + rowMaxY) * 0.5;
    const boxTAdj = cyBox - boxH * 0.5;

    layoutHomeBgNormalCropPanel(scene, row.bgPanelImg, boxL, boxTAdj, boxW, boxH, {
      alpha: subRowAlpha,
    });

    const zx = boxL - 2;
    const zy = boxT - 2;
    const zw = boxR - zx + 4;
    const zh = boxB - zy + 4;
    row.zone.setPosition(zx + zw * 0.5, zy + zh * 0.5);
    row.zone.setSize(zw, zh);
  });
}
