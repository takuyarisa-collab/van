import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';
import { SUB_BG_PANEL_DISPLAY_H_DEFAULT } from './home-bg-panels.js';

/** サブ行の中心間隔（px）。?subSpacing= で上書き */
const SUB_ROW_SPACING_DEFAULT_PX = 80;
function _homeResolvedSubDisplayHForLayout() {
  if (typeof window === 'undefined') return SUB_BG_PANEL_DISPLAY_H_DEFAULT;
  const url = window.HOME_PARAM_subDisplayH;
  if (url != null && typeof url === 'number' && url > 0 && Number.isFinite(url)) {
    return url;
  }
  return SUB_BG_PANEL_DISPLAY_H_DEFAULT;
}

/** 行中心間隔（?subSpacing= があれば上書き、なければ既定 px） */
function _homeResolvedSubSpacingForLayout() {
  if (typeof window !== 'undefined' && window.HOME_PARAM_subSpacing != null) {
    const u = window.HOME_PARAM_subSpacing;
    if (typeof u === 'number' && u > 0 && Number.isFinite(u)) return u;
  }
  return SUB_ROW_SPACING_DEFAULT_PX;
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

  const subSpacingResolved = _homeResolvedSubSpacingForLayout();

  let HOME_Y_OFFSET = HOME_OFFSET_BASE;
  const playSubGapMin = H * 0.052;
  const homeYScanMin = -H * 0.28;

  const layoutForHomeY = (oy) => {
    const scy = startCenterY + oy;
    const pb = playBottomY(scy);
    const enhanceY0 = Math.max(scy + H * 0.175, pb + playSubGapMin);
    if (subLogRowBottomExtent(enhanceY0, subSpacingResolved) > debrisTopY - clearanceAboveDebris) {
      return null;
    }
    return { enhanceY0 };
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
  if (!chosen) {
    HOME_Y_OFFSET = homeYScanMin;
    chosen = layoutForHomeY(HOME_Y_OFFSET);
  }

  startCenterY += HOME_Y_OFFSET;
  let enhanceY = startCenterY + H * 0.175;
  const playBottom = playBottomY(startCenterY);
  if (enhanceY < playBottom + playSubGapMin) {
    enhanceY = playBottom + playSubGapMin;
  }
  if (
    chosen &&
    enhanceY + subSpacingResolved * 2 + subButtonHeight * 0.5 + subVisualFootBelowCenter >
      debrisTopY - clearanceAboveDebris
  ) {
    enhanceY = chosen.enhanceY0;
  }
  let loadoutY = enhanceY + subSpacingResolved;
  let logY = loadoutY + subSpacingResolved;

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

  /** PLAY 先頭サブ行との距離（px、正でサブ列を下へ）。PLAY 位置には影響しない */
  const playSubGapPx =
    typeof window !== 'undefined' &&
    typeof window.HOME_PARAM_playSubGapPx === 'number' &&
    Number.isFinite(window.HOME_PARAM_playSubGapPx)
      ? window.HOME_PARAM_playSubGapPx
      : 0;
  enhanceY += playSubGapPx;
  loadoutY += playSubGapPx;
  logY += playSubGapPx;

  /** homeYOffset・playSubGap 適用後の先頭サブ行中心 Y */
  const baseRowCenterY = enhanceY;

  const playCenterX = centerX;
  const playCenterY = startCenterY;
  const baseSubCenterX = centerX;
  const subCenterX = centerX;
  const subCenterY = Object.freeze([enhanceY, loadoutY, logY]);
  /** 後方互換: 各行の論理中心（背景・文字の subCenterY[i] と同一） */
  const subButtonCenterYs = subCenterY;

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
    playCenterX,
    playCenterY,
    subCenterX,
    subCenterY,
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
    /** サブ行の中心間隔（URL subSpacing または既定 px） */
    subRowSpacing: subSpacingResolved,
    subSpacing: subSpacingResolved,
    /** 先頭サブ行の中心 Y（rowIndex=0）。rowCenterY = baseRowCenterY + subSpacing*rowIndex + subNOffsetY */
    baseRowCenterY,
    /** サブ列の基準 X（rowCenterX = baseSubCenterX + sub.offsetX + subNOffsetX） */
    baseSubCenterX,
    /** ?playSubGap= でサブ行のみ縦シフトした px（PLAY には非適用） */
    playSubGapPx,
  });
}
