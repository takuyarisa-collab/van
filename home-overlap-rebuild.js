/**
 * Boot の OVERLAP タイトル PNG から Home の PLAY / SUB へ「破片を回収・再接続」する演出。
 * 一直線 tween は使わず、二次ベジェ＋漂い＋短い欠けで収束させる。
 */
import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';
import { HOMEOVERLAP_TEX_KEY } from './home-overlap-constants.js';
import { addOverlapCropImage } from './home-ui.js';

export const BOOT_OVERLAP_HANDOFF_KEY = 'bootOverlapTitleHandoff';

/**
 * @param {Phaser.GameObjects.Image|null} img
 * @param {Phaser.Data.DataManager} registry
 */
export function captureBootOverlapTitleHandoff(img, registry) {
  if (!registry) return;
  if (!img || img.destroyed) {
    registry.set(BOOT_OVERLAP_HANDOFF_KEY, null);
    return;
  }
  registry.set(BOOT_OVERLAP_HANDOFF_KEY, {
    x: img.x,
    y: img.y,
    scaleX: img.scaleX,
    scaleY: img.scaleY,
    rotation: img.rotation,
    natW: img.width,
    natH: img.height,
    alpha: img.alpha,
  });
}

function worldPosFromHandoff(h, cropKey) {
  const c = HOMEOVERLAP_CROPS[cropKey];
  const lx = (c.x + c.w * 0.5 - h.natW * 0.5) * h.scaleX;
  const ly = (c.y + c.h * 0.5 - h.natH * 0.5) * h.scaleY;
  const cos = Math.cos(h.rotation);
  const sin = Math.sin(h.rotation);
  return {
    x: h.x + lx * cos - ly * sin,
    y: h.y + lx * sin + ly * cos,
  };
}

