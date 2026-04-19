/**
 * Boot / Home 用背景（Phaser Graphics）
 * - mountBootHomeBackdrop … 静的4層（Home）
 * - mountBootCollapsedBackdrop … Boot 崩壊（レイヤーズレ＋微動→収束）
 */

function mulberry32(seed) {
  return function rnd() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawLayerBase(g, W, H, gTop, gBot) {
  g.fillGradientStyle(gTop, gTop, gBot, gBot, 1, 1, 1, 1);
  g.fillRect(0, 0, W, H);
  g.fillStyle(0x000308, 0.38);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(0, H * 0.55);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x020814, 0.32);
  g.beginPath();
  g.moveTo(W, H);
  g.lineTo(W, 0);
  g.lineTo(0, H);
  g.closePath();
  g.fillPath();
}

function drawLayerStructure(g, W, H, structAlpha) {
  const gridStep = 52;
  const gridA = 0.06 * structAlpha;
  g.lineStyle(1, 0x5c7cad, gridA);
  for (let x = 0; x <= W; x += gridStep) {
    g.lineBetween(x, 0, x, H);
  }
  for (let y = 0; y <= H; y += gridStep) {
    g.lineBetween(0, y, W, y);
  }
  g.lineStyle(1, 0x3d5a8a, 0.045 * structAlpha);
  g.lineBetween(0, Math.floor(H * 0.42), W, Math.floor(H * 0.18));
  g.lineStyle(1, 0x2a4466, 0.04 * structAlpha);
  g.lineBetween(0, Math.floor(H * 0.78), W, Math.floor(H * 0.62));
}

function drawLayerNoise(g, W, H, noiseAlpha, noiseDots, rnd) {
  for (let i = 0; i < noiseDots; i += 1) {
    const nx = rnd() * W;
    const ny = rnd() * H;
    const r = 0.45 + rnd() * 1.35;
    const a = (0.05 + rnd() * 0.1) * noiseAlpha;
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

  const gTop = opts.gradientTop ?? 0x0d1220;
  const gBot = opts.gradientBottom ?? 0x04070d;

  const layers = [];

  const base = scene.add.graphics();
  base.setDepth(depthBase);
  drawLayerBase(base, W, H, gTop, gBot);
  layers.push(base);

  const structure = scene.add.graphics();
  structure.setDepth(depthBase + 1);
  drawLayerStructure(structure, W, H, structAlpha);
  layers.push(structure);

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
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        layers[i]?.destroy?.();
      }
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
    else if (li === 1) drawLayerStructure(g, W, H, structAlpha);
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
 * 「Error」「Overlap」1文字ずつ散らし、収束先座標を付与
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

  const fragments = [];
  const rows = [
    { word: 'Error', style: styleError, lineY: cy - lineGap },
    { word: 'Overlap', style: styleOverlap, lineY: cy + lineGap },
  ];

  rows.forEach(({ word, style, lineY }) => {
    const widths = [];
    let totalW = 0;
    const chars = [];
    for (let i = 0; i < word.length; i += 1) {
      const t = scene.add.text(0, 0, word[i], style).setOrigin(0.5);
      widths.push(t.width);
      totalW += t.width;
      chars.push(t);
    }
    const gap = 2;
    totalW += gap * (word.length - 1);
    let left = cx - totalW / 2;
    for (let i = 0; i < word.length; i += 1) {
      const tx = left + widths[i] / 2;
      left += widths[i] + gap;

      const sx = cx + (rnd() - 0.5) * W * 0.94;
      const sy = cy + (rnd() - 0.5) * H * 0.75;
      const jitterX = Phaser.Math.Clamp(sx, -52, W + 52);
      const jitterY = Phaser.Math.Clamp(sy, -40, H + 40);

      chars[i].setPosition(jitterX, jitterY);
      chars[i].setAngle((rnd() - 0.5) * 24);
      chars[i].setAlpha(Phaser.Math.Clamp(0.38 + rnd() * 0.42, 0.32, 0.85));
      chars[i].setDepth(12);

      fragments.push({
        text: chars[i],
        targetX: tx,
        targetY: lineY,
      });
    }
  });

  return {
    fragments,
    destroy() {
      fragments.forEach((f) => f.text?.destroy?.());
      fragments.length = 0;
    },
  };
}
