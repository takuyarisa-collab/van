import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';
import { getBootOverlapTitleScale } from './home-boot-title-scale.js';
import {
  HOME_BG_PANEL_CROPS,
  PLAY_BG_PANEL_DISPLAY_H_DEFAULT,
  PLAY_BG_PANEL_DISPLAY_W_DEFAULT,
  layoutHomeBgNormalCropPanel,
} from './home-bg-panels.js';
import { _homeUiRandInt, _homeUiRandRange } from './home-rand.js';

/**
 * @param {Phaser.Scene} scene
 * @param {object} L HOME_LAYOUT
 * @param {{ playW: number|null, playH: number|null }} urlBgDisp
 */
export function redrawHomePlayUI(scene, L, urlBgDisp) {
  const sf = scene._delta.startFrame;
  const playCenterX = L.playCenterX + sf.offsetX;
  const playCenterY = L.playCenterY + sf.offsetY;
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
  const padX = _homeUiRandRange(0x491101, 41, 60);
  const padY = _homeUiRandRange(0x491102, 22, 34);
  const triDispW = Vcrop.w * gS;
  const triDispH = Vcrop.h * gSy;
  const triSize = Math.max(triDispW, triDispH);
  const midGap = _homeUiRandRange(0x491104, 5, 9);

  /** クリック用ヒット矩形（従来どおり・変更しない） */
  const panelW = Math.max(totalW, triSize * 1.05) + padX * 2;
  const panelH = padY * 2 + triDispH + midGap + playRowDispH;
  const panelL = playCenterX - panelW * 0.5;
  const panelT = playCenterY - panelH * 0.5;

  const playContentH = triDispH + midGap + playRowDispH;
  let playBgDispW = PLAY_BG_PANEL_DISPLAY_W_DEFAULT;
  let playBgDispH = PLAY_BG_PANEL_DISPLAY_H_DEFAULT;
  if (urlBgDisp.playW != null) playBgDispW = urlBgDisp.playW;
  if (urlBgDisp.playH != null) playBgDispH = urlBgDisp.playH;
  scene._homeDbgPlayDisplayW = playBgDispW;
  scene._homeDbgPlayDisplayH = playBgDispH;

  const gx = (s) => _homeUiRandInt(s, -2, 2);
  const alphaPlay = Math.min(
    1,
    flashMul * sf.alpha * _homeUiRandRange(0x492100, 0.85, 1.0),
  );

  layoutHomeBgNormalCropPanel(scene, scene._playBgPanelImg, panelL, panelT, panelW, panelH, {
    alpha: alphaPlay,
    panelCrop: HOME_BG_PANEL_CROPS.PLAY_PANEL,
    displayW: playBgDispW,
    displayH: playBgDispH,
    imgCenterX: playCenterX,
    imgCenterY: playCenterY,
    debugLogKind: 'PLAY',
  });

  /** ▷ + P/L/A/y の外接矩形の中心を playCenter に一致 */
  const playBlockTop = playCenterY - playContentH * 0.5;
  const triCx = playCenterX;
  const triCy = playBlockTop + triDispH * 0.5;
  const playCy = playBlockTop + triDispH + midGap + playRowDispH * 0.5;

  const placeGlyph = (img, cx, cy, sx, sy, rotDeg, seed, alpha, applyFrameRot = true) => {
    img.setPosition(cx + gx(seed + 1), cy);
    img.setScale(sx, sy);
    const extraRot = applyFrameRot ? sf.rotation : 0;
    img.setRotation(Phaser.Math.DegToRad(rotDeg + extraRot));
    img.setAlpha(alpha);
  };

  let xCursor = playCenterX - totalW * 0.5;
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
    playCy + (scene._startYBaselineOffset ?? 0),
  );
  scene._startY.setAlpha(alphaPlay * (scene._startYGlyphAlpha ?? 1));

  placeGlyph(scene._startV, triCx, triCy, gS, gSy, -90, 0x492210, alphaPlay, false);

  scene._startHitZone.setPosition(playCenterX, playCenterY);
  scene._startHitZone.setSize(panelW + 8, panelH + 8);
}
