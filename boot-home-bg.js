/**
 * Boot / Home 用の軽量・多層背景（Phaser Graphics のみ、静止）
 */

function mulberry32(seed) {
  return function rnd() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  base.fillGradientStyle(gTop, gTop, gBot, gBot, 1, 1, 1, 1);
  base.fillRect(0, 0, W, H);
  base.fillStyle(0x000308, 0.38);
  base.beginPath();
  base.moveTo(0, 0);
  base.lineTo(W, 0);
  base.lineTo(0, H * 0.55);
  base.closePath();
  base.fillPath();
  base.fillStyle(0x020814, 0.32);
  base.beginPath();
  base.moveTo(W, H);
  base.lineTo(W, 0);
  base.lineTo(0, H);
  base.closePath();
  base.fillPath();
  layers.push(base);

  const structure = scene.add.graphics();
  structure.setDepth(depthBase + 1);
  const gridStep = 52;
  const gridA = 0.06 * structAlpha;
  structure.lineStyle(1, 0x5c7cad, gridA);
  for (let x = 0; x <= W; x += gridStep) {
    structure.lineBetween(x, 0, x, H);
  }
  for (let y = 0; y <= H; y += gridStep) {
    structure.lineBetween(0, y, W, y);
  }
  structure.lineStyle(1, 0x3d5a8a, 0.045 * structAlpha);
  structure.lineBetween(0, Math.floor(H * 0.42), W, Math.floor(H * 0.18));
  structure.lineStyle(1, 0x2a4466, 0.04 * structAlpha);
  structure.lineBetween(0, Math.floor(H * 0.78), W, Math.floor(H * 0.62));
  layers.push(structure);

  const noise = scene.add.graphics();
  noise.setDepth(depthBase + 2);
  for (let i = 0; i < noiseDots; i += 1) {
    const nx = rnd() * W;
    const ny = rnd() * H;
    const r = 0.45 + rnd() * 1.35;
    const a = (0.05 + rnd() * 0.1) * noiseAlpha;
    noise.fillStyle(0xc2d6f5, a);
    noise.fillCircle(nx, ny, r);
    if (rnd() > 0.58) {
      noise.lineStyle(0.6, 0x8ea0c8, a * 0.75);
      const lx = (rnd() - 0.5) * 18;
      const ly = (rnd() - 0.5) * 18;
      noise.lineBetween(nx, ny, nx + lx, ny + ly);
    }
  }
  layers.push(noise);

  const uiFrags = scene.add.graphics();
  uiFrags.setDepth(depthBase + 3);
  const nArcs = 10;
  for (let i = 0; i < nArcs; i += 1) {
    const ax = rnd() * W;
    const ay = rnd() * H * 0.92;
    const rad = 16 + rnd() * 48;
    const c = rnd() > 0.48 ? 0x48e8ff : 0xff6078;
    uiFrags.lineStyle(1.1, c, (0.09 + rnd() * 0.1) * fragAlpha);
    const start = rnd() * Math.PI * 2;
    const sweep = 0.35 + rnd() * 1.1;
    uiFrags.beginPath();
    uiFrags.arc(ax, ay, rad, start, start + sweep, false);
    uiFrags.strokePath();
  }
  for (let i = 0; i < 18; i += 1) {
    const bx = rnd() * (W - 4);
    const by = rnd() * H;
    const bw = 6 + rnd() * 32;
    uiFrags.fillStyle(0x7a9cd4, (0.06 + rnd() * 0.07) * fragAlpha);
    uiFrags.fillRect(bx, by, bw, 1.5);
  }
  for (let i = 0; i < 12; i += 1) {
    const sx = rnd() * W;
    const sy = rnd() * H;
    uiFrags.lineStyle(1, 0x9db6e8, 0.075 * fragAlpha);
    uiFrags.lineBetween(
      sx,
      sy,
      sx + (rnd() - 0.5) * 26,
      sy + (rnd() - 0.5) * 26,
    );
  }
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
