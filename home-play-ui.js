import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';
import { getBootOverlapTitleScale } from './home-boot-title-scale.js';
import {
  HOME_BG_PANEL_CROPS,
  PLAY_BG_PANEL_DISPLAY_H_DEFAULT,
  PLAY_BG_PANEL_DISPLAY_W_DEFAULT,
  layoutHomeBgNormalCropPanel,
} from './home-bg-panels.js';
import { _homeUiRandInt, _homeUiRandRange } from './home-rand.js';
import {
  buildPlayFragmentLocalPoints,
  drawFragmentFaultOutline,
  drawFragmentGeometryMask,
} from './home-bg-fragment-shapes.js';

function _homePlayUrlOffsets() {
  if (typeof window === 'undefined') {
    return {
      poX: 0,
      poY: 0,
      ppX: 0,
      ppY: 0,
      ptX: 0,
      ptY: 0,
    };
  }
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    poX: n(window.HOME_PARAM_playOffsetX),
    poY: n(window.HOME_PARAM_playOffsetY),
    ppX: n(window.HOME_PARAM_playPanelOffsetX),
    ppY: n(window.HOME_PARAM_playPanelOffsetY),
    ptX: n(window.HOME_PARAM_playTextOffsetX),
    ptY: n(window.HOME_PARAM_playTextOffsetY),
  };
}

/** Boot 崩壊中など `_delta` 未整備時と同一の中立フレーム */
export const HOME_PLAY_NEUTRAL_START_FRAME = Object.freeze({
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  alpha: 1,
  rotation: 0,
});

function _resolvePlayGlyphYWidthPx(scene) {
  const w = scene?._startY?.width;
  if (typeof w === 'number' && Number.isFinite(w) && w > 0) return w;
  try {
    const home = scene?.scene?.get?.('home');
    const w2 = home?._startY?.width;
    if (typeof w2 === 'number' && Number.isFinite(w2) && w2 > 0) return w2;
  } catch (_) {
    /* ignore */
  }
  return 30;
}

/**
 * redrawHomePlayUI と同一式の PLAY パネル矩形（最終位置の基準。Boot シャード吸着ターゲット用）
 *
 * @param {Phaser.Scene} scene
 * @param {object} L HOME_LAYOUT
 * @param {{ playW: number|null, playH: number|null }} urlBgDisp
 * @param {object} [startFrame] scene._delta.startFrame 相当
 */
