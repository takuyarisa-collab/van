/**
 * home-bg-normal.png（941×1672）から PLAY/SUB が参照する矩形クロップ。
 * 実表示は GeometryMask で非長方形に切り出すが、素材はこの領域からサンプルして「同一背景が裂けた」連続性を保つ。
 */
export const HOME_BG_PANEL_CROPS = Object.freeze({
  /** h 調整。y は面の中心維持（y = y旧 + h旧/2 - h新/2） */
  PLAY_PANEL: Object.freeze({ x: 156, y: 532, w: 620, h: 384 }),
  SUB_PANEL_0: Object.freeze({ x: 304, y: 696, w: 480, h: 192 }),
  SUB_PANEL_1: Object.freeze({ x: 192, y: 968, w: 480, h: 192 }),
  SUB_PANEL_2: Object.freeze({ x: 296, y: 584, w: 480, h: 192 }),
});
