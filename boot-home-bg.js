/**
 * Boot / Home 用背景（Phaser Graphics）
 * - mountBootHomeBackdrop … 静的4層（Home）＋空間グラデーション＋斜め勾配グリッド＋断続グリッチ
 * - mountBootCollapsedBackdrop … Boot 崩壊（レイヤーズレ＋微動→収束）
 * - mountHomeParticles … 微粒子フェードアニメ（Home 専用）
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
 * 3ストップ空間グラデーション:  上 #020611 → 中 #071a2f → 下 #020611
 * 中央に縦グラデーション光帯（画面幅の35%）を追加
 */
function drawLayerBase(g, W, H, gTop, gBot) {
  const gMid = 0x071a2f;
  const half = Math.round(H / 2);
  // 上半分: gTop → gMid
  g.fillGradientStyle(gTop, gTop, gMid, gMid, 1, 1, 1, 1);
  g.fillRect(0, 0, W, half);
  // 下半分: gMid → gBot
  g.fillGradientStyle(gMid, gMid, gBot, gBot, 1, 1, 1, 1);
  g.fillRect(0, half, W, H - half);

  // 中央縦光帯（画面幅35%・横グラデ近似：左右→中央が明るい）
  const bandW = Math.round(W * 0.35);
  const bandX = Math.round((W - bandW) / 2);
  const bandMid = Math.round(bandW / 2);
  // 左半分: 透明 → 0b2a4a
  g.fillGradientStyle(0x0b2a4a, 0x0b2a4a, 0x0b2a4a, 0x0b2a4a, 0, 0, 0.18, 0.18);
  g.fillRect(bandX, 0, bandMid, H);
  // 右半分: 0b2a4a → 透明
  g.fillGradientStyle(0x0b2a4a, 0x0b2a4a, 0x0b2a4a, 0x0b2a4a, 0.18, 0.18, 0, 0);
  g.fillRect(bandX + bandMid, 0, bandW - bandMid, H);

  // コーナーダークニング
  g.fillStyle(0x000308, 0.28);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(0, H * 0.55);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x020814, 0.22);
  g.beginPath();
  g.moveTo(W, H);
  g.lineTo(W, 0);
  g.lineTo(0, H);
  g.closePath();
  g.fillPath();
}

/**
 * 斜め勾配グリッド用: 全グリッド線のメタデータを事前計算して配列で返す。
 * 各線は独自の Graphics を持ち、グリッチ時に個別に差し替えられる。
 *
 * @param {Phaser.Scene} scene
 * @param {number} W
 * @param {number} H
 * @param {number} structAlpha
 * @param {number} depthBase
 * @param {Function} rnd
 * @returns {Array<{g: Phaser.GameObjects.Graphics, x0,y0,x1,y1, baseAlpha, baseWidth, baseOffsetX}>}
 */
function buildDiagonalGrid(scene, W, H, structAlpha, depthBase, rnd) {
  const gridStep = 52;
  const diagLen  = Math.hypot(W, H);

  // 点の左上→右下軸上の正規化位置 [0,1]:  左上コーナー=0、右下コーナー=1
  // 軸方向単位ベクトル (W,H)/diagLen に射影
  const diagT = (x, y) => (x * W + y * H) / (diagLen * diagLen);

  const lines = [];

  const addLine = (x0, y0, x1, y1) => {
    const mx  = (x0 + x1) * 0.5;
    const my  = (y0 + y1) * 0.5;
    const t   = diagT(mx, my);           // 0=左上端, 1=右下端

    // 連続勾配: 左上(t=0)が最大強度、右下(t=1)が最小強度
    // α range: 0.072 (強) → 0.018 (弱)  * structAlpha
    const alphaStrong = 0.072 * structAlpha;
    const alphaWeak   = 0.018 * structAlpha;
    const baseAlpha   = alphaStrong + (alphaWeak - alphaStrong) * t;

    // 線幅: 強側 2.6 → 弱側 0.9
    const baseWidth = 2.6 - t * 1.7;

    const g = scene.add.graphics();
    g.setDepth(depthBase + 1);
    g.lineStyle(baseWidth, 0x5c7cad, baseAlpha);
    g.lineBetween(x0, y0, x1, y1);

    lines.push({ g, x0, y0, x1, y1, baseAlpha, baseWidth, baseOffsetX: 0, diagT: t });
  };

  for (let x = 0; x <= W; x += gridStep) addLine(x, 0, x, H);
  for (let y = 0; y <= H; y += gridStep) addLine(0, y, W, y);

  // 縦アクセントライン 2本（グリッチ対象外の装飾層）
  const vx1 = Math.round(W * 0.22);
  const vx2 = Math.round(W * 0.81);
  const acc1 = scene.add.graphics();
  acc1.setDepth(depthBase + 1);
  acc1.lineStyle(1, 0x4af0e4, 0.09 * structAlpha);
  acc1.lineBetween(vx1, 0, vx1, H);
  const acc2 = scene.add.graphics();
  acc2.setDepth(depthBase + 1);
  acc2.lineStyle(1, 0x4af0e4, 0.08 * structAlpha);
  acc2.lineBetween(vx2, Math.round(H * 0.12), vx2, Math.round(H * 0.88));

  return { lines, accents: [acc1, acc2] };
}

