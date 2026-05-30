import { HOME_BG_PANEL_CROPS } from './home-bg-panel-crops.js';

const PLAY_REPAIR_PATCH_DEPTH = 10.0;
const PLAY_REPAIR_PROCESS_DEPTH = 11.18;
const PLAY_REPAIR_DUST_DEPTH = 11.2;
const PLAY_REPAIR_CRACK_DEPTH = 11.26;
const PLAY_REPAIR_MASK_DEBUG_DEPTH = 12020;
const PLAY_REPAIR_DEBUG_DEPTH = 12021;

function clamp01(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Phaser.Math.Clamp(v, 0, 1);
}

function easeRepair(t) {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

function repairHash01(seed) {
  const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function segmentProgress01(t, start, end) {
  return clamp01((t - start) / Math.max(0.001, end - start));
}

function computePlayGlyphRowCenterY(layout) {
  const playContentH = layout.triDispH + layout.midGap + layout.playRowDispH;
  const playBlockTop = layout.textCy - playContentH * 0.5;
  return playBlockTop + layout.triDispH + layout.midGap + layout.playRowDispH * 0.5;
}

export function computePlayRepairButtonRect(layout) {
  const rowCy = computePlayGlyphRowCenterY(layout);
  const displayW =
    typeof layout.playBgDispW === 'number' && Number.isFinite(layout.playBgDispW)
      ? layout.playBgDispW
      : layout.panelW * 1.7;
  const minW = Math.max(layout.totalW * 1.68, layout.panelW * 1.46);
  const maxW = Math.max(minW, Math.min(displayW * 1.02, layout.panelW * 1.88));
  const w = Phaser.Math.Clamp(
    layout.totalW + layout.panelW * 0.86,
    minW,
    maxW,
  );
  const minH = Math.max(layout.playRowDispH * 1.3, 104);
  const maxH = Math.max(minH, Math.min(166, layout.panelH * 1.06));
  const h = Phaser.Math.Clamp(
    layout.playRowDispH * 1.36 + 34,
    minH,
    maxH,
  );
  return {
    cx: layout.textCx + 1,
    cy: rowCy + 2,
    w,
    h,
    left: layout.textCx + 1 - w * 0.5,
    top: rowCy + 2 - h * 0.5,
    right: layout.textCx + 1 + w * 0.5,
    bottom: rowCy + 2 + h * 0.5,
  };
}

function buildPlayRepairMaskPoints(rect, repairStrength, processingPulse = 0) {
  const s = easeRepair(repairStrength);
  const p = easeRepair(processingPulse);
  const expand = Phaser.Math.Linear(24, 4, s);
  const cut = Phaser.Math.Linear(3.6, 1.6, s) * p;
  const l = rect.left - expand * 0.74 + cut * 0.82;
  const r = rect.right + expand * 0.64 - cut * 0.7;
  const t = rect.top - expand * 0.22 + cut * 0.28;
  const b = rect.bottom + expand * 0.2 - cut * 0.24;
  const w = r - l;
  const h = b - t;
  const bite = Phaser.Math.Linear(5, 13, s) + cut * 0.8;
  const sag = Phaser.Math.Linear(3, 8, s) + cut * 0.42;

  return [
    { x: l + w * 0.018 + bite * 0.35, y: t + h * 0.2 },
    { x: l + w * 0.115, y: t + h * 0.045 + sag * 0.25 },
    { x: l + w * 0.31, y: t + h * 0.08 },
    { x: l + w * 0.42, y: t + bite * 0.2 },
    { x: l + w * 0.57, y: t + h * 0.07 },
    { x: l + w * 0.78, y: t + h * 0.04 + sag * 0.2 },
    { x: r - w * 0.045, y: t + h * 0.17 + bite * 0.2 },
    { x: r - w * 0.02, y: t + h * 0.48 },
    { x: r - w * 0.065, y: b - h * 0.14 },
    { x: l + w * 0.79, y: b - h * 0.04 - sag * 0.2 },
    { x: l + w * 0.61, y: b - h * 0.08 },
    { x: l + w * 0.45, y: b - bite * 0.15 },
    { x: l + w * 0.27, y: b - h * 0.06 - sag * 0.1 },
    { x: l + w * 0.08, y: b - h * 0.16 },
    { x: l + w * 0.015, y: t + h * 0.62 },
  ];
}

function drawMaskGraphics(g, rect, repairStrength, processingPulse = 0) {
  if (!g || g.destroyed) return null;
  const pts = buildPlayRepairMaskPoints(rect, repairStrength, processingPulse);
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillPoints(pts, true, true);
  return pts;
}

function makePatchTexture(scene, idx, src, crop) {
  const key = `play_repair_patch_${idx}`;
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas');
  const w = [260, 190, 178][idx] ?? 160;
  const h = [92, 78, 66][idx] ?? 64;
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const ptsByIdx = [
    [
      [0.03, 0.19], [0.18, 0.04], [0.95, 0.09], [0.99, 0.52],
      [0.91, 0.94], [0.22, 0.87], [0.02, 0.66],
    ],
    [
      [0.06, 0.12], [0.88, 0.02], [0.98, 0.34], [0.86, 0.9],
      [0.2, 0.98], [0.02, 0.52],
    ],
    [
      [0.08, 0.05], [0.78, 0.1], [0.98, 0.42], [0.76, 0.88],
      [0.18, 0.96], [0.02, 0.28],
    ],
  ];
  const pts = ptsByIdx[idx] ?? ptsByIdx[0];
  ctx.save();
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const x = px * w;
    const y = py * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.clip();

  const sx = Phaser.Math.Clamp(crop.x + idx * 83, 0, Math.max(0, src.width - crop.w * 0.32));
  const sy = Phaser.Math.Clamp(crop.y + 38 + idx * 71, 0, Math.max(0, src.height - crop.h * 0.24));
  const sw = Math.max(32, crop.w * (idx === 0 ? 0.34 : 0.26));
  const sh = Math.max(28, crop.h * (idx === 0 ? 0.25 : 0.2));
  ctx.globalAlpha = 0.96;
  ctx.drawImage(src, sx, sy, Math.min(sw, src.width - sx), Math.min(sh, src.height - sy), 0, 0, w, h);

  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = idx === 0 ? 'rgba(238,241,244,0.18)' : 'rgba(214,219,226,0.14)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(5,9,15,0.08)';
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 41 + idx * 19) % w;
    const y = (i * 29 + idx * 13) % h;
    ctx.fillRect(x, y, 1 + ((i + idx) % 2), 1);
  }
  ctx.strokeStyle = 'rgba(12,18,28,0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * (0.58 + idx * 0.04));
  ctx.lineTo(w * 0.82, h * (0.34 + idx * 0.05));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  scene.textures.addCanvas(key, c);
  return key;
}

