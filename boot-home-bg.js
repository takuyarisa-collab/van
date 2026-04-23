/**
 * Boot / Home 用背景（Phaser Graphics）
 * - mountBootHomeBackdrop … 静的単色背景
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
 * Home 背景: 3レイヤー構成
 *
 * レイヤー順:
 *   1. グリッド (depthBase = -60)     … 最背面・弱め
 *   2. 背景パッチ (depthBase+1 = -59) … 中間
 *   3. UI                             … 前面 (depth 1+ は HomeScene 側)
 *
 * 上側:
 *   Row1 = 再構築済み横長1枚（上部）、Row2 = 再構築途中1枚（左寄り）
 *   左から70%地点でデジタル段差カットオフ（段差は弱め）
 *
 * 下側 (subButtonsTopY ≈ H/2 + 92 以下):
 *   残骸最大2個・画面端寄せ・面積は旧比約半分
 *
 * 中央: 未描画（UIが浮く）
 */
export function mountBootHomeBackdrop(scene, opts = {}) {
  const W = opts.width ?? scene.scale.width;
  const H = opts.height ?? scene.scale.height;
  const depthBase = opts.depthBase ?? -60;

  // subButtonsTopY = H/2 + startHeight/2 + 48 = H/2 + 44 + 48
  const RUINS_Y   = Math.round(H / 2 + 92);
  // デジタルカットオフ: 左から70%
  const CUTOFF_X  = Math.round(W * 0.70);

  // ── Layer 1: グリッド（最背面・主張しない）──────────────────────────────
  const gGrid = scene.add.graphics();
  gGrid.setDepth(depthBase);
  gGrid.lineStyle(1.0, 0x4a6a9a, 0.065);
  const step = 52;
  for (let x = 0; x <= W; x += step) gGrid.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += step) gGrid.lineBetween(0, y, W, y);

  // ── Layer 2: 背景パッチ（中間）──────────────────────────────────────────
  const gPatch = scene.add.graphics();
  gPatch.setDepth(depthBase + 1);

  // 上側パッチをデジタル段差カットオフ付きで描画
  // solidRight まで塗りつぶし、その後 stepZone 内で段差を刻む（弱め）
  function drawPatchDigitalCutoff(x, y, w, h, color, alpha) {
    const right     = x + w;
    const stepZone  = 14; // 段差エッジの幅(px) — 以前より狭くして段差を弱める
    const solidEnd  = CUTOFF_X - stepZone;

    if (right <= solidEnd) {
      gPatch.fillStyle(color, alpha);
      gPatch.fillRect(x, y, w, h);
      return;
    }

    if (solidEnd > x) {
      gPatch.fillStyle(color, alpha);
      gPatch.fillRect(x, y, solidEnd - x, h);
    }

    // デジタル段差: 高さ方向に10pxステップ（増やして段差間隔を広げる）
    const tileH = 10;
    const rows  = Math.ceil(h / tileH);
    for (let ri = 0; ri < rows; ri++) {
      const sy = y + ri * tileH;
      const sh = Math.min(tileH, y + h - sy);
      if (sh <= 0) break;
      const seed = (ri * 13 + Math.round(x / 10) * 7) & 0xf;
      // 段差幅を縮小: (seed % 3) * 3 で 0/3/6 の 3 段のみ
      const sw   = stepZone - (seed % 3) * 5;
      if (sw > 0 && solidEnd + sw <= right) {
        gPatch.fillStyle(color, alpha);
        gPatch.fillRect(solidEnd, sy, sw, sh);
      }
    }
  }

  // ── Row 1: 再構築済み（横長1枚・上部）────────────────────────────────
  // 左端から画面幅の71%、高さはH*0.17（わずかに高さを変えて矩形感を弱める）
  drawPatchDigitalCutoff(0, 0, W * 0.71, H * 0.170, 0xCDD8E8, 0.80);

  // ── Row 2: 再構築途中（1枚・左寄り・やや短め）─────────────────────────
  // 1枚だけ・高さもやや不規則
  drawPatchDigitalCutoff(0, H * 0.265, W * 0.36, H * 0.058, 0xB2C6DA, 0.56);

  // ── 下側: 残骸（最大2個・画面端寄せ・面積は元の約半分）────────────────
  // 残骸 A: 左端寄り・小さめ台形
  gPatch.fillStyle(0x9AAFC4, 0.68);
  gPatch.fillPoints([
    { x: 0,             y: RUINS_Y + H * 0.065 + H * 0.048 },
    { x: 0,             y: RUINS_Y + H * 0.065 },
    { x: W * 0.26,      y: RUINS_Y + H * 0.065 },
    { x: W * 0.30,      y: RUINS_Y + H * 0.065 + H * 0.022 },
    { x: W * 0.24,      y: RUINS_Y + H * 0.065 + H * 0.048 },
  ], true);

  // 残骸 B: 右端寄り・細めの平行四辺形
  gPatch.fillStyle(0x88A0B8, 0.60);
  gPatch.fillPoints([
    { x: W * 0.72,      y: RUINS_Y + H * 0.165 + 6 },
    { x: W * 1.01,      y: RUINS_Y + H * 0.165 },
    { x: W * 1.01,      y: RUINS_Y + H * 0.165 + H * 0.052 },
    { x: W * 0.68,      y: RUINS_Y + H * 0.165 + H * 0.052 + 5 },
  ], true);

  // ひび割れ A: 残骸 A を横切る折れ線
  gPatch.lineStyle(1.2, 0x5878A0, 0.46);
  gPatch.lineBetween(W * 0.06,  RUINS_Y + H * 0.075,
                     W * 0.16,  RUINS_Y + H * 0.092);
  gPatch.lineBetween(W * 0.16,  RUINS_Y + H * 0.092,
                     W * 0.22,  RUINS_Y + H * 0.086);

  return {
    layers: [gGrid, gPatch],
    destroy() {
      gGrid.destroy();
      gPatch.destroy();
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

  const nLayersFor = (baseN) => {
    const n = baseN + Math.floor(rnd() * 2);
    return Phaser.Math.Clamp(n, 2, 3);
  };

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