/**
 * グリッチループ: 0.4〜0.8秒に1回ランダム発火、5〜15本を対象に
 * 4種エフェクト（シフト／α増幅／消去／線幅増大）のいずれか1つを適用し
 * 40〜120ms で必ず元に戻す。やや斜め方向（左上→右下）に偏った選択。
 *
 * @param {Phaser.Scene} scene
 * @param {Array} lines  buildDiagonalGrid が返す lines 配列
 * @param {Function} rnd
 * @returns {{ stop: () => void }}
 */
function startGlitchLoop(scene, lines, rnd) {
  let timer = null;
  let active = true;

  const scheduleNext = () => {
    if (!active) return;
    const delay = 400 + rnd() * 400;   // 400〜800ms
    timer = scene.time.delayedCall(delay, fire);
  };

  const redrawLine = (entry, offsetX, alphaOverride, widthOverride) => {
    const { g, x0, y0, x1, y1 } = entry;
    const ox = offsetX ?? entry.baseOffsetX;
    const a  = alphaOverride ?? entry.baseAlpha;
    const w  = widthOverride ?? entry.baseWidth;
    g.clear();
    g.lineStyle(w, 0x5c7cad, a);
    g.lineBetween(x0 + ox, y0, x1 + ox, y1);
  };

  const fire = () => {
    if (!active) return;

    const count = 5 + Math.floor(rnd() * 11);   // 5〜15本

    // 斜め偏り: diagT が小さいほど（左上に近いほど）選ばれやすい
    const weights = lines.map((l) => Math.pow(1 - l.diagT * 0.7, 1.5) + 0.15);

    // ルーレット選択で count 本を非重複ピック
    const chosen = [];
    const pool = lines.map((l, i) => ({ l, i, w: weights[i] }));
    for (let pick = 0; pick < count && pool.length > 0; pick += 1) {
      const totalW = pool.reduce((s, p) => s + p.w, 0);
      let rv = rnd() * totalW;
      let idx = 0;
      while (idx < pool.length - 1 && rv > pool[idx].w) {
        rv -= pool[idx].w;
        idx += 1;
      }
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }

    // エフェクト種別をランダム選択（全選択ラインで同一種別）
    const effectType = Math.floor(rnd() * 4);
    // 0: 横シフト(2〜6px)  1: α増幅(1.5〜2x)  2: 消去  3: 線幅増大

    const restores = chosen.map(({ l }) => {
      switch (effectType) {
        case 0: {
          const shift = (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 4);
          redrawLine(l, shift, null, null);
          return () => redrawLine(l, 0, null, null);
        }
        case 1: {
          const boost = 1.5 + rnd() * 0.5;
          redrawLine(l, 0, Math.min(l.baseAlpha * boost, 1), null);
          return () => redrawLine(l, 0, l.baseAlpha, null);
        }
        case 2: {
          l.g.clear();
          return () => redrawLine(l, 0, null, null);
        }
        case 3: {
          const extra = 1.5 + rnd() * 2.0;
          redrawLine(l, 0, null, l.baseWidth + extra);
          return () => redrawLine(l, 0, null, l.baseWidth);
        }
        default:
          return () => {};
      }
    });

    // 40〜120ms 後に全て戻す
    const restoreDelay = 40 + rnd() * 80;
    scene.time.delayedCall(restoreDelay, () => {
      restores.forEach((fn) => fn());
      scheduleNext();
    });
  };

  scheduleNext();

  return {
    stop() {
      active = false;
      if (timer) {
        timer.remove(false);
        timer = null;
      }
    },
  };
}

