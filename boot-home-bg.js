/**
 * Boot / Home 用背景（Phaser Graphics）
 * - mountHomeNormalBg       … Home 正常背景（画像 + グリッド）
 * - mountHomeGridOnly       … Home グリッドのみ（再構築パネルは別 Image で載せる）
 * - mountBootHomeBackdrop   … 静的単色背景（後方互換 / 非 Home 正常状態用）
 * - mountBootCollapsedBackdrop … Boot 崩壊（レイヤーズレ＋微動→収束）
 * - mountHomeParticles      … 微粒子フェードアニメ（Home 専用）
 */

function mulberry32(seed) {
  return function rnd() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ベース背景: 単色ダーク塗りつぶし
 */
function drawLayerBase(g, W, H, gTop, gBot) {
  const gMid = 0x071a2f;
  const half = Math.round(H / 2);
  g.fillGradientStyle(gTop, gTop, gMid, gMid, 1, 1, 1, 1);
  g.fillRect(0, 0, W, half);
  g.fillGradientStyle(gMid, gMid, gBot, gBot, 1, 1, 1, 1);
  g.fillRect(0, half, W, H - half);
}

/**
 * 整列グリッド: 完全等間隔・統一線幅・欠けなし・ランダム性なし
 *
 * @param {Phaser.Scene} scene
 * @param {number} W
 * @param {number} H
 * @param {number} structAlpha
 * @param {number} depthBase
 * @returns {Phaser.GameObjects.Graphics}
 */
function buildCleanGrid(scene, W, H, structAlpha, depthBase) {
  const step = 52;
  const lineColor = 0x5c7cad;
  const lineWidth = 1.2;
  const lineAlpha = 0.10 * structAlpha;

  const g = scene.add.graphics();
  g.setDepth(depthBase + 1);
  g.lineStyle(lineWidth, lineColor, lineAlpha);

  for (let x = 0; x <= W; x += step) {
    g.lineBetween(x, 0, x, H);
  }
  for (let y = 0; y <= H; y += step) {
    g.lineBetween(0, y, W, y);
  }

  return g;
}

function drawLayerNoise(g, W, H, noiseAlpha, noiseDots, rnd) {
  for (let i = 0; i < noiseDots; i += 1) {
    const nx = rnd() * W;
    const ny = rnd() * H;
    const r = rnd() > 0.8 ? 1.5 + rnd() * 1.0 : 0.45 + rnd() * 1.35;
    const a = (0.15 + rnd() * 0.25) * noiseAlpha;
    g.fillStyle(0xc2d6f5, a);
    g.fillCircle(nx, ny, r);
    if (rnd() > 0.58) {
      g.lineStyle(0.6, 0x8ea0c8, a * 0.75);
      const lx = (rnd() - 0.5) * 18;
      const ly = (rnd() - 0.5) * 18;
      g.lineBetween(nx, ny, nx + lx, ny + ly);
    }
  }
}

/**
 * Boot/Collapsed 用: 静的2レイヤーグリッド（shimmer tween 付き）
 */
function drawLayerStructure(gStrong, gWeak, W, H, structAlpha, rnd) {
  const gridStep  = 52;
  const lineW     = 1.6;
  const emphFrac  = 0.20 + rnd() * 0.10;
  const blurBand  = 0.15;

  const diagLen = Math.hypot(W, H);
  const diagSign = (x, y) => (H * x - W * y) / diagLen;

  const drawLine = (x0, y0, x1, y1) => {
    const mx = (x0 + x1) * 0.5;
    const my = (y0 + y1) * 0.5;
    const d = diagSign(mx, my);

    let strong;
    if (d > blurBand) {
      strong = true;
    } else if (d < -blurBand) {
      strong = false;
    } else {
      const t = (d + blurBand) / (2 * blurBand);
      strong = rnd() < t;
    }

    const boost = rnd() < emphFrac;

    let a, w;
    if (strong) {
      const base = (0.80 + rnd() * 0.20) * structAlpha * 0.18;
      a = boost ? base * 1.5 : base;
      w = boost ? lineW + 0.8 : lineW;
    } else {
      const base = (0.30 + rnd() * 0.20) * structAlpha * 0.18;
      a = boost ? base * 1.5 : base;
      w = boost ? lineW + 0.8 : lineW;
    }

    const g = strong ? gStrong : gWeak;
    g.lineStyle(w, 0x5c7cad, a);
    g.lineBetween(x0, y0, x1, y1);
  };

  for (let x = 0; x <= W; x += gridStep) drawLine(x, 0, x, H);
  for (let y = 0; y <= H; y += gridStep) drawLine(0, y, W, y);

  gStrong.lineStyle(lineW - 0.4, 0x3d5a8a, 0.08 * structAlpha);
  gStrong.lineBetween(0, Math.floor(H * 0.42), W, Math.floor(H * 0.18));
  gStrong.lineStyle(lineW - 0.4, 0x2a4466, 0.07 * structAlpha);
  gStrong.lineBetween(0, Math.floor(H * 0.78), W, Math.floor(H * 0.62));

  const vx1 = Math.round(W * 0.22);
  const vx2 = Math.round(W * 0.81);
  gStrong.lineStyle(1, 0x4af0e4, 0.09 * structAlpha);
  gStrong.lineBetween(vx1, 0, vx1, H);
  gStrong.lineStyle(1, 0x4af0e4, 0.08 * structAlpha);
  gStrong.lineBetween(vx2, Math.round(H * 0.12), vx2, Math.round(H * 0.88));
}

function drawLayerUiFrags(g, W, H, fragAlpha, rnd) {
  const nArcs = 10;
  for (let i = 0; i < nArcs; i += 1) {
    const ax = rnd() * W;
    const ay = rnd() * H * 0.92;
    const rad = 16 + rnd() * 48;
    const c = rnd() > 0.48 ? 0x48e8ff : 0xff6078;
    g.lineStyle(1.1, c, (0.09 + rnd() * 0.1) * fragAlpha);
    const start = rnd() * Math.PI * 2;
    const sweep = 0.35 + rnd() * 1.1;
    g.beginPath();
    g.arc(ax, ay, rad, start, start + sweep, false);
    g.strokePath();
  }
  for (let i = 0; i < 18; i += 1) {
    const bx = rnd() * (W - 4);
    const by = rnd() * H;
    const bw = 6 + rnd() * 32;
    g.fillStyle(0x7a9cd4, (0.06 + rnd() * 0.07) * fragAlpha);
    g.fillRect(bx, by, bw, 1.5);
  }
  for (let i = 0; i < 12; i += 1) {
    const sx = rnd() * W;
    const sy = rnd() * H;
    g.lineStyle(1, 0x9db6e8, 0.075 * fragAlpha);
    g.lineBetween(
      sx,
      sy,
      sx + (rnd() - 0.5) * 26,
      sy + (rnd() - 0.5) * 26,
    );
  }
}

/**
 * Home 背景上側マスク + パネルオーバーレイ
 *
 * Row1 / Row2 を「背景画像の面」として表示する。
 * - GeometryMask は Row1+Row2 全体をベタ塗りで確保（黒穴を作らない）。
 * - Row1 オーバーレイ: 上端ハイライト線 + 下端影 + 金属パネル立体感
 * - Row2 オーバーレイ: 右に行くほど透明になる alpha グラデ面（欠損は補助のみ）
 * - タイル境界線は描画しない
 * - グリッドは最背面のまま（このメソッドは触らない）
 *
 * @param {Phaser.Scene} scene
 * @param {object} opts
 * @param {number}  [opts.width]
 * @param {number}  [opts.row1Cells=3]
 * @param {number}  [opts.row2Cells=2]
 * @param {Phaser.GameObjects.Image} [opts.targetImage]
 * @param {number}  [opts.overlayDepth=-58]  Row1/Row2 オーバーレイの depth
 * @returns {{ maskGraphics: Phaser.GameObjects.Graphics, overlayGfx: Phaser.GameObjects.Graphics, destroy: () => void }}
 */
export function mountHomeUpperMask(scene, opts = {}) {
  const W             = opts.width ?? scene.scale.width;
  const gridSize      = 52;
  const row1Cells     = opts.row1Cells ?? 3;
  const row2Cells     = opts.row2Cells ?? 2;
  const row1H         = gridSize * row1Cells;
  const row2H         = gridSize * row2Cells;
  const row2Y         = row1H;
  const totalH        = row1H + row2H;
  const targetImage   = opts.targetImage ?? null;
  const overlayDepth  = opts.overlayDepth ?? -58;

  // ── GeometryMask: Row1+Row2 全体をベタ塗り ──────────────────────────────
  const maskG = scene.make.graphics({ add: false });
  maskG.fillStyle(0xffffff, 1);
  maskG.fillRect(0, 0, W, totalH);

  if (targetImage) {
    targetImage.setMask(maskG.createGeometryMask());
  }

  // ── オーバーレイ（背景画像の上、UI より下） ──────────────────────────────
  const ov = scene.add.graphics();
  ov.setDepth(overlayDepth);

  // --- Row1: 金属パネル立体感 ---
  // 上端ハイライト（明るい線）
  ov.lineStyle(1.2, 0xd0e8ff, 0.28);
  ov.lineBetween(0, 0, W, 0);
  // 上から 1px 目の内側ハイライト（より薄め）
  ov.lineStyle(0.8, 0xb8d4f0, 0.14);
  ov.lineBetween(0, 1, W, 1);

  // Row1 下端シャドウ（暗い線）
  ov.lineStyle(1.2, 0x061220, 0.45);
  ov.lineBetween(0, row1H - 1, W, row1H - 1);
  ov.lineStyle(0.8, 0x0a1a2e, 0.22);
  ov.lineBetween(0, row1H - 2, W, row1H - 2);

  // Row1 全体に薄い上→下グラデ暗幕（金属パネルの影面）
  // Phaser.Graphics.fillGradientStyle は矩形単位なので2分割で近似
  const row1Mid = Math.round(row1H * 0.5);
  ov.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.08, 0.08);
  ov.fillRect(0, 0, W, row1Mid);
  ov.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0.08, 0.18, 0.18);
  ov.fillRect(0, row1Mid, W, row1H - row1Mid);

  // --- Row2: 右へ行くほど透明になる alpha グラデ面 ---
  // 縦長の短冊を横に並べて透明度を変える
  const STRIP_W = 4; // px 単位の短冊幅
  const nStrips = Math.ceil(W / STRIP_W);

  for (let i = 0; i < nStrips; i++) {
    const t = i / (nStrips - 1);            // 0 = 左端, 1 = 右端
    // 右端近くほど暗幕が濃くなる（背景画像を隠して透けさせる）
    // 左は alpha 0（オーバーレイなし）→ 右は alpha 0.82
    const fadeAlpha = Math.pow(t, 1.6) * 0.82;
    const sx = i * STRIP_W;
    const sw = Math.min(STRIP_W, W - sx);
    ov.fillStyle(0x11172a, fadeAlpha);
    ov.fillRect(sx, row2Y, sw, row2H);
  }

  // Row2 補助欠損: 小さな矩形をランダムに alpha 1.0 で重ねて局所的に消す
  // 黒ブロック感にならないよう右側に集中させ、数を少量に絞る
  const nGaps = Math.floor(3 + Math.random() * 5); // 3〜7 個
  for (let g = 0; g < nGaps; g++) {
    const t = 0.55 + Math.random() * 0.45;         // 右 55% 以降だけ
    const gx = Math.floor(t * (W - 32));
    const gw = Math.floor(12 + Math.random() * 28); // 12〜40px 幅
    const gy = row2Y + Math.floor(Math.random() * (row2H - 8));
    const gh = Math.floor(6 + Math.random() * 14);  // 6〜20px 高
    ov.fillStyle(0x11172a, 0.72 + Math.random() * 0.20);
    ov.fillRect(gx, gy, gw, gh);
  }

  // Row2 上端ハイライト（Row1 との境界を示す薄い線）
  ov.lineStyle(0.8, 0x7090c0, 0.18);
  ov.lineBetween(0, row2Y, W, row2Y);

  // Row2 下端フェードアウト補助（下端ほど暗い）
  ov.lineStyle(1.0, 0x061220, 0.30);
  ov.lineBetween(0, row2Y + row2H - 1, W, row2Y + row2H - 1);

  return {
    maskGraphics: maskG,
    overlayGfx: ov,
    destroy() {
      if (targetImage && !targetImage.destroyed) {
        targetImage.clearMask();
      }
      if (!maskG.destroyed) maskG.destroy();
      if (!ov.destroyed) ov.destroy();
    },
  };
}