function ensurePlayRepairPatches(scene) {
  if (scene._playRepairPatchItems?.length) return scene._playRepairPatchItems;
  if (!scene.textures.exists('home-bg-normal')) return [];
  const src = scene.textures.get('home-bg-normal').getSourceImage();
  const crop = HOME_BG_PANEL_CROPS.PLAY_PANEL;
  const specs = [
    { ox: -0.03, oy: -0.03, sw: 0.7, sh: 0.72, rot: -0.9, a: 0.68, depth: 0.07 },
    { ox: -0.28, oy: 0.03, sw: 0.36, sh: 0.58, rot: 1.2, a: 0.52, depth: 0.03 },
    { ox: 0.26, oy: 0.11, sw: 0.38, sh: 0.5, rot: -1.4, a: 0.48, depth: 0.01 },
  ];
  const patches = [];
  specs.forEach((spec, idx) => {
    const texKey = makePatchTexture(scene, idx, src, crop);
    if (!texKey) return;
    const img = scene.add
      .image(0, 0, texKey)
      .setOrigin(0.5, 0.5)
      .setDepth(PLAY_REPAIR_PATCH_DEPTH + spec.depth)
      .setVisible(false);
    patches.push({ img, texKey, spec });
  });
  scene._playRepairPatchItems = patches;
  return patches;
}

function applyMaskToFormation(scene, items, mask, disabled) {
  for (const it of items ?? []) {
    if (!it?.container || it.container.destroyed) continue;
    try {
      if (disabled || !mask) it.container.clearMask?.(false);
      else it.container.setMask(mask);
    } catch (_) {
      /* ignore */
    }
    try {
      if (it.img && !it.img.destroyed) {
        if (disabled || !mask) it.img.clearMask?.(false);
        else it.img.setMask(mask);
      }
    } catch (_) {
      /* ignore */
    }
  }
}