export function computePlayPanelLayoutForShardFormation(
  scene,
  L,
  urlBgDisp,
  startFrame = HOME_PLAY_NEUTRAL_START_FRAME,
) {
  const sf = startFrame;
  const playCenterX = L.playCenterX + sf.offsetX;
  const playCenterY = L.playCenterY + sf.offsetY;
  const { poX, poY, ppX, ppY, ptX, ptY } = _homePlayUrlOffsets();
  const baseCx = playCenterX + poX;
  const baseCy = playCenterY + poY;
  const textCx = baseCx + ptX;
  const textCy = baseCy + ptY;
  const panelImgCx = baseCx + ppX;
  const panelImgCy = baseCy + ppY;

  const Cr = HOMEOVERLAP_CROPS;
  const P = Cr.P;
  const Ltr = Cr.L;
  const A = Cr.A;
  const Vcrop = Cr.V;
  const playRefNatH = Math.max(P.h, Ltr.h, A.h);

  const bootTitleScale = getBootOverlapTitleScale(scene);
  const gS = bootTitleScale * sf.scaleX;
  const gSy = bootTitleScale * sf.scaleY;

  const wP = P.w * gS;
  const wL = Ltr.w * gS;
  const wA = A.w * gS;
  const gapPL = _homeUiRandRange(0x492010, 10, 16);
  const gapLA = _homeUiRandRange(0x492011, 20, 30);
  const gapAY = _homeUiRandRange(0x492012, 12, 18);

  const wY = _resolvePlayGlyphYWidthPx(scene);
  const playRowDispH = playRefNatH * gSy;

  const totalW = wP + gapPL + wL + gapLA + wA + gapAY + wY;
  const padX = _homeUiRandRange(0x491101, 41, 60);
  const padY = _homeUiRandRange(0x491102, 22, 34);
  const triDispW = Vcrop.w * gS;
  const triDispH = Vcrop.h * gSy;
  const triSize = Math.max(triDispW, triDispH);
  const midGap = _homeUiRandRange(0x491104, 5, 9);

  const panelW = Math.max(totalW, triSize * 1.05) + padX * 2;
  const panelH = padY * 2 + triDispH + midGap + playRowDispH;
  const panelL = baseCx - panelW * 0.5;
  const panelT = baseCy - panelH * 0.5;

  const playContentH = triDispH + midGap + playRowDispH;
  let playBgDispW = PLAY_BG_PANEL_DISPLAY_W_DEFAULT;
  let playBgDispH = PLAY_BG_PANEL_DISPLAY_H_DEFAULT;
  if (urlBgDisp.playW != null) playBgDispW = urlBgDisp.playW;
  if (urlBgDisp.playH != null) playBgDispH = urlBgDisp.playH;

  return {
    baseCx,
    baseCy,
    textCx,
    textCy,
    panelImgCx,
    panelImgCy,
    panelL,
    panelT,
    panelW,
    panelH,
    playRefNatH,
    playRowDispH,
    playContentH,
    playBgDispW,
    playBgDispH,
    triDispH,
    midGap,
    gS,
    gSy,
    totalW,
    wP,
    wY,
    gapPL,
    wL,
    gapLA,
    wA,
    gapAY,
  };
}

/**
 * @param {Phaser.Scene} scene
 * @param {object} L HOME_LAYOUT
 * @param {{ playW: number|null, playH: number|null }} urlBgDisp
 * @param {number} [linkReveal=1] Boot→Home 再接続後の PLAY 行点灯（0〜1）
 */
