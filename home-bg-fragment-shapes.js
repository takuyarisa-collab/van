/**
 * PLAY / SUB の背景を「home-bg-normal の崩壊断片」に見せるためのローカル座標ポリゴンとマスク描画。
 * 完全長方形は避け、非対称・欠け・軽い傾きで同一 UI 部品感を抑える。
 */

const D2R = Math.PI / 180;

function degToRad(d) {
  return d * D2R;
}

/**
 * @param {{ x: number, y: number }[]} pts
 * @param {number} cx
 * @param {number} cy
 * @param {number} rotRad
 * @returns {{ x: number, y: number }[]}
 */
export function transformFragmentPoints(pts, cx, cy, rotRad) {
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  return pts.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

/**
 * @param {Phaser.GameObjects.Graphics} g
 * @param {{ x: number, y: number }[]} worldPts
 */
export function drawFragmentGeometryMask(g, worldPts) {
  if (!g || g.destroyed || !worldPts?.length) return;
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillPoints(worldPts, true, true);
}

/**
 * 断片外縁＋黒帯（崩壊）との接続を示すやや強い辺。PLAY は上側、SUB は行ごとにずらす。
 *
 * @param {Phaser.GameObjects.Graphics} g
 * @param {{ x: number, y: number }[]} worldPts
 * @param {object} opts
 * @param {'play'|'sub'} opts.kind
 * @param {number} [opts.rowIndex]
 * @param {number} [opts.alphaScale=1] パネル本体アルファに連動
 */
export function drawFragmentFaultOutline(g, worldPts, opts) {
  if (!g || g.destroyed || !worldPts?.length) return;
  const kind = opts?.kind ?? 'sub';
  const rowIndex = opts?.rowIndex ?? 0;
  const a = Math.min(1, Math.max(0, opts?.alphaScale ?? 1));
  if (a < 0.02) {
    g.clear();
    return;
  }
  g.clear();

  const n = worldPts.length;
  let faultSeg = 0;
  if (kind === 'play') {
    let bestMinY = Infinity;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const my = (worldPts[i].y + worldPts[j].y) * 0.5;
      if (my < bestMinY) {
        bestMinY = my;
        faultSeg = i;
      }
    }
  } else {
    faultSeg = [1, 3, 2][rowIndex % 3];
  }

  const baseCol = 0x0a111c;
  const faultCol = 0x030711;

  g.beginPath();
  g.moveTo(worldPts[0].x, worldPts[0].y);
  for (let i = 1; i < n; i += 1) {
    g.lineTo(worldPts[i].x, worldPts[i].y);
  }
  g.closePath();

  g.lineStyle(1.15, baseCol, 0.36 * a);
  g.strokePath();

  const i0 = faultSeg;
  const i1 = (faultSeg + 1) % n;
  g.lineStyle(
    kind === 'play' ? 2.35 : 1.85,
    faultCol,
    (kind === 'play' ? 0.58 : 0.52) * a,
  );
  g.beginPath();
  g.moveTo(worldPts[i0].x, worldPts[i0].y);
  g.lineTo(worldPts[i1].x, worldPts[i1].y);
  g.strokePath();

  const cx = worldPts.reduce((s, p) => s + p.x, 0) / n;
  const cy = worldPts.reduce((s, p) => s + p.y, 0) / n;
  g.lineStyle(0.85, 0x141c2a, 0.2 * a);
  if (kind === 'play') {
    g.lineBetween(cx - 62, cy - 8, cx + 48, cy + 14);
    g.lineBetween(cx + 38, cy - 22, cx + 92, cy - 6);
  } else {
    const ox = rowIndex * 17 - 17;
    g.lineBetween(cx - 40 + ox, cy + 5, cx + 55 + ox, cy - 4);
  }
}

/**
 * 横長メイン断片: 左上欠け、軽い傾き、底辺より上辺がわずかに長い見せかけの不等辺。
 *
 * @param {number} dispW
 * @param {number} dispH
 */
export function buildPlayFragmentLocalPoints(dispW, dispH) {
  const hw = dispW * 0.5;
  const hh = dispH * 0.5;
  const rot = degToRad(-3.1);
  const raw = [
    { x: -hw * 0.52, y: -hh * 0.35 },
    { x: -hw * 0.18, y: -hh * 0.88 },
    { x: hw * 0.94, y: -hh * 0.82 },
    { x: hw * 0.98, y: hh * 0.72 },
    { x: hw * 0.35, y: hh * 0.88 },
    { x: -hw * 0.48, y: hh * 0.62 },
    { x: -hw * 0.90, y: hh * 0.05 },
  ];
  return transformFragmentPoints(raw, 0, 0, rot);
}

/**
 * SUB 3 行別。面積・欠け位置・傾きを変え「複製 UI」に見えないようにする。
 *
 * @param {number} dispW
 * @param {number} dispH
 * @param {number} rowIndex 0..2
 */
export function buildSubFragmentLocalPoints(dispW, dispH, rowIndex) {
  const hw = dispW * 0.5;
  const hh = dispH * 0.5;
  const ri = rowIndex % 3;

  const variants = [
    {
      sc: 0.96,
      rot: degToRad(3.4),
      raw: [
        { x: -hw * 0.88, y: -hh * 0.72 },
        { x: hw * 0.42, y: -hh * 0.85 },
        { x: hw * 0.92, y: -hh * 0.38 },
        { x: hw * 0.78, y: hh * 0.75 },
        { x: -hw * 0.22, y: hh * 0.82 },
        { x: -hw * 0.95, y: hh * 0.22 },
      ],
    },
    {
      sc: 1.04,
      rot: degToRad(-2.7),
      raw: [
        { x: -hw * 0.72, y: -hh * 0.78 },
        { x: hw * 0.88, y: -hh * 0.58 },
        { x: hw * 0.95, y: hh * 0.42 },
        { x: hw * 0.15, y: hh * 0.90 },
        { x: -hw * 0.65, y: hh * 0.68 },
        { x: -hw * 0.92, y: -hh * 0.15 },
      ],
    },
    {
      sc: 0.92,
      rot: degToRad(2.2),
      raw: [
        { x: -hw * 0.65, y: -hh * 0.82 },
        { x: hw * 0.55, y: -hh * 0.88 },
        { x: hw * 0.88, y: -hh * 0.5 },
        { x: hw * 0.72, y: hh * 0.78 },
        { x: -hw * 0.55, y: hh * 0.85 },
        { x: -hw * 0.82, y: -hh * 0.12 },
      ],
    },
  ];

  const v = variants[ri];
  const s = v.sc;
  const scaled = v.raw.map((p) => ({ x: p.x * s, y: p.y * s }));
  return transformFragmentPoints(scaled, 0, 0, v.rot);
}