function randPhase(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * @param {Phaser.Scene} scene
 * @param {object} HOME_LAYOUT
 * @param {function(): void} [onComplete]
 */
export function runBootToHomeOverlapRebuild(scene, _HOME_LAYOUT, onComplete) {
  const handoff = scene.registry.get(BOOT_OVERLAP_HANDOFF_KEY);
  scene.registry.remove(BOOT_OVERLAP_HANDOFF_KEY);

  scene._homeLinkReveal = { play: 0, sub: [0, 0, 0] };
  scene._redrawHomeUI();

  const targetByKey = {
    P: scene._startP,
    L: scene._startL,
    A: scene._startA,
    V: scene._startV,
    O: scene._subRows[0].head,
    E: scene._subRows[1].head,
    R: scene._subRows[2].head,
  };

  const hideRealGlyphs = () => {
    Object.values(targetByKey).forEach((g) => {
      if (g && !g.destroyed) g.setAlpha(0);
    });
    if (scene._startY && !scene._startY.destroyed) scene._startY.setAlpha(0);
  };

  hideRealGlyphs();

  const fallbackImmediate = () => {
    scene._homeLinkReveal = { play: 1, sub: [1, 1, 1] };
    scene._delta.startFrame.offsetX = 0;
    scene._delta.startFrame.offsetY = 0;
    scene._delta.startFrame.alpha = 1;
    scene._redrawHomeUI();
    onComplete?.();
  };

  if (!handoff) {
    fallbackImmediate();
    return;
  }

  const texKey = HOMEOVERLAP_TEX_KEY;
  const depth = 14;
  const keys = ['P', 'L', 'A', 'V', 'O', 'E', 'R'];

  /** @type {{ sprite: Phaser.GameObjects.Image, key: string, start: {x:number,y:number}, sx0: number, sy0: number, rot0: number, tx: number, ty: number, txs: number, tys: number, rotT: number, startFrac: number, seed: number }[]} */
  const parts = [];

  keys.forEach((key, idx) => {
    const start = worldPosFromHandoff(handoff, key);
    const crop = HOMEOVERLAP_CROPS[key];
    const spr = addOverlapCropImage(scene, texKey, crop, depth);
    const sx0 = handoff.scaleX;
    const sy0 = handoff.scaleY;
    spr.setPosition(start.x, start.y);
    spr.setScale(sx0, sy0);
    spr.setRotation(handoff.rotation);
    spr.setAlpha(
      Phaser.Math.Clamp((handoff.alpha || 0.25) * 2.8, 0.42, 0.92),
    );

    const g = targetByKey[key];
    const tx = g.x;
    const ty = g.y;
    const txs = g.scaleX;
    const tys = g.scaleY;
    const rotT = g.rotation;

    parts.push({
      sprite: spr,
      key,
      start,
      sx0,
      sy0,
      rot0: handoff.rotation,
      tx,
      ty,
      txs,
      tys,
      rotT,
      startFrac: idx * 0.055 + randPhase(idx * 13.7) * 0.04,
      seed: 200 + idx * 31,
    });
  });

  if (!scene._bootToHomeFlying) scene._bootToHomeFlying = [];
  scene._bootToHomeFlying.push(...parts.map((p) => p.sprite));

  const D = Phaser.Math.FloatBetween(760, 1180);

  const mx = (i) => {
    const p = parts[i];
    const dx = p.tx - p.start.x;
    const dy = p.ty - p.start.y;
    const midx = (p.start.x + p.tx) * 0.5 + Math.sin(p.seed * 0.7) * 36 + (randPhase(p.seed) - 0.5) * 24;
    const midy = (p.start.y + p.ty) * 0.5 + Math.cos(p.seed * 0.55) * -30 + (randPhase(p.seed + 3) - 0.5) * 20;
    return { midx, midy, dx, dy };
  };

  const mids = parts.map((_, i) => mx(i));

  const state = { p: 0 };

  scene.tweens.add({
    targets: state,
    p: 1,
    duration: D,
    ease: 'Linear',
    onUpdate: () => {
      const gProg = state.p;
      parts.forEach((f, i) => {
        const mid = mids[i];
        let lf = gProg <= f.startFrac ? 0 : (gProg - f.startFrac) / (1 - f.startFrac);
        lf = Phaser.Math.Clamp(lf, 0, 1);
        const e = Phaser.Math.Easing.Cubic.Out(lf);

        const sx = f.start.x;
        const sy = f.start.y;
        const tx = f.tx;
        const ty = f.ty;
        const { midx, midy } = mid;

        let bx =
          (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * midx + e * e * tx;
        let by =
          (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * midy + e * e * ty;

        const plen = Math.hypot(mid.dx, mid.dy) || 1;
        const nx = -mid.dy / plen;
        const ny = mid.dx / plen;
        const wob =
          Math.sin(lf * Math.PI * (6.2 + randPhase(f.seed + 1) * 2)) *
          (1 - e) *
          13;
        const lag = Math.sin(lf * Math.PI * 9 + f.seed * 0.2) * (1 - e) * 5;
        bx += nx * wob + nx * lag * 0.35;
        by += ny * wob + ny * lag * 0.35;

        const dipBand = lf > 0.38 && lf < 0.44;
        let a = Phaser.Math.Linear(
          Phaser.Math.Clamp((handoff.alpha || 0.25) * 2.8, 0.42, 0.92),
          1,
          e,
        );
        if (dipBand) a *= 0.28;

        f.sprite.setPosition(bx, by);
        f.sprite.setScale(
          Phaser.Math.Linear(f.sx0, f.txs, e),
          Phaser.Math.Linear(f.sy0, f.tys, e),
        );
        f.sprite.setRotation(Phaser.Math.Linear(f.rot0, f.rotT, e));
        f.sprite.setAlpha(Phaser.Math.Clamp(a, 0.08, 1));
      });
    },
    onComplete: () => {
      parts.forEach((f) => {
        f.sprite.setPosition(f.tx, f.ty);
        f.sprite.setScale(f.txs, f.tys);
        f.sprite.setRotation(f.rotT);
        f.sprite.setAlpha(1);
      });

      parts.forEach((f) => {
        f.sprite.destroy();
      });
      if (scene._bootToHomeFlying?.length) {
        scene._bootToHomeFlying = scene._bootToHomeFlying.filter((s) => !s.destroyed);
      }

      scene._delta.startFrame.offsetX = Phaser.Math.FloatBetween(-3.5, 3.5);
      scene._delta.startFrame.offsetY = Phaser.Math.FloatBetween(-2.8, 2.8);
      scene._delta.startFrame.alpha = 0.86;

      scene._homeLinkReveal = { play: 1, sub: [1, 1, 1] };
      scene._redrawHomeUI();

      scene.tweens.add({
        targets: scene._delta.startFrame,
        offsetX: 0,
        offsetY: 0,
        alpha: 1,
        duration: Phaser.Math.FloatBetween(85, 130),
        ease: 'Sine.easeOut',
        onUpdate: () => {
          scene._redrawHomeUI();
        },
        onComplete: () => {
          scene._redrawHomeUI();
          onComplete?.();
        },
      });
    },
  });
}