/**
 * Home 正常背景（画像版）
 *
 * レイヤー順:
 *   1. グリッド (depthBase)      … 最背面・主張しない (alpha 0.10)
 *   2. 背景画像 (depthBase+1)    … グリッドより前面、UIより背面
 *                                   cover 表示（アスペクト比維持）
 *
 * @param {Phaser.Scene} scene
 * @param {object} opts
 * @param {number}  [opts.width]
 * @param {number}  [opts.height]
 * @param {number}  [opts.depthBase=-60]
 * @param {string}  [opts.textureKey='home-bg-normal']
 * @returns {{ layers: Phaser.GameObjects.GameObject[], destroy: () => void }}
 */
export function mountHomeNormalBg(scene, opts = {}) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const depthBase = opts.depthBase ?? -60;
  const key = opts.textureKey ?? 'home-bg-normal';

  // ── Layer 1: グリッド（最背面 depthBase=-60）─────────────────────────────
  // buildCleanGrid は内部で setDepth(depthBase+1) するため depthBase-1 を渡す
  const gGrid = buildCleanGrid(scene, W, H, 1, depthBase - 1);

  // ── Layer 2: 背景画像（depthBase+1=-59、グリッドより前面・UIより背面）────
  const img = scene.add.image(W / 2, H / 2, key);
  img.setDepth(depthBase + 1);

  // cover: アスペクト比を維持しつつ画面全体を覆うスケール
  const scaleX = W / img.width;
  const scaleY = H / img.height;
  img.setScale(Math.max(scaleX, scaleY));

  return {
    layers: [gGrid, img],
    bgImage: img,
    destroy() {
      gGrid.destroy();
      img.destroy();
    },
  };
}

