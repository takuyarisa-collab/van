import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';
import { getHomeUrlBgDisplayOverrides } from './home-bg-panels.js';
import { redrawHomePlayUI } from './home-play-ui.js';
import { redrawHomeSubUI } from './home-sub-ui.js';
import { logHomeUrlLayoutDebugOnce } from './home-url-debug.js';

export { HOMEOVERLAP_TEX_KEY } from './home-overlap-constants.js';
export { homeUrlDebugEnabled } from './home-url-debug.js';
export { getBootOverlapTitleScale } from './home-boot-title-scale.js';
export { getHomeLayout } from './home-layout.js';
export { layoutHomeBgNormalCropPanel, getHomeUrlBgDisplayOverrides } from './home-bg-panels.js';

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

export { drawHomeFacePanel } from './home-face-panel-legacy.js';

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
  const urlBgDisp = getHomeUrlBgDisplayOverrides();
  const link = scene._homeLinkReveal;
  const playReveal = link?.play ?? 1;
  const subReveal = link?.sub;
  redrawHomePlayUI(scene, L, urlBgDisp, playReveal);
  redrawHomeSubUI(scene, L, urlBgDisp, subReveal);
  logHomeUrlLayoutDebugOnce(scene);
}