export function redrawHomePlayUI(scene, L, urlBgDisp, linkReveal = 1) {
  const sf = scene._delta.startFrame;
  const core = computePlayPanelLayoutForShardFormation(scene, L, urlBgDisp, sf);
  const {
    baseCx,
    baseCy,
    textCx,
    textCy,
    panelImgCx,
    panelImgCy,
    panelL,
    panelT,
    panelW,
    panelH,
    playRefNatH,
    playRowDispH,
    playContentH,
    playBgDispW,
    playBgDispH,
    triDispH,
    midGap,
    gS,
    gSy,
    totalW,
    wP,
    wY,
    gapPL,
    wL,
    gapLA,
    wA,
    gapAY,
  } = core;
  scene._homePlayRefNatH = playRefNatH;

  const flashMul = scene._startPressFlash ? 1.15 : 1.0;
  const lr = Phaser.Math.Clamp(linkReveal, 0, 1);
  /** Boot→Home 再接続中のみ: 断片ごとの点灯（未設定時は lr のみ） */
  const gr = scene._overlapGlyphReveal;
  const effGlyph = (k) => Math.max(lr, gr?.[k] ?? 0);
  const glyphBoost = gr
    ? Math.max(
        gr.P ?? 0,
        gr.L ?? 0,
        gr.A ?? 0,
        gr.V ?? 0,
        gr.y ?? 0,
      )
    : 0;
  const lrPanel = Math.max(lr, glyphBoost);
  const bgPr = scene._homeBgPanelReveal?.play ?? 1;
  const formReveal = scene._playFormationPanelRevealMul;
  const formMul =
    typeof formReveal === 'number' && Number.isFinite(formReveal)
      ? Phaser.Math.Clamp(formReveal, 0, 1)
      : 1;

  const gx = (s) => _homeUiRandInt(s, -2, 2);
  const rBase = _homeUiRandRange(0x492100, 0.85, 1.0);
  const alphaPlay = Math.min(
    1,
    lrPanel * flashMul * sf.alpha * rBase * bgPr * formMul,
  );
  scene._homeDbgPlayDisplayW = playBgDispW;
  scene._homeDbgPlayDisplayH = playBgDispH;
  const alphaP = Math.min(1, effGlyph('P') * flashMul * sf.alpha * rBase);
  const alphaL = Math.min(1, effGlyph('L') * flashMul * sf.alpha * rBase);
  const alphaA = Math.min(1, effGlyph('A') * flashMul * sf.alpha * rBase);
  const alphaV = Math.min(1, effGlyph('V') * flashMul * sf.alpha * rBase);
  const alphaY = Math.min(1, effGlyph('y') * flashMul * sf.alpha * rBase);

  layoutHomeBgNormalCropPanel(scene, scene._playBgPanelImg, panelL, panelT, panelW, panelH, {
    alpha: alphaPlay,
    panelCrop: HOME_BG_PANEL_CROPS.PLAY_PANEL,
    displayW: playBgDispW,
    displayH: playBgDispH,
    imgCenterX: panelImgCx,
    imgCenterY: panelImgCy,
    debugLogKind: 'PLAY',
  });

  if (!scene._playBgPanelImg.visible) {
    scene._playBgMaskGfx?.clear?.();
    scene._playBgFragEdgeGfx?.clear?.();
  } else {
    const playLocal = buildPlayFragmentLocalPoints(playBgDispW, playBgDispH);
    const playWorld = playLocal.map((p) => ({
      x: p.x + panelImgCx,
      y: p.y + panelImgCy,
    }));
    if (scene._playBgMaskGfx) drawFragmentGeometryMask(scene._playBgMaskGfx, playWorld);
    if (scene._playBgFragEdgeGfx) {
      drawFragmentFaultOutline(scene._playBgFragEdgeGfx, playWorld, {
        kind: 'play',
        alphaScale: alphaPlay,
      });
    }
  }

  /** ▷ + P/L/A/y の外接矩形の中心を text 基準に一致（パネル専用オフセットの影響を受けない） */
  const playBlockTop = textCy - playContentH * 0.5;
  const triCx = textCx;
  const triCy = playBlockTop + triDispH * 0.5;
  const playCy = playBlockTop + triDispH + midGap + playRowDispH * 0.5;

  const placeGlyph = (img, cx, cy, sx, sy, rotDeg, seed, alpha, applyFrameRot = true) => {
    img.setPosition(cx + gx(seed + 1), cy);
    img.setScale(sx, sy);
    const extraRot = applyFrameRot ? sf.rotation : 0;
    img.setRotation(Phaser.Math.DegToRad(rotDeg + extraRot));
    img.setAlpha(alpha);
  };

  let xCursor = textCx - totalW * 0.5;
  const cP = xCursor + wP * 0.5;
  placeGlyph(scene._startP, cP, playCy, gS, gSy, 0, 0x492050, alphaP, false);
  xCursor += wP + gapPL;
  const cL = xCursor + wL * 0.5;
  placeGlyph(scene._startL, cL, playCy, gS, gSy, 0, 0x492060, alphaL);
  xCursor += wL + gapLA;
  const cA = xCursor + wA * 0.5;
  placeGlyph(scene._startA, cA, playCy, gS, gSy, 0, 0x492030, alphaA);
  xCursor += wA + gapAY;
  scene._startY.setPosition(
    xCursor + wY * 0.5 + gx(0x492070),
    playCy + (scene._startYBaselineOffset ?? 0),
  );
  scene._startY.setAlpha(alphaY * (scene._startYGlyphAlpha ?? 1));

  placeGlyph(scene._startV, triCx, triCy, gS, gSy, -90, 0x492210, alphaV, false);

  scene._startHitZone.setPosition(baseCx, baseCy);
  scene._startHitZone.setSize(panelW + 8, panelH + 8);
}
