import {
  HOME_BG_PANEL_CROPS,
  SUB_BG_PANEL_DISPLAY_H_DEFAULT,
  SUB_BG_PANEL_DISPLAY_W_DEFAULT,
  layoutHomeBgNormalCropPanel,
} from './home-bg-panels.js';
import { homeUrlDebugEnabled } from './home-url-debug.js';
import { getBootOverlapTitleScale } from './home-boot-title-scale.js';
import { _homeUiRandInt, _homeUiRandRange } from './home-rand.js';

const SUB_PANEL_CROPS = [
  HOME_BG_PANEL_CROPS.SUB_PANEL_0,
  HOME_BG_PANEL_CROPS.SUB_PANEL_1,
  HOME_BG_PANEL_CROPS.SUB_PANEL_2,
];

/**
 * 各行の URL 微小オフセット（未指定時 0）
 * g8l1ja: sub0..2 OffsetX/Y
 */
function _subNOffsetXY(i) {
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

function _subNPanelOffsetXY(i) {
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

function _subNTextOffsetXY(i) {
  if (typeof window === 'undefined') return { ox: 0, oy: 0 };
  const ox = [
    window.HOME_PARAM_sub0TextOffsetX,
    window.HOME_PARAM_sub1TextOffsetX,
    window.HOME_PARAM_sub2TextOffsetX,
  ][i];
  const oy = [
    window.HOME_PARAM_sub0TextOffsetY,
    window.HOME_PARAM_sub1TextOffsetY,
    window.HOME_PARAM_sub2TextOffsetY,
  ][i];
  return {
    ox: typeof ox === 'number' && Number.isFinite(ox) ? ox : 0,
    oy: typeof oy === 'number' && Number.isFinite(oy) ? oy : 0,
  };
}

/**
 * @param {Phaser.Scene} scene
 * @param {object} L HOME_LAYOUT
 * @param {{ subW: number|null, subH: number|null }} urlBgDisp
 * @param {number[]|null} [subReveal] 行ごとの点灯 0〜1（長さ3・省略時は全非表示扱いにならず 1）
 *
 * t56q44: rowCenterY = baseRowCenterY + subSpacing * rowIndex + subNOffsetY
 * 9ebtba: rowCenterX = baseSubCenterX + sub.offsetX + subNOffsetX
 */
export function redrawHomeSubUI(scene, L, urlBgDisp, subReveal = null) {
  const sf = scene._delta.startFrame;
  const bootTitleScale = getBootOverlapTitleScale(scene);
  const gS = bootTitleScale * sf.scaleX;
  const gSy = bootTitleScale * sf.scaleY;

  let subBgDispW = SUB_BG_PANEL_DISPLAY_W_DEFAULT;
  let subBgDispH = SUB_BG_PANEL_DISPLAY_H_DEFAULT;
  if (urlBgDisp.subW != null) subBgDispW = urlBgDisp.subW;
  if (urlBgDisp.subH != null) subBgDispH = urlBgDisp.subH;
  scene._homeDbgSubDisplayW = subBgDispW;
  scene._homeDbgSubDisplayH = subBgDispH;

  const baseRowCenterY = L.baseRowCenterY ?? L.subCenterY[0];
  const baseSubCenterX = L.baseSubCenterX ?? L.subCenterX;
  const subSpacing = L.subSpacing ?? L.subRowSpacing;

  scene._delta.sub.forEach((sub, i) => {
    const row = scene._subRows[i];
    if (!row?.bgPanelImg) return;
    const seed = 0x493000 + i * 997;
    const revealMul =
      subReveal && subReveal.length === 3
        ? Phaser.Math.Clamp(subReveal[i], 0, 1)
        : 1;

    const { ox: subNOffsetX, oy: subNOffsetY } = _subNOffsetXY(i);
    const { ox: subNPanelOx, oy: subNPanelOy } = _subNPanelOffsetXY(i);
    const { ox: subNTextOx, oy: subNTextOy } = _subNTextOffsetXY(i);

    const rowBaseX = baseSubCenterX + sub.offsetX + subNOffsetX;
    const rowBaseY = baseRowCenterY + subSpacing * i + subNOffsetY;
    const rowTextX = rowBaseX + subNTextOx;
    const rowTextY = rowBaseY + subNTextOy;
    const rowPanelX = rowBaseX + subNPanelOx;
    const rowPanelY = rowBaseY + subNPanelOy;

    const subRowAlpha = revealMul * sub.alpha * _homeUiRandRange(seed + 4, 0.85, 1.0);

    row.head.setScale(gS * sub.alpha, gSy * sub.alpha);

    const gap = 6 + _homeUiRandInt(seed + 5, 0, 3);
    const headW = row.head.displayWidth;
    const tailW = row.tail.width;
    const tailH = row.tail.height;
    const totalW = headW + gap + tailW;
    const leftX = rowTextX - totalW * 0.5;
    const headCenterX = leftX + headW * 0.5;
    const tailLeftX = leftX + headW + gap;
    row.head.setPosition(headCenterX, rowTextY);
    row.head.setRotation(0);
    row.head.setAlpha(subRowAlpha);

    row.tail.setPosition(tailLeftX, rowTextY);
    row.tail.setAlpha(revealMul * sub.alpha * _homeUiRandRange(seed + 7, 0.85, 1.0));

    const headH = row.head.displayHeight;
    const rowMinX = leftX;
    const rowMaxX = tailLeftX + tailW;
    const rowMinY = rowTextY - Math.max(headH, tailH) * 0.5;
    const rowMaxY = rowTextY + Math.max(headH, tailH) * 0.5;
    const padXSub = _homeUiRandRange(seed + 50, 52, 72);
    const padYSub = _homeUiRandRange(seed + 51, 32, 46);
    const boxL = rowMinX - padXSub;
    const boxR = rowMaxX + padXSub;
    const boxT = rowMinY - padYSub;
    const boxB = rowMaxY + padYSub;

    const zx = boxL - 2;
    const zy = boxT - 2;
    const zw = boxR - zx + 4;
    const zh = boxB - zy + 4;
    row.zone.setPosition(zx + zw * 0.5, zy + zh * 0.5);
    row.zone.setSize(zw, zh);

    const panelL = rowPanelX - subBgDispW * 0.5;
    const panelT = rowPanelY - subBgDispH * 0.5;

    layoutHomeBgNormalCropPanel(scene, row.bgPanelImg, panelL, panelT, subBgDispW, subBgDispH, {
      alpha: subRowAlpha,
      panelCrop: SUB_PANEL_CROPS[i],
      displayW: subBgDispW,
      displayH: subBgDispH,
      imgCenterX: rowPanelX,
      imgCenterY: rowPanelY,
      debugLogKind: 'SUB',
      debugRowIndex: i,
    });

    if (homeUrlDebugEnabled()) {
      console.log('[SUB_Y_CHECK]', {
        row: i,
        rowBaseX,
        rowBaseY,
        rowTextY,
        rowPanelY,
        headY: row.head.y,
        tailY: row.tail.y,
        subDisplayH: subBgDispH,
        subSpacing,
        subNOffsetX,
        subNOffsetY,
        subNPanelOx,
        subNPanelOy,
        subNTextOx,
        subNTextOy,
      });
    }
  });
}
