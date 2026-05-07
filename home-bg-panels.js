import { homeUrlDebugEnabled } from './home-url-debug.js';

function _homeUrlBgDisplayOverrides() {
  if (typeof window === 'undefined') {
    return { playW: null, playH: null, subW: null, subH: null };
  }
  return {
    playW: window.HOME_PARAM_playDisplayW ?? null,
    playH: window.HOME_PARAM_playDisplayH ?? null,
    subW: window.HOME_PARAM_subDisplayW ?? null,
    subH: window.HOME_PARAM_subDisplayH ?? null,
  };
}

/** PLAY 背景パネル表示サイズ（crop 独立。?playW= / ?playH= で上書き） */
export const PLAY_BG_PANEL_DISPLAY_W_DEFAULT = 580;
export const PLAY_BG_PANEL_DISPLAY_H_DEFAULT = 450;
/** サブ背景パネル表示サイズ（3行共通。?subW= / ?subH= で上書き） */
export const SUB_BG_PANEL_DISPLAY_W_DEFAULT = 550;
export const SUB_BG_PANEL_DISPLAY_H_DEFAULT = 450;

/**
 * Boot / Home 背景（home-bg-normal）から HOME_BG_PANEL_CROPS で定義した矩形を setCrop し、
 * 表示サイズは opts.displayW / opts.displayH で指定（crop との分離）。未指定時は crop と同寸にフォールバック。
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
 * @param {{ x: number, y: number, w: number, h: number }} opts.panelCrop HOME_BG_PANEL_CROPS の矩形（素材範囲のみ）
 * @param {number} [opts.displayW] テクスチャ表示幅（setDisplaySize）
 * @param {number} [opts.displayH] テクスチャ表示高さ（setDisplaySize）
 * @param {number} [opts.imgCenterX] 画像中心 X（未指定時は panel 矩形の中心）
 * @param {number} [opts.imgCenterY] 画像中心 Y（未指定時は panel 矩形の中心）
 * @param {'PLAY'|'SUB'} [opts.debugLogKind] ?debug=1 のときだけ console.log に渡す
 * @param {number} [opts.debugRowIndex] SUB 行番号（0-based）
 */
export function layoutHomeBgNormalCropPanel(scene, img, panelL, panelT, panelW, panelH, opts = {}) {
  if (!img || img.destroyed) return;
  const texKey = opts.textureKey ?? 'home-bg-normal';
  const alpha = opts.alpha ?? 1;
  const panelCrop = opts.panelCrop;
  if (
    !panelCrop ||
    typeof panelCrop.x !== 'number' ||
    typeof panelCrop.y !== 'number' ||
    typeof panelCrop.w !== 'number' ||
    typeof panelCrop.h !== 'number'
  ) {
    img.setVisible(false);
    if (homeUrlDebugEnabled()) {
      console.warn('[home-bg-crop-panel] panelCrop missing or invalid', { textureKey: texKey, opts });
    }
    return;
  }
  if (!scene.textures.exists(texKey)) {
    img.setVisible(false);
    if (homeUrlDebugEnabled()) {
      const kind = opts.debugLogKind ?? '?';
      const row = opts.debugRowIndex;
      console.log('[home-bg-crop-panel]', {
        kind,
        row,
        panelL,
        panelT,
        panelW,
        panelH,
        note: 'texture missing',
        textureKey: texKey,
        imgVisible: img.visible,
        imgDepth: img.depth,
      });
    }
    return;
  }
  const tex = scene.textures.get(texKey);
  const srcW = tex.source[0]?.width ?? 0;
  const srcH = tex.source[0]?.height ?? 0;
  const cropX = panelCrop.x;
  const cropY = panelCrop.y;
  const cropW = panelCrop.w;
  const cropH = panelCrop.h;
  if (
    cropX < 0 ||
    cropY < 0 ||
    cropW < 1 ||
    cropH < 1 ||
    cropX + cropW > srcW ||
    cropY + cropH > srcH
  ) {
    img.setVisible(false);
    if (homeUrlDebugEnabled()) {
      console.warn('[home-bg-crop-panel] panelCrop out of texture bounds', {
        textureKey: texKey,
        srcW,
        srcH,
        cropX,
        cropY,
        cropW,
        cropH,
      });
    }
    return;
  }

  const displayW = opts.displayW ?? cropW;
  const displayH = opts.displayH ?? cropH;
  const imgCx = opts.imgCenterX != null ? opts.imgCenterX : panelL + panelW * 0.5;
  const imgCy = opts.imgCenterY != null ? opts.imgCenterY : panelT + panelH * 0.5;

  img.setTexture(texKey);
  img.setPosition(imgCx, imgCy);
  img.setOrigin(0.5, 0.5);
  img.setCrop(cropX, cropY, cropW, cropH);
  img.setDisplaySize(displayW, displayH);
  img.setAlpha(alpha);
  img.setVisible(true);

  if (homeUrlDebugEnabled()) {
    const kind = opts.debugLogKind ?? '?';
    const row = opts.debugRowIndex;
    console.log('[home-bg-crop-panel]', {
      kind,
      row,
      panelL,
      panelT,
      panelW,
      panelH,
      cropX,
      cropY,
      cropW,
      cropH,
      displayW,
      displayH,
      imgCenterX: imgCx,
      imgCenterY: imgCy,
      imgDisplayWidth: img.displayWidth,
      imgDisplayHeight: img.displayHeight,
      imgWidth: img.width,
      imgHeight: img.height,
      imgVisible: img.visible,
      imgDepth: img.depth,
    });
  }
}

/** @returns {{ playW: number|null, playH: number|null, subW: number|null, subH: number|null }} */
export function getHomeUrlBgDisplayOverrides() {
  return _homeUrlBgDisplayOverrides();
}

export { HOME_BG_PANEL_CROPS } from './home-bg-panel-crops.js';