/**
 * Home 用: グリッドのみ（全画面ベタ背景画像なし）
 *
 * @param {number} [opts.depthBase=-60] グリッドの基準 depth（buildCleanGrid と整合）
 */
export function mountHomeGridOnly(scene, opts = {}) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const depthBase = opts.depthBase ?? -60;
  // Home パネル背後のグリッドはほぼ見えない程度に弱める（不透明パネル前提）
  const gGrid = buildCleanGrid(scene, W, H, 0.22, depthBase - 1);
  return {
    layers: [gGrid],
    destroy() {
      gGrid.destroy();
    },
  };
}

/**
 * Home 背景: 正常状態（クリーン版）
 *
 * レイヤー順:
 *   1. 塗りつぶし背景 (depthBase)     … ライトブルーグラデーション
 *   2. グリッド (depthBase+1)         … 最背面・主張しない (alpha 0.10)
 *
 * 崩壊・再構築表現は一切含まない。
 */
export function mountBootHomeBackdrop(scene, opts = {}) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const depthBase = opts.depthBase ?? -60;

  // ── Layer 1: ライトブルーグラデーション背景 ─────────────────────────────
  const gBg = scene.add.graphics();
  gBg.setDepth(depthBase);

  // 上部中央: 明るい水色 / 下部: やや深めのスチールブルー
  const colorTop    = 0xd6e8f8;
  const colorMid    = 0xbdd1e8;
  const colorBottom = 0xa8bfd8;
  const half = Math.round(H / 2);

  gBg.fillGradientStyle(colorTop, colorTop, colorMid, colorMid, 1, 1, 1, 1);
  gBg.fillRect(0, 0, W, half);
  gBg.fillGradientStyle(colorMid, colorMid, colorBottom, colorBottom, 1, 1, 1, 1);
  gBg.fillRect(0, half, W, H - half);

  // ── Layer 2: グリッド（最背面・主張しない）──────────────────────────────
  const gGrid = buildCleanGrid(scene, W, H, 1, depthBase + 1);

  return {
    layers: [gBg, gGrid],
    destroy() {
      gBg.destroy();
      gGrid.destroy();
    },
  };
}