function syncPatchLayout(scene, rect, repairStrength, tuning, mask) {
  const patches = ensurePlayRepairPatches(scene);
  const disabled = Boolean(tuning.disableRepairPatches);
  const s = easeRepair(repairStrength);
  patches.forEach(({ img, spec }) => {
    if (!img || img.destroyed) return;
    if (disabled) {
      img.setVisible(false);
      return;
    }
    img.setVisible(true);
    img.setPosition(rect.cx + rect.w * spec.ox, rect.cy + rect.h * spec.oy);
    img.setDisplaySize(rect.w * spec.sw, rect.h * spec.sh);
    img.setRotation(Phaser.Math.DegToRad(spec.rot * Phaser.Math.Linear(1.25, 1, s)));
    img.setAlpha(Phaser.Math.Clamp(0.08 + spec.a * s, 0.05, 0.76));
    img.setTint(0xf4f6f8);
    try {
      if (tuning.disableRepairMask || !mask) img.clearMask?.(false);
      else img.setMask(mask);
    } catch (_) {
      /* ignore */
    }
  });
}

function syncRepairProcessingMask(scene, rect, phase, tuning) {
  const disabled = Boolean(tuning.disableRepairProcessing);
  const active = Boolean(phase?.active && !disabled);
  const showDebug = Boolean(tuning.showRepairProcessing);
  let g = scene._playRepairProcessingGfx;
  if (!active && !showDebug) {
    g?.clear?.();
    return;
  }
  if (!g || g.destroyed) {
    g = scene.add.graphics().setDepth(PLAY_REPAIR_PROCESS_DEPTH).setScrollFactor(0);
    scene._playRepairProcessingGfx = g;
  }
  g.clear();

  const t = clamp01(phase?.progress ?? 0);
  const pulse = Math.sin(Math.PI * t);
  if (active) {
    const sweepX = Phaser.Math.Linear(rect.left - 16, rect.right + 16, t);
    const bandW = Phaser.Math.Linear(68, 116, pulse);
    const topY = rect.top + 2 + Math.sin(t * Math.PI * 2.1) * 1.2;
    const botY = rect.bottom - 3 + Math.cos(t * Math.PI * 1.7) * 1.1;
    const a = 0.08 + pulse * 0.08;

    g.fillStyle(0xd2d7dc, a);
    g.fillRect(sweepX - bandW * 0.5, topY, bandW, 1.4);
    g.fillRect(sweepX - bandW * 0.42, botY, bandW * 0.86, 1.2);

    g.fillStyle(0x080b11, 0.08 + pulse * 0.07);
    g.fillRect(sweepX - bandW * 0.38, topY + 2.2, bandW * 0.58, 1);
    g.fillRect(sweepX - bandW * 0.18, botY - 2.4, bandW * 0.5, 1);

    g.lineStyle(1, 0xc7cbd0, 0.09 + pulse * 0.1);
    g.lineBetween(sweepX, rect.top + rect.h * 0.18, sweepX - 5, rect.top + rect.h * 0.36);
    g.lineBetween(sweepX + 4, rect.bottom - rect.h * 0.32, sweepX - 2, rect.bottom - rect.h * 0.16);
  }

  if (showDebug) {
    const dbgA = active ? 0.32 : 0.16;
    g.lineStyle(1, 0x7fb7c6, dbgA);
    g.strokeRect(rect.left, rect.top, rect.w, rect.h);
    g.lineStyle(1, 0xe1e6ea, dbgA * 0.8);
    const x = Phaser.Math.Linear(rect.left, rect.right, t);
    g.lineBetween(x, rect.top - 4, x, rect.bottom + 4);
  }
}

function syncRepairDust(scene, rect, phase, tuning) {
  const active = Boolean(phase?.active && !tuning.disableRepairProcessing);
  let g = scene._playRepairDustGfx;
  if (!active) {
    g?.clear?.();
    return;
  }
  if (!g || g.destroyed) {
    g = scene.add.graphics().setDepth(PLAY_REPAIR_DUST_DEPTH).setScrollFactor(0);
    scene._playRepairDustGfx = g;
  }
  g.clear();

  const t = clamp01(phase?.progress ?? 0);
  const dustT = segmentProgress01(t, 0.2, 0.62);
  if (dustT <= 0 || dustT >= 1) return;
  const fade = Math.sin(Math.PI * dustT);
  const sweepX = Phaser.Math.Linear(rect.left + rect.w * 0.08, rect.right - rect.w * 0.06, t);
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const r = repairHash01(19 + i * 7.13);
    const side = i % 2 === 0 ? -1 : 1;
    const x = sweepX + (r - 0.5) * 42 + side * (8 + repairHash01(i + 3) * 16);
    const y0 = i % 3 === 0 ? rect.top + 4 : rect.bottom - 7;
    const y = y0 + dustT * (5 + repairHash01(i + 9) * 8);
    const sz = 0.9 + repairHash01(i + 13) * 1.2;
    g.fillStyle(0xb6b0a5, (0.09 + repairHash01(i + 17) * 0.09) * fade);
    g.fillRect(x, y, sz, sz);
  }
}