/**
 * Boot/Collapsed 用: 静的2レイヤーグリッド（shimmer tween 付き）。
 * mountBootCollapsedBackdrop からのみ使用。
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

function drawLayerNoise(g, W, H, noiseAlpha, noiseDots, rnd) {
  for (let i = 0; i < noiseDots; i += 1) {
    const nx = rnd() * W;
    const ny = rnd() * H;
    // たまに3px
    const r = rnd() > 0.8 ? 1.5 + rnd() * 1.0 : 0.45 + rnd() * 1.35;
    const a = (0.15 + rnd() * 0.25) * noiseAlpha;  // α 0.15〜0.40
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

/** 静的4層（Home 等） */
export function mountBootHomeBackdrop(scene, opts = {}) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const rnd = mulberry32((opts.seed >>> 0) || 0x5eed001);

  const depthBase = opts.depthBase ?? -60;
  const structAlpha = Phaser.Math.Clamp(opts.structureAlpha ?? 1, 0, 2);
  const noiseAlpha = Phaser.Math.Clamp(opts.noiseAlpha ?? 1, 0, 2);
  const fragAlpha = Phaser.Math.Clamp(opts.fragmentAlpha ?? 1, 0, 2);
  const noiseDots = Phaser.Math.Clamp(Math.floor(opts.noiseDots ?? 88), 24, 200);

  const gTop = opts.gradientTop ?? 0x020611;
  const gBot = opts.gradientBottom ?? 0x020611;

  const layers = [];

  const base = scene.add.graphics();
  base.setDepth(depthBase);
  drawLayerBase(base, W, H, gTop, gBot);
  layers.push(base);

  // 斜め勾配グリッド: 線ごとに個別 Graphics、連続勾配でα・線幅を決定
  const { lines: gridLines, accents } = buildDiagonalGrid(scene, W, H, structAlpha, depthBase, rnd);
  gridLines.forEach((entry) => layers.push(entry.g));
  accents.forEach((g) => layers.push(g));

  // 断続グリッチループ
  const glitch = startGlitchLoop(scene, gridLines, rnd);

  const noise = scene.add.graphics();
  noise.setDepth(depthBase + 2);
  drawLayerNoise(noise, W, H, noiseAlpha, noiseDots, rnd);
  layers.push(noise);

  const uiFrags = scene.add.graphics();
  uiFrags.setDepth(depthBase + 3);
  drawLayerUiFrags(uiFrags, W, H, fragAlpha, rnd);
  layers.push(uiFrags);

  return {
    layers,
    destroy() {
      glitch.stop();
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        layers[i]?.destroy?.();
      }
    },
  };
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

  const count = Math.round(50 + rnd() * 30);  // 50〜80
  const dots = [];
  const tweens = [];

  for (let i = 0; i < count; i += 1) {
    const px = rnd() * W;
    const py = rnd() * H;
    // たまに3px
    const r  = rnd() > 0.75 ? 1.5 + rnd() * 1.0 : 0.5 + rnd() * 1.0;
    const peakAlpha = 0.15 + rnd() * 0.25;  // 0.15〜0.40

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
    /** 各レイヤーTween完了時に onEachComplete を呼ぶ（4回） */
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
 * 「Error」「Overlap」中央グリッチ（複製レイヤー＋横ノイズ）→ タップで収束
 */
export function createScatteredBootTitle(scene, opts) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const cx = opts.cx ?? W / 2;
  const cy = opts.cy ?? H / 2;
  const lineGap = opts.lineGap ?? 27;
  const seed = (opts.seed >>> 0) ^ 0xc0d4e;
  const rnd = mulberry32(seed);

  const styleError = opts.styleError;
  const styleOverlap = opts.styleOverlap;

  const styleErrorBase = {
    ...styleError,
    color: '#e6ebf4',
    stroke: '#283040',
    strokeThickness: Math.max(2, (styleError.strokeThickness ?? 4) - 1),
  };
  const styleOverlapBase = {
    ...styleOverlap,
    color: '#dff8fc',
    stroke: '#143038',
    strokeThickness: Math.max(2, (styleOverlap.strokeThickness ?? 4) - 1),
  };

  /** 2〜3レイヤー（ベース＋色干渉） */
  const nLayersFor = (baseN) => {
    const n = baseN + Math.floor(rnd() * 2);
    return Phaser.Math.Clamp(n, 2, 3);
  };

  /** 各文字は収束先から maxR 以内（中央のブロックに密集） */
  const clampNearTarget = (tx, ty, px, py, maxR) => {
    const dx = px - tx;
    const dy = py - ty;
    const d = Math.hypot(dx, dy);
    if (d <= maxR || d < 1e-6) return { x: px, y: py };
    const s = maxR / d;
    return { x: tx + dx * s, y: ty + dy * s };
  };

  const fragments = [];
  const rows = [
    {
      word: 'Error',
      lineY: cy - lineGap,
      layerStyles: () => {
        const n = nLayersFor(2);
        const arr = [styleErrorBase];
        for (let j = arr.length; j < n; j += 1) arr.push(styleError);
        return arr;
      },
    },
    {
      word: 'Overlap',
      lineY: cy + lineGap,
      layerStyles: () => {
        const n = nLayersFor(2);
        const arr = [styleOverlapBase];
        for (let j = arr.length; j < n; j += 1) arr.push(styleOverlap);
        return arr;
      },
    },
  ];

  rows.forEach(({ word, lineY, layerStyles }, rowIdx) => {
    const styles = layerStyles();
    const widths = [];
    let totalW = 0;
    for (let i = 0; i < word.length; i += 1) {
      const t = scene.add.text(0, 0, word[i], styles[0]).setOrigin(0.5);
      widths.push(t.width);
      totalW += t.width;
      t.destroy();
    }
    const gap = 2;
    totalW += gap * (word.length - 1);
    let left = cx - totalW / 2;

    for (let i = 0; i < word.length; i += 1) {
      const tx = left + widths[i] / 2;
      left += widths[i] + gap;

      styles.forEach((style, li) => {
        const layerMag = () => 6 + rnd() * 6;
        const layerDx = (rnd() < 0.5 ? -1 : 1) * layerMag();
        const layerDy = (rnd() < 0.5 ? -1 : 1) * layerMag();
        const jx = (rnd() - 0.5) * 100;
        const jy = (rnd() - 0.5) * 72;
        let px = tx + jx + layerDx;
        let py = lineY + jy + layerDy;
        ({ x: px, y: py } = clampNearTarget(tx, lineY, px, py, 120));

        const t = scene.add.text(px, py, word[i], style).setOrigin(0.5);
        t.setAngle((rnd() - 0.5) * 11);
        t.setAlpha(Phaser.Math.Clamp(0.4 + rnd() * 0.4, 0.4, 0.8));
        t.setDepth(12 + rowIdx * 4 + i * 2 + li);

        fragments.push({
          text: t,
          targetX: tx,
          targetY: lineY,
        });
      });
    }
  });

  const gGlitch = scene.add.graphics();
  gGlitch.setDepth(60);
  const nBars = 18 + Math.floor(rnd() * 10);
  for (let bi = 0; bi < nBars; bi += 1) {
    const bx = cx + (rnd() - 0.5) * 300;
    const by = cy + (rnd() - 0.5) * 110;
    const bw = 20 + rnd() * 100;
    const bh = 2 + rnd() * 4;
    const a = Phaser.Math.Clamp(0.2 + rnd() * 0.3, 0.2, 0.5);
    const col = rnd() > 0.5 ? 0xd8e4ff : 0xa8c8ff;
    if (rnd() > 0.52) {
      const split = (rnd() - 0.5) * 16;
      const gapW = 3 + rnd() * 6;
      const w1 = bw * (0.42 + rnd() * 0.08);
      const w2 = Math.max(12, bw - w1 - gapW);
      gGlitch.fillStyle(col, a);
      gGlitch.fillRect(bx, by, w1, bh);
      gGlitch.fillRect(bx + w1 + gapW + split, by, w2, bh);
    } else {
      const slip = rnd() > 0.62 ? (rnd() - 0.5) * 16 : 0;
      gGlitch.fillStyle(col, a);
      gGlitch.fillRect(bx + slip, by, bw, bh);
    }
  }

  return {
    fragments,
    glitchGraphics: gGlitch,
    destroy() {
      fragments.forEach((f) => f.text?.destroy?.());
      fragments.length = 0;
      gGlitch?.destroy?.();
    },
  };
}
