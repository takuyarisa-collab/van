import { HOME_BG_PANEL_CROPS } from './home-bg-panel-crops.js';

const PLAY_REPAIR_PATCH_DEPTH = 10.0;
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

function computePlayGlyphRowCenterY(layout) {
  const playContentH = layout.triDispH + layout.midGap + layout.playRowDispH;
  const playBlockTop = layout.textCy - playContentH * 0.5;
  return playBlockTop + layout.triDispH + layout.midGap + layout.playRowDispH * 0.5;
}

export function computePlayRepairButtonRect(layout) {
  const rowCy = computePlayGlyphRowCenterY(layout);
  const w = Phaser.Math.Clamp(
    layout.totalW + layout.panelW * 0.16,
    layout.totalW * 1.12,
    layout.panelW * 0.9,
  );
  const h = Phaser.Math.Clamp(
    layout.playRowDispH * 1.12 + 22,
    84,
    Math.min(138, layout.panelH * 0.62),
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

function buildPlayRepairMaskPoints(rect, repairStrength) {
  const s = easeRepair(repairStrength);
  const expand = Phaser.Math.Linear(34, 0, s);
  const l = rect.left - expand * 1.1;
  const r = rect.right + expand * 0.92;
  const t = rect.top - expand * 0.32;
  const b = rect.bottom + expand * 0.26;
  const w = r - l;
  const h = b - t;
  const bite = Phaser.Math.Linear(3, 10, s);
  const sag = Phaser.Math.Linear(2, 7, s);

  return [
    { x: l + w * 0.025 + bite * 0.4, y: t + h * 0.18 },
    { x: l + w * 0.12, y: t + h * 0.05 + sag * 0.25 },
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

function drawMaskGraphics(g, rect, repairStrength) {
  if (!g || g.destroyed) return null;
  const pts = buildPlayRepairMaskPoints(rect, repairStrength);
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillPoints(pts, true, true);
  return pts;
}

function makePatchTexture(scene, idx, src, crop) {
  const key = `play_repair_patch_${idx}`;
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas');
  const w = [188, 156, 120][idx] ?? 128;
  const h = [76, 64, 56][idx] ?? 60;
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
    { ox: -0.16, oy: -0.04, sw: 0.45, sh: 0.58, rot: -1.2, a: 0.62, depth: 0.05 },
    { ox: 0.19, oy: 0.03, sw: 0.36, sh: 0.48, rot: 1.6, a: 0.5, depth: 0.02 },
    { ox: 0.02, oy: 0.16, sw: 0.28, sh: 0.36, rot: -0.6, a: 0.42, depth: 0 },
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
    img.setAlpha(Phaser.Math.Clamp(0.06 + spec.a * s, 0.04, 0.68));
    img.setTint(0xf0f2f5);
    try {
      if (tuning.disableRepairMask || !mask) img.clearMask?.(false);
      else img.setMask(mask);
    } catch (_) {
      /* ignore */
    }
  });
}

function syncRepairDebug(scene, rect, maskPts, repairStrength, tuning) {
  let g = scene._playRepairDebugGfx;
  const wantMask = Boolean(tuning.showPlayButtonMask);
  const wantPatch = Boolean(tuning.showRepairPatches);
  if (!wantMask && !wantPatch) {
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

export function syncPlayRepairButton(scene, layout, items, repairStrength, tuning) {
  if (!scene || !layout || !items?.length) return;
  const rect = computePlayRepairButtonRect(layout);
  const mask = createPlayRepairMask(scene);
  const maskPts = tuning.disableRepairMask
    ? null
    : drawMaskGraphics(scene._playRepairMaskGfx, rect, repairStrength);
  if (tuning.disableRepairMask) scene._playRepairMaskGfx?.clear?.();
  applyMaskToFormation(scene, items, mask, Boolean(tuning.disableRepairMask));
  syncPatchLayout(scene, rect, repairStrength, tuning, mask);
  syncRepairDebug(scene, rect, maskPts, repairStrength, tuning);
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