function ensureEdgeCrackSegments(scene, rect) {
  const key = [
    Math.round(rect.left),
    Math.round(rect.top),
    Math.round(rect.w),
    Math.round(rect.h),
  ].join(':');
  if (scene._playRepairEdgeCrackKey === key && scene._playRepairEdgeCracks?.length) {
    return scene._playRepairEdgeCracks;
  }
  const cracks = [];
  const count = 5;
  for (let i = 0; i < count; i += 1) {
    const r0 = repairHash01(97 + i * 11.31);
    const r1 = repairHash01(113 + i * 5.71);
    const len = 5 + repairHash01(131 + i * 4.17) * 13;
    const alpha = 0.12 + repairHash01(149 + i * 6.23) * 0.08;
    let x;
    let y;
    let ang;
    if (i === 0) {
      x = rect.left + rect.w * (0.2 + r0 * 0.18);
      y = rect.top + 5 + r1 * 3;
      ang = Phaser.Math.DegToRad(-8 + r1 * 18);
    } else if (i === 1) {
      x = rect.right - rect.w * (0.18 + r0 * 0.2);
      y = rect.bottom - 6 - r1 * 4;
      ang = Phaser.Math.DegToRad(174 + r1 * 16);
    } else if (i === 2) {
      x = rect.left + 7 + r0 * 5;
      y = rect.top + rect.h * (0.38 + r1 * 0.28);
      ang = Phaser.Math.DegToRad(78 + r0 * 22);
    } else if (i === 3) {
      x = rect.right - 8 - r0 * 5;
      y = rect.top + rect.h * (0.28 + r1 * 0.32);
      ang = Phaser.Math.DegToRad(96 + r1 * 20);
    } else {
      x = rect.left + rect.w * (0.48 + (r0 - 0.5) * 0.16);
      y = rect.top + rect.h * (0.5 + (r1 - 0.5) * 0.26);
      ang = Phaser.Math.DegToRad(-18 + r0 * 36);
    }
    cracks.push({
      x,
      y,
      x2: x + Math.cos(ang) * len,
      y2: y + Math.sin(ang) * len,
      alpha,
    });
  }
  scene._playRepairEdgeCrackKey = key;
  scene._playRepairEdgeCracks = cracks;
  return cracks;
}

function syncEdgeCracks(scene, rect, phase, tuning) {
  const disabled = Boolean(tuning.disableRepairProcessing);
  const showDebug = Boolean(tuning.showEdgeCracks);
  const reveal = disabled ? 0 : clamp01(phase?.crackReveal ?? 0);
  let g = scene._playRepairEdgeCrackGfx;
  if (reveal <= 0 && !showDebug) {
    g?.clear?.();
    return;
  }
  if (!g || g.destroyed) {
    g = scene.add.graphics().setDepth(PLAY_REPAIR_CRACK_DEPTH).setScrollFactor(0);
    scene._playRepairEdgeCrackGfx = g;
  }
  g.clear();

  const cracks = ensureEdgeCrackSegments(scene, rect);
  cracks.forEach((c, i) => {
    const local = easeRepair(segmentProgress01(reveal, i * 0.12, i * 0.12 + 0.34));
    if (local <= 0 && !showDebug) return;
    const x2 = Phaser.Math.Linear(c.x, c.x2, Math.max(local, showDebug ? 1 : 0));
    const y2 = Phaser.Math.Linear(c.y, c.y2, Math.max(local, showDebug ? 1 : 0));
    g.lineStyle(1, 0x111721, c.alpha * local);
    g.lineBetween(c.x, c.y, x2, y2);
    g.lineStyle(1, 0xd8d6cf, c.alpha * 0.28 * local);
    g.lineBetween(c.x + 0.6, c.y - 0.4, x2 + 0.6, y2 - 0.4);
    if (showDebug) {
      g.lineStyle(1, 0xffaa66, 0.28);
      g.strokeCircle(c.x, c.y, 2.2);
    }
  });
}

