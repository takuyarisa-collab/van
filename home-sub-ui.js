import {
  HOME_BG_PANEL_CROPS,
  SUB_BG_PANEL_DISPLAY_H_DEFAULT,
  SUB_BG_PANEL_DISPLAY_W_DEFAULT,
  layoutHomeBgNormalCropPanel,
} from './home-bg-panels.js';
import { homeUrlDebugEnabled } from './home-url-debug.js';
import { getBootOverlapTitleScale } from './home-boot-title-scale.js';
import { _homeUiRandInt, _homeUiRandRange } from './home-rand.js';

/**
 * @param {Phaser.Scene} scene
 * @param {object} L HOME_LAYOUT
 * @param {{ subW: number|null, subH: number|null }} urlBgDisp
 */
export function redrawHomeSubUI(scene, L, urlBgDisp) {
  const sf = scene._delta.startFrame;
  const bootTitleScale = getBootOverlapTitleScale(scene);
  const gS = bootTitleScale * sf.scaleX;
  const gSy = bootTitleScale * sf.scaleY;

  const subColBias = _homeUiRandRange(0x493f00, 4, 8) * (_homeUiRandInt(0x493f01, 0, 1) ? 1 : -1);
  const subColX = L.subCenterX + subColBias;

  let subBgDispW = SUB_BG_PANEL_DISPLAY_W_DEFAULT;
  let subBgDispH = SUB_BG_PANEL_DISPLAY_H_DEFAULT;
  if (urlBgDisp.subW != null) subBgDispW = urlBgDisp.subW;
  if (urlBgDisp.subH != null) subBgDispH = urlBgDisp.subH;
  scene._homeDbgSubDisplayW = subBgDispW;
  scene._homeDbgSubDisplayH = subBgDispH;

  scene._delta.sub.forEach((sub, i) => {
    const row = scene._subRows[i];
    if (!row) return;
    const seed = 0x493000 + i * 997;
    const jx = _homeUiRandInt(seed, -2, 2);
    const rowCenterY = L.subCenterY[i];
    const rowShiftX = (i - 1) * _homeUiRandInt(seed + 3, 3, 7);

    const subRowAlpha = sub.alpha * _homeUiRandRange(seed + 4, 0.85, 1.0);

    row.head.setScale(gS * sub.alpha, gSy * sub.alpha);

    const gap = 6 + _homeUiRandInt(seed + 5, 0, 3);
    const rowCenterX = subColX + sub.offsetX + jx + rowShiftX;
    const panelCenterY = rowCenterY;

    const headW = row.head.displayWidth;
    const tailW = row.tail.width;
    const tailH = row.tail.height;
    const totalW = headW + gap + tailW;
    const leftX = rowCenterX - totalW * 0.5;
    const headCenterX = leftX + headW * 0.5;
    const tailLeftX = leftX + headW + gap;
    row.head.setPosition(headCenterX, panelCenterY);
    row.head.setRotation(0);
    row.head.setAlpha(subRowAlpha);

    row.tail.setPosition(tailLeftX, panelCenterY);
    row.tail.setAlpha(sub.alpha * _homeUiRandRange(seed + 7, 0.85, 1.0));

    const headH = row.head.displayHeight;
    const rowMinX = leftX;
    const rowMaxX = tailLeftX + tailW;
    const rowMinY = panelCenterY - Math.max(headH, tailH) * 0.5;
    const rowMaxY = panelCenterY + Math.max(headH, tailH) * 0.5;
    const padXSub = _homeUiRandRange(seed + 50, 52, 72);
    const padYSub = _homeUiRandRange(seed + 51, 32, 46);
    const boxL = rowMinX - padXSub;
    const boxR = rowMaxX + padXSub;
    const boxT = rowMinY - padYSub;
    const boxB = rowMaxY + padYSub;
    const boxW = boxR - boxL;

    const subCropKeys = ['SUB_PANEL_0', 'SUB_PANEL_1', 'SUB_PANEL_2'];
    layoutHomeBgNormalCropPanel(scene, row.bgPanelImg, boxL, panelCenterY - subBgDispH * 0.5, boxW, subBgDispH, {
      alpha: subRowAlpha,
      panelCrop: HOME_BG_PANEL_CROPS[subCropKeys[i]],
      displayW: subBgDispW,
      displayH: subBgDispH,
      imgCenterX: rowCenterX,
      imgCenterY: panelCenterY,
      debugLogKind: 'SUB',
      debugRowIndex: i,
    });

    const zx = boxL - 2;
    const zy = boxT - 2;
    const zw = boxR - zx + 4;
    const zh = boxB - zy + 4;
    row.zone.setPosition(zx + zw * 0.5, zy + zh * 0.5);
    row.zone.setSize(zw, zh);

    if (homeUrlDebugEnabled()) {
      console.log('[SUB_Y_CHECK]', {
        row: i,
        rowCenterY,
        panelCenterY,
        bgY: row.bgPanelImg ? row.bgPanelImg.y : null,
        headY: row.head.y,
        tailY: row.tail.y,
        subDisplayH: subBgDispH,
      });
    }
  });
}