function interpolateColor(c1, c2, t) {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Home 専用: 微粒子フェードアニメ
 * 50〜80個の 1〜3px 点、ランダムにフェードイン→フェードアウトを繰り返す
 * @returns {{ destroy: () => void }}
 */
export function mountHomeParticles(scene, opts = {}) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const depthBase = opts.depthBase ?? -52;
  const rnd = mulberry32(((opts.seed >>> 0) || 0xdead00) ^ 0xbeef);

  const count = Math.round(50 + rnd() * 30);
  const dots = [];
  const tweens = [];

  for (let i = 0; i < count; i += 1) {
    const px = rnd() * W;
    const py = rnd() * H;
    const r  = rnd() > 0.75 ? 1.5 + rnd() * 1.0 : 0.5 + rnd() * 1.0;
    const peakAlpha = 0.15 + rnd() * 0.25;

    const g = scene.add.graphics();
    g.setDepth(depthBase);
    g.fillStyle(0xb8d0f8, 1);
    g.fillCircle(px, py, r);
    g.setAlpha(0);
    dots.push(g);

    const delay  = rnd() * 3000;
    const halfDur = 800 + rnd() * 2200;
    const tw = scene.tweens.add({
      targets: g,
      alpha: peakAlpha,
      duration: halfDur,
      delay,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    tweens.push(tw);
  }

  return {
    destroy() {
      tweens.forEach((t) => { if (t) scene.tweens.remove(t); });
      tweens.length = 0;
      dots.forEach((d) => d?.destroy?.());
      dots.length = 0;
    },
  };
}


/**
 * Home 下端: 背景切り出し破片（堆積表現）
 *
 * home-bg-normal テクスチャを setCrop で切り出した 2〜3 個の破片を
 * 画面下端付近に固定配置。落下・堆積した「元の背景の残骸」に見せる。
 *
 * レイヤー:
 *   depthBase (-10 デフォルト): 接地影（Graphics）
 *   depthBase + 1〜3        : 各破片（後ろ→手前）
 *
 * 制約:
 *   - グロー禁止 / 強い影禁止
 *   - 中央（START 直下）には置かない
 *   - 色変更なし（setCrop のみ使用）
 *   - スキャン・UI は触らない
 *
 * @param {Phaser.Scene} scene
 * @param {object} opts
 * @param {number}  [opts.width]          world 幅 (px)
 * @param {number}  [opts.height]         world 高さ (px)
 * @param {number}  [opts.depthBase=-10]  最背面破片の depth (-10 = bg より前、UI(1) より後ろ)
 * @param {string}  [opts.textureKey='home-bg-normal']
 * @param {number}  [opts.seed=0xf4a9]
 * @returns {{ layers: Phaser.GameObjects.GameObject[], destroy: () => void }}
 */
export function mountHomeBgFragments(scene, opts = {}) {
  const W        = opts.width      ?? scene.scale.width;
  const H        = opts.height     ?? scene.scale.height;
  const depthBase = opts.depthBase ?? -10;
  const key      = opts.textureKey ?? 'home-bg-normal';
  const rnd      = mulberry32((opts.seed >>> 0) || 0xf4a9);

  // テクスチャの実寸を確認（cover スケール係数と一致させる）
  const tex = scene.textures.get(key);
  const srcW = tex?.source[0]?.width  ?? W;
  const srcH = tex?.source[0]?.height ?? H;

  // cover スケール（mountHomeNormalBg と同じ計算）
  const coverScale = Math.max(W / srcW, H / srcH);

  // 破片定義（3 個）: 左側 / 右側 / 右寄り中段
  // widthRatio: 画面幅に対する破片幅の比率 (0.12〜0.22)
  // cropSrcYRatio: 切り出し元 Y の比率（上側〜中段）
  // xOffRatio: 画面中央からの X オフセット比率（±）
  const fragDefs = [
    {
      widthRatio:    0.19,
      heightRatio:   0.14,
      cropSrcYRatio: 0.08,
      xOffRatio:     -0.34,   // 左寄り
      rotDeg:        -(6 + rnd() * 6),
      depthOff:      1,        // 最後段（一番下）
      stackYOff:     0,        // 基準段
    },
    {
      widthRatio:    0.22,
      heightRatio:   0.12,
      cropSrcYRatio: 0.20,
      xOffRatio:     0.32,    // 右寄り
      rotDeg:        5 + rnd() * 7,
      depthOff:      2,
      stackYOff:     -14,     // 1段上に乗る
    },
    {
      widthRatio:    0.15,
      heightRatio:   0.10,
      cropSrcYRatio: 0.14,
      xOffRatio:     -0.22,   // 左寄り中段
      rotDeg:        -(9 + rnd() * 3),
      depthOff:      3,        // 最前面
      stackYOff:     -24,      // さらに上
    },
  ];

  const layers = [];

  fragDefs.forEach((def) => {
    const fragW = Math.round(W * def.widthRatio);
    const fragH = Math.round(H * def.heightRatio);

    // 切り出し元の座標（srcW/srcH 空間、coverScale 適用前）
    // cropSrcYRatio は上側〜中段を示す（画面 Y 上部から切る）
    const cropX = Math.round((srcW - fragW / coverScale) * 0.5 + (def.xOffRatio * srcW * 0.15));
    const cropY = Math.round(def.cropSrcYRatio * srcH);
    const cropW = Math.round(fragW / coverScale);
    const cropH = Math.round(fragH / coverScale);

    // 配置 Y: 下端 + stackYOff（破片が重なって堆積する）
    const sinkRatio = 0.72;   // 破片高さの何割が下端に沈むか
    const baseY = H - fragH * sinkRatio + def.stackYOff;
    const posX  = W / 2 + def.xOffRatio * W;
    const posY  = baseY;

    // ── 接地影（ごく薄い楕円 Graphics）────────────────────────────────────
    const shadowG = scene.add.graphics();
    shadowG.setDepth(depthBase);
    const sw = fragW * 1.15;
    const sh = 7;
    shadowG.fillStyle(0x000000, 0.12);
    shadowG.fillEllipse(posX, H - fragH * 0.12 + def.stackYOff, sw, sh);
    layers.push(shadowG);

    // ── 破片本体（setCrop で切り出し）──────────────────────────────────────
    const img = scene.add.image(posX, posY, key);
    img.setDepth(depthBase + def.depthOff);
    img.setCrop(
      Math.max(0, cropX),
      Math.max(0, cropY),
      Math.min(cropW, srcW - Math.max(0, cropX)),
      Math.min(cropH, srcH - Math.max(0, cropY)),
    );
    // setCrop 後の表示サイズを fragW/fragH に合わせる
    img.setDisplaySize(fragW, fragH);
    img.setAngle(def.rotDeg);
    layers.push(img);
  });

  return {
    layers,
    destroy() {
      layers.forEach((l) => l?.destroy?.());
      layers.length = 0;
    },
  };
}

/**
 * Boot: base / structure / noise / ui を別 Container に載せ、ズレ＋微動後に (0,0) へ収束
 */
export function mountBootCollapsedBackdrop(scene, opts = {}) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const seed = (opts.seed >>> 0) || 0x70f700;
  const rndOff = mulberry32(seed ^ 0xace);

  const depthBase = opts.depthBase ?? -55;
  const structAlpha = Phaser.Math.Clamp(opts.structureAlpha ?? 1, 0, 2);
  const noiseAlpha = Phaser.Math.Clamp(opts.noiseAlpha ?? 1, 0, 2);
  const fragAlpha = Phaser.Math.Clamp(opts.fragmentAlpha ?? 1, 0, 2);
  const noiseDots = Phaser.Math.Clamp(Math.floor(opts.noiseDots ?? 86), 24, 200);

  const gTop = opts.gradientTop ?? 0x0d1220;
  const gBot = opts.gradientBottom ?? 0x04070d;

  const offsets = [
    {
      ox: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 52, -28, 28)),
      oy: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 48, -26, 26)),
    },
    {
      ox: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 56, -30, 30)),
      oy: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 50, -28, 28)),
    },
    {
      ox: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 54, -28, 28)),
      oy: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 52, -30, 30)),
    },
    {
      ox: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 50, -30, 30)),
      oy: Math.round(Phaser.Math.Clamp((rndOff() - 0.5) * 54, -28, 28)),
    },
  ];

  const containers = [];
  const driftTweens = [];

  for (let li = 0; li < 4; li += 1) {
    const { ox, oy } = offsets[li];
    const c = scene.add.container(ox, oy);
    c.setDepth(depthBase + li);
    const g = scene.add.graphics();
    const rnd = mulberry32(seed + li * 7919);

    if (li === 0) drawLayerBase(g, W, H, gTop, gBot);
    else if (li === 1) drawLayerStructure(g, g, W, H, structAlpha, rnd);
    else if (li === 2) drawLayerNoise(g, W, H, noiseAlpha, noiseDots, rnd);
    else drawLayerUiFrags(g, W, H, fragAlpha, rnd);

    c.add(g);
    containers.push(c);

    const dir = rndOff() * Math.PI * 2;
    const amp = 5 + rndOff() * 7;
    const dx = Math.cos(dir) * amp;
    const dy = Math.sin(dir) * amp;
    const dur = 1500 + li * 280 + rndOff() * 420;
    const tw = scene.tweens.add({
      targets: c,
      x: ox + dx,
      y: oy + dy,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    driftTweens.push(tw);
  }

  const stopDrift = () => {
    driftTweens.forEach((t) => {
      if (t) scene.tweens.remove(t);
    });
    driftTweens.length = 0;
  };

  return {
    containers,
    destroy() {
      stopDrift();
      containers.forEach((c) => c?.destroy?.());
      containers.length = 0;
    },
    convergeLayers(durationMs, ease, easeParams, onEachComplete) {
      stopDrift();
      containers.forEach((c) => {
        scene.tweens.add({
          targets: c,
          x: 0,
          y: 0,
          duration: durationMs,
          ease: ease || 'Back.easeOut',
          easeParams: easeParams ?? [1.14],
          onComplete: typeof onEachComplete === 'function' ? onEachComplete : undefined,
        });
      });
    },
  };
}

/**
 * Home 背景 再構築スキャン
 *
 * home-bg-normal 画像に GeometryMask を適用し、上から行単位・左から右へ
 * ステップ移動で表示領域を広げていく。
 *
 * - グリッドは最背面のまま（触らない）
 * - UI / outerFrame は触らない
 * - 毎フレーム更新禁止: delayedCall ベースのステップ更新
 * - マスク用 Graphics は 1 つだけ使い回す（clear → draw）
 * - 大量オブジェクト生成禁止
 *
 * 挙動:
 *   - 上から行単位でスキャン（最初は行0から）
 *   - 各行は左から右へ gridStep/2 を基準単位として進む
 *   - 1ステップの進行幅は 0.5〜1.5 セル相当（1〜3 サブステップ）でランダム
 *   - 右端まで行ったら次の行へ（右方向へは必ず進む）
 *   - 各ステップの間隔に ±40〜120ms のランダム揺れを加える
 *   - 行が下がるほど遅くなる指数増加ルールは維持
 *   - 高さオフセットは先端付近で強く、後方へ距離減衰（DECAY_COLS 列で 0 に）
 *   - 通過済みブロックのオフセットは 0 に近づく（行完了時に一括揃えなし）
 *   - stopY まで到達したら完全停止（それ以下は未復元のまま）
 *
 * 処理ヘッド:
 *   - 幅 3px 固定、基準行高さ固定
 *   - DIFFERENCE ブレンドモードで対象ピクセルを反転（背景色非依存）
 *   - 尾なし
 *
 * @param {Phaser.Scene} scene
 * @param {object} opts
 * @param {number}  [opts.width]          world 幅 (px)
 * @param {number}  [opts.stopY]          この y より下は復元しない (px)
 * @param {number}  [opts.gridStep=52]    グリッドのセルサイズ (px)
 * @param {number}  [opts.row0IntervalMs=91]  row0 の 1 ステップ間隔 (ms)
 * @param {number}  [opts.rowIntervalScale=3.5] 行ごとの間隔倍率
 * @param {Phaser.GameObjects.Image} opts.targetImage  マスク適用先の画像
 * @param {number}  [opts.headDepth]  処理ヘッド Graphics の depth（省略時: targetImage.depth + 1）
 * @param {boolean} [opts.deferScheduleScan=false] true のとき delayedCall 連鎖を開始しない（後から resumeScheduledScan を呼ぶ）
 * @returns {{ destroy: () => void, resumeScheduledScan?: () => void }}
 */
export function mountHomeScanMask(scene, opts = {}) {
  const W            = opts.width      ?? scene.scale.width;
  const gridStep     = opts.gridStep   ?? 52;
  const subStep      = gridStep / 2;                   // 基準単位: gridStep/2
  const row0Interval = opts.row0IntervalMs   ?? 91;
  const rowScale     = opts.rowIntervalScale ?? 3.5;
  const targetImage  = opts.targetImage ?? null;
  const stopY        = opts.stopY ?? Math.round(scene.scale.height * 0.40);
  const deferScheduleScan = opts.deferScheduleScan === true;
  let scanScheduleStarted = !deferScheduleScan;

  const rowHeight    = gridStep / 2;                   // 行高さ: gridStep の半分
  const colsPerRow   = Math.ceil(W / subStep);         // subStep 単位の列数
  const stopRow      = Math.floor(stopY / rowHeight);  // 最後に完全表示する行(0-indexed)

  // オフセットが先端から何列で 0 に減衰するか
  const DECAY_COLS = 6;

  // ── マスク用 Graphics（シーンに追加しない: make.graphics）──────────────
  const maskG = scene.make.graphics({ add: false });

  // GeometryMask は初回に1度だけ作成し、以降は maskG の clear→draw で更新
  const geomMask = maskG.createGeometryMask();
  if (targetImage && !targetImage.destroyed) {
    targetImage.setMask(geomMask);
  }

  // ── 処理ヘッド: スキャン先端を示す反転縦帯 ────────────────────────────
  const _headDepth = opts.headDepth ?? ((targetImage ? targetImage.depth : -59) + 1);
  const headGfx = scene.add.graphics()
    .setDepth(_headDepth)
    .setBlendMode(Phaser.BlendModes.DIFFERENCE);

  // ── 現在のスキャン位置 ───────────────────────────────────────────────
  let scanRow = 0;
  let scanCol = 0;   // subStep 単位の列インデックス（0 = 未進行）
  let finished = false;
  let _timer = null;

  // 現在行の各 subStep ブロックに割り当てるベース高さオフセット（±数px）
  // 行が変わるたびにリセットする
  const _rowBaseOff = [];

  // 列 col のベースオフセットを取得（未割当なら初期化）
  function _baseOffFor(col) {
    if (_rowBaseOff[col] === undefined) {
      _rowBaseOff[col] = Math.round((Math.random() * 2 - 1) * 4);
    }
    return _rowBaseOff[col];
  }

  // 列 col の実効オフセット（先端距離に応じて減衰）
  function _offsetFor(col) {
    const base = _baseOffFor(col);
    const dist  = (scanCol - 1) - col;              // 0: 先端, 増加: 後方
    const decay = Math.max(0, 1 - dist / DECAY_COLS);
    return Math.round(base * decay);
  }

  // 処理ヘッドを現在のスキャン位置に再描画（反転帯: DIFFERENCE blend, 幅3px固定）
  function _redrawHead() {
    headGfx.clear();
    if (finished || scanCol === 0) return;
    const headX = scanCol * subStep;
    const rowY  = scanRow * rowHeight;
    // DIFFERENCE blend + 白(0xffffff) = 対象ピクセルをそのまま反転
    headGfx.fillStyle(0xffffff, 0.7);
    headGfx.fillRect(headX, rowY, 3, rowHeight);
  }

  // マスクを再描画（完了済み行 + 現在行の scanCol ブロックまで）
  function _redrawMask() {
    maskG.clear();
    maskG.fillStyle(0xffffff, 1);

    // 完了済み行（scanRow 未満）: 全幅で一括描画（オフセットなし）
    if (scanRow > 0) {
      maskG.fillRect(0, 0, W, scanRow * rowHeight);
    }

    // 現在行: 各 subStep ブロックを個別に描画（距離減衰オフセットあり）
    if (scanCol > 0) {
      const rowY = scanRow * rowHeight;
      for (let j = 0; j < scanCol; j++) {
        const hOff = _offsetFor(j);
        // +1px オーバーラップでブロック間の隙間を防ぐ
        maskG.fillRect(j * subStep, rowY, subStep + 1, rowHeight + hOff);
      }
    }

    _redrawHead();
  }

  // 次ステップまでの待機時間（行ごとに指数増加 + ランダム揺れ）
  function _intervalFor(row) {
    const base       = row0Interval * Math.pow(rowScale, row);
    const jitterAmp  = 40 + Math.random() * 80;  // 40〜120ms
    const jitter     = (Math.random() < 0.5 ? -1 : 1) * jitterAmp;
    return Math.max(20, base + jitter);
  }

  function _scheduleNext() {
    if (finished) return;
    const delay = _intervalFor(scanRow);
    _timer = scene.time.delayedCall(delay, _step);
  }

  function _step() {
    if (finished) return;

    // 0.5〜1.5 セル相当（1〜3 subStep）をランダムに進める
    const advance = 1 + Math.floor(Math.random() * 3);
    scanCol += advance;

    if (scanCol >= colsPerRow) {
      // 行完了 → 次の行へ（ベースオフセットをリセット）
      _rowBaseOff.length = 0;
      scanRow += 1;
      scanCol = 0;

      if (scanRow >= stopRow) {
        // 停止: 完了済み行だけをマスクに描いて終了
        finished = true;
        maskG.clear();
        maskG.fillStyle(0xffffff, 1);
        maskG.fillRect(0, 0, W, stopRow * rowHeight);
        headGfx.clear();
        return;
      }
    }

    _redrawMask();
    _scheduleNext();
  }

  // 初期状態: マスクは空（画像は非表示）
  _redrawMask();
  if (scanScheduleStarted) {
    _scheduleNext();
  }

  function resumeScheduledScan() {
    if (finished || scanScheduleStarted) return;
    scanScheduleStarted = true;
    _scheduleNext();
  }

  return {
    destroy() {
      finished = true;
      if (_timer) {
        _timer.remove(false);
        _timer = null;
      }
      if (targetImage && !targetImage.destroyed) {
        targetImage.clearMask();
      }
      maskG.destroy();
      headGfx.destroy();
    },
    resumeScheduledScan: deferScheduleScan ? resumeScheduledScan : undefined,
  };
}