function syncRepairDebug(scene, rect, maskPts, repairStrength, tuning, phase) {
  let g = scene._playRepairDebugGfx;
  const wantMask = Boolean(tuning.showPlayButtonMask);
  const wantPatch = Boolean(tuning.showRepairPatches);
  const wantProcessing = Boolean(tuning.showRepairProcessing);
  const wantCracks = Boolean(tuning.showEdgeCracks);
  if (!wantMask && !wantPatch && !wantProcessing && !wantCracks) {
    g?.clear?.();
    return;
  }
  if (!g || g.destroyed) {
    g = scene.add.graphics().setDepth(PLAY_REPAIR_DEBUG_DEPTH).setScrollFactor(0);
    scene._playRepairDebugGfx = g;
  }
  g.clear();
  if (wantMask && maskPts?.length) {
    g.fillStyle(0x55f0ff, 0.08);
    g.fillPoints(maskPts, true, true);
    g.lineStyle(1.4, 0x55f0ff, 0.86);
    g.strokePoints(maskPts, true, true);
    g.lineStyle(1, 0xffffff, 0.22);
    g.strokeRect(rect.left, rect.top, rect.w, rect.h);
  }
  if (wantPatch) {
    const s = easeRepair(repairStrength);
    for (const p of scene._playRepairPatchItems ?? []) {
      const img = p.img;
      if (!img || img.destroyed || !img.visible) continue;
      g.lineStyle(1.2, 0xffcc66, 0.55 + s * 0.3);
      g.strokeRect(
        img.x - img.displayWidth * 0.5,
        img.y - img.displayHeight * 0.5,
        img.displayWidth,
        img.displayHeight,
      );
    }
  }
  if (wantProcessing) {
    const t = clamp01(phase?.progress ?? 0);
    g.lineStyle(1, 0x7fb7c6, 0.32);
    const x = Phaser.Math.Linear(rect.left, rect.right, t);
    g.lineBetween(x, rect.top - 8, x, rect.bottom + 8);
  }
  if (wantCracks) {
    g.lineStyle(1, 0xffaa66, 0.28);
    for (const c of ensureEdgeCrackSegments(scene, rect)) {
      g.strokeCircle(c.x, c.y, 3.2);
    }
  }
}

export function createPlayRepairMask(scene) {
  if (scene._playRepairMaskGfx && !scene._playRepairMaskGfx.destroyed) {
    return scene._playRepairMask;
  }
  const gfx = scene.add.graphics().setDepth(PLAY_REPAIR_MASK_DEBUG_DEPTH).setVisible(false);
  scene._playRepairMaskGfx = gfx;
  scene._playRepairMask = gfx.createGeometryMask();
  return scene._playRepairMask;
}

export function syncPlayRepairButton(scene, layout, items, repairStrength, tuning, phase = null) {
  if (!scene || !layout || !items?.length) return;
  const rect = computePlayRepairButtonRect(layout);
  const mask = createPlayRepairMask(scene);
  const processingPulse = tuning.disableRepairProcessing ? 0 : clamp01(phase?.processingPulse ?? 0);
  const maskPts = tuning.disableRepairMask
    ? null
    : drawMaskGraphics(scene._playRepairMaskGfx, rect, repairStrength, processingPulse);
  if (tuning.disableRepairMask) scene._playRepairMaskGfx?.clear?.();
  applyMaskToFormation(scene, items, mask, Boolean(tuning.disableRepairMask));
  syncPatchLayout(scene, rect, repairStrength, tuning, mask);
  syncRepairProcessingMask(scene, rect, phase, tuning);
  syncRepairDust(scene, rect, phase, tuning);
  syncEdgeCracks(scene, rect, phase, tuning);
  syncRepairDebug(scene, rect, maskPts, repairStrength, tuning, phase);
}

export function destroyPlayRepairButton(scene) {
  for (const it of scene?._playFormationShardItems ?? []) {
    try {
      it?.container?.clearMask?.(false);
      it?.img?.clearMask?.(false);
    } catch (_) {
      /* ignore */
    }
  }
  scene?._playRepairPatchItems?.forEach((p) => {
    try {
      p.img?.clearMask?.(false);
      p.img?.destroy?.();
    } catch (_) {
      /* ignore */
    }
    if (p.texKey && scene?.textures?.exists?.(p.texKey)) {
      try {
        scene.textures.remove(p.texKey);
      } catch (_) {
        /* ignore */
      }
    }
  });
  if (scene) scene._playRepairPatchItems = null;
  try {
    scene?._playRepairProcessingGfx?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  try {
    scene?._playRepairDustGfx?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  try {
    scene?._playRepairEdgeCrackGfx?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  if (scene) {
    scene._playRepairProcessingGfx = null;
    scene._playRepairDustGfx = null;
    scene._playRepairEdgeCrackGfx = null;
    scene._playRepairEdgeCracks = null;
    scene._playRepairEdgeCrackKey = null;
  }
  try {
    scene?._playRepairDebugGfx?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  if (scene) scene._playRepairDebugGfx = null;
  try {
    scene?._playRepairMaskGfx?.destroy?.();
  } catch (_) {
    /* ignore */
  }
  if (scene) {
    scene._playRepairMaskGfx = null;
    scene._playRepairMask = null;
  }
}
