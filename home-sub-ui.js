import {
  HOME_BG_PANEL_CROPS,
  SUB_BG_PANEL_DISPLAY_H_DEFAULT,
  SUB_BG_PANEL_DISPLAY_W_DEFAULT,
  layoutHomeBgNormalCropPanel,
} from './home-bg-panels.js';
import { homeUrlDebugEnabled } from './home-url-debug.js';
import { getBootOverlapTitleScale } from './home-boot-title-scale.js';
import { _homeUiRandInt, _homeUiRandRange } from './home-rand.js';

/** 3行共通の大きなサブ背景用 crop（新規 crop 禁止のため既存 SUB_PANEL の1つを流用） */
const SUB_UNIFIED_BG_PANEL_CROP = HOME_BG_PANEL_CROPS.SUB_PANEL_1;

/**
 * 角欠け・線欠損のある薄いサブ行フレーム（正常な矩形枠に見えないよう分割ストローク）
 *
 * @param {Phaser.GameObjects.Graphics} gfx
 * @param {number} cx
 * @param {number} cy
 * @param {number} fw
 * @param {number} fh
 * @param {number} seed
 */
function strokeBrokenSubRowFrame(gfx, cx, cy, fw, fh, seed) {
  gfx.clear();
  if (fw < 10 || fh < 10) return;

  const halfW = fw * 0.5;
  const halfH = fh * 0.5;
  const xl = cx - halfW;
  const xr = cx + halfW;
  const yt = cy - halfH;
  const yb = cy + halfH;

  const col = 0x8f7a6a;
  const segA = 0.38;
  gfx.lineStyle(1, col, segA);

  const chopT = Math.min(5 + _homeUiRandInt(seed, 0, 5), Math.max(4, fh * 0.16));
  const chopB = Math.min(4 + _homeUiRandInt(seed + 3, 0, 5), Math.max(3, fh * 0.14));
  const chopL = Math.min(4 + _homeUiRandInt(seed + 6, 0, 4), Math.max(3, fw * 0.06));
  const chopR = Math.min(4 + _homeUiRandInt(seed + 9, 0, 4), Math.max(3, fw * 0.06));

  const u0 = _homeUiRandRange(seed + 12, 0.22, 0.34);
  const u1 = _homeUiRandRange(seed + 13, 0.42, 0.55);
  const u2 = _homeUiRandRange(seed + 14, 0.62, 0.78);

  const v0 = _homeUiRandRange(seed + 15, 0.18, 0.32);
  const v1 = _homeUiRandRange(seed + 16, 0.45, 0.58);
  const v2 = _homeUiRandRange(seed + 17, 0.68, 0.82);

  // top: 欠けた角 + 中央ギャップ
  if (xl + chopT < xl + fw * u0 - 1) {
    gfx.lineBetween(xl + chopT, yt, xl + fw * u0, yt);
  }
  if (xl + fw * u1 < xl + fw * u2 - 2) {
    gfx.lineBetween(xl + fw * u1, yt, xl + fw * u2, yt);
  }
  const topSegR0 = xl + fw * u2 + _homeUiRandInt(seed + 18, 8, 18);
  const topSegR1 = xr - chopR;
  if (topSegR0 < topSegR1 - 2) {
    gfx.lineBetween(topSegR0, yt, topSegR1, yt);
  }

  // bottom: 線を一部カット
  const xB0a = xl + chopL * 1.2;
  const xB0b = xl + fw * v0;
  if (xB0a < xB0b - 1) {
    gfx.lineBetween(xB0a, yb, xB0b, yb);
  }
  if (xl + fw * v1 < xl + fw * v2 - 1) {
    gfx.lineBetween(xl + fw * v1, yb, xl + fw * v2, yb);
  }

  // left
  const yL0a = yt + chopT;
  const yL0b = yt + fh * u0;
  if (yL0a < yL0b - 1) {
    gfx.lineBetween(xl, yL0a, xl, yL0b);
  }
  const yL1a = yt + fh * u1;
  const yL1b = yb - fh * (1 - v2);
  if (yL1a < yL1b - 1) {
    gfx.lineBetween(xl, yL1a, xl, yL1b);
  }
  const yStubLo = yb - chopB - _homeUiRandInt(seed + 50, 4, 9);
  if (yStubLo < yb - chopB - 1) {
    gfx.lineBetween(xl, yStubLo, xl, yb - chopB);
  }

  // right + 短い欠け斜め（発光なしの欠片感）
  const yR0a = yt + chopR;
  const yR0b = yt + fh * v0 * 0.95;
  if (yR0a < yR0b - 1) {
    gfx.lineBetween(xr, yR0a, xr, yR0b);
  }
  const yR1a = yt + fh * v1;
  const yR1b = yb - fh * (1 - u2);
  if (yR1a < yR1b - 1) {
    gfx.lineBetween(xr, yR1a, xr, yR1b);
  }
  const yR2a = yb - chopB;
  const yR2b = yb - Math.max(1, chopB * 0.32);
  if (yR2a < yR2b - 1) {
    gfx.lineBetween(xr, yR2a, xr, yR2b);
  }

  const diag = _homeUiRandInt(seed + 40, 5, 9);
  gfx.lineBetween(xr - 1, yt + chopR * 0.5, xr - diag, yt + chopR * 0.5 + diag * 0.6);
}

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

  const row0CenterY = L.subCenterY[0];
  const row2CenterY = L.subCenterY[2];
  const subBgTop = row0CenterY - subBgDispH * 0.5;
  const subBgBottom = row2CenterY + subBgDispH * 0.5;
  const subBgHeight = subBgBottom - subBgTop;
  const subBgCenterY = subBgTop + subBgHeight * 0.5;
  const subBgCenterX = L.subCenterX;
  const subPanelL = subBgCenterX - subBgDispW * 0.5;

  let minSubRowAlpha = 1;

  scene._delta.sub.forEach((sub, i) => {
    const row = scene._subRows[i];
    if (!row) return;
    const seed = 0x493000 + i * 997;
    const jx = _homeUiRandInt(seed, -2, 2);
    const rowCenterY = L.subCenterY[i];
    const rowShiftX = (i - 1) * _homeUiRandInt(seed + 3, 3, 7);

    const subRowAlpha = sub.alpha * _homeUiRandRange(seed + 4, 0.85, 1.0);
    minSubRowAlpha = Math.min(minSubRowAlpha, subRowAlpha);

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

    const zx = boxL - 2;
    const zy = boxT - 2;
    const zw = boxR - zx + 4;
    const zh = boxB - zy + 4;
    row.zone.setPosition(zx + zw * 0.5, zy + zh * 0.5);
    row.zone.setSize(zw, zh);

    const fpX = _homeUiRandRange(seed + 60, 10, 16);
    const fpY = _homeUiRandRange(seed + 61, 4, 8);
    const textBlockH = Math.max(headH, tailH);
    const frameW = totalW + fpX * 2;
    const frameH = textBlockH + fpY * 2;
    const frameGfx = scene._subRowFrameGfxs?.[i];
    if (frameGfx) {
      strokeBrokenSubRowFrame(frameGfx, rowCenterX, panelCenterY, frameW, frameH, seed + 200);
      frameGfx.setAlpha(subRowAlpha);
      frameGfx.setVisible(true);
    }

    if (homeUrlDebugEnabled()) {
      console.log('[SUB_Y_CHECK]', {
        row: i,
        rowCenterY,
        panelCenterY,
        unifiedBgY: scene._subBgPanelImg ? scene._subBgPanelImg.y : null,
        headY: row.head.y,
        tailY: row.tail.y,
        subDisplayH: subBgDispH,
        subUnifiedDisplayH: subBgHeight,
      });
    }
  });

  if (scene._subBgPanelImg) {
    layoutHomeBgNormalCropPanel(scene, scene._subBgPanelImg, subPanelL, subBgTop, subBgDispW, subBgHeight, {
      alpha: minSubRowAlpha,
      panelCrop: SUB_UNIFIED_BG_PANEL_CROP,
      displayW: subBgDispW,
      displayH: subBgHeight,
      imgCenterX: subBgCenterX,
      imgCenterY: subBgCenterY,
      debugLogKind: 'SUB',
    });
  }
}
