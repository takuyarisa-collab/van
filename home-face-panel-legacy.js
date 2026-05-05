import { _homeUiRandInt, _homeUiRandRange } from './home-rand.js';

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
 * Home 面 UI（ニュートラル板 + わずかなムラ + inset + 上ハイライト + 下シャドウ）— ドロップシャドウなし
 * 現行 Home シーンでは未使用。旧 Graphics パネル描画の退避。
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
