/** overlap-title.png 上の切り出し矩形（1536×1024、RGBA）— Home UI はこの PNG のみ使用 */
export const HOMEOVERLAP_CROPS = Object.freeze({
  /** overlap-title 上、左→右 O / V / E / R / L / A / P（座標は画像に合わせる） */
  O: Object.freeze({ x: 304, y: 458, w: 100, h: 92 }),
  V: Object.freeze({ x: 424, y: 458, w: 99, h: 92 }),
  E: Object.freeze({ x: 546, y: 458, w: 83, h: 92 }),
  R: Object.freeze({ x: 659, y: 458, w: 88, h: 92 }),
  L: Object.freeze({ x: 774, y: 458, w: 73, h: 92 }),
  A: Object.freeze({ x: 885, y: 458, w: 107, h: 93 }),
  P: Object.freeze({ x: 1013, y: 458, w: 93, h: 93 }),
  /** 上ライン（PLAY 帯・文字 glyph とは別管理） */
  line_top: Object.freeze({ x: 500, y: 458, w: 292, h: 13 }),
  /** 下ライン */
  line_bottom: Object.freeze({ x: 450, y: 590, w: 466, h: 10 }),
  /** 左縦（上・下ライン間） */
  playLeftBar: Object.freeze({ x: 450, y: 481, w: 21, h: 119 }),
});
