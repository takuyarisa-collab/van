/**
 * Boot の OVERLAP タイトル PNG から Home の PLAY / SUB へ「破断 → 飛散 → 回収 → 固定」で再接続する演出。
 * 破断ショック（崩壊開始同期）→ 外側 easeOutCubic 飛散 → 単一制御点の二次ベジェで Home へ収束 → 短いオーバーシュート後に最終座標へ固定。
 */
import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';
import { HOMEOVERLAP_TEX_KEY } from './home-overlap-constants.js';
import { addOverlapCropImage } from './home-ui.js';

export const BOOT_OVERLAP_HANDOFF_KEY = 'bootOverlapTitleHandoff';

/** Boot 崩壊開始時点のタイトルスナップショット（断片の初期位置用） */
export const BOOT_OVERLAP_COLLAPSE_START_KEY = 'bootOverlapCollapseStartHandoff';

/** performance.now() 基準の崩壊／演出開始時刻 */
export const OVERLAP_REBUILD_T0_KEY = 'overlapRebuildT0Ms';

/** Home が Boot 崩壊完了まで背景オーバーレイを遅らせる */
export const REG_BOOT_HOME_WAIT_COLLAPSE = 'bootHomeWaitCollapseOverlay';

/** Boot が崩壊処理とクリーンアップを終えた（Home が不透過化してよい） */
export const REG_BOOT_COLLAPSE_DONE_FOR_HOME = 'bootCollapseDoneForHome';

export const REG = {
  collapseStartHandoff: BOOT_OVERLAP_COLLAPSE_START_KEY,
  rebuildT0: OVERLAP_REBUILD_T0_KEY,
  homeWaitCollapse: REG_BOOT_HOME_WAIT_COLLAPSE,
  collapseDoneForHome: REG_BOOT_COLLAPSE_DONE_FOR_HOME,
};

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

/**
 * Boot 崩壊開始と同じフレームで呼ぶ。タイトル画像はこの後 visible false でもよい。
 * @param {Phaser.GameObjects.Image|null} img
 * @param {Phaser.Data.DataManager} registry
 */
export function captureBootOverlapCollapseStartHandoff(img, registry) {
  captureBootOverlapTitleHandoff(img, registry);
  const h = registry.get(BOOT_OVERLAP_HANDOFF_KEY);
  registry.set(BOOT_OVERLAP_COLLAPSE_START_KEY, h);
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

function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** easeInOutCubic と easeOutExpo の中間 — 回収が「吸い込まれる」寄りの減速 */
function easeConvergeT(t) {
  return Phaser.Math.Linear(easeInOutCubic(t), easeOutExpo(t), 0.42);
}

function quadBezier(p0, p1, p2, t) {
  const om = 1 - t;
  return {
    x: om * om * p0.x + 2 * om * t * p1.x + t * t * p2.x,
    y: om * om * p0.y + 2 * om * t * p1.y + t * t * p2.y,
  };
}

/**
 * @param {Phaser.Scene} scene
 * @param {object} _HOME_LAYOUT
 * @param {function(): void} [onComplete]
 */
export function runBootToHomeOverlapRebuild(scene, _HOME_LAYOUT, onComplete) {
  const reg = scene.game.registry;
  const handoff =
    reg.get(BOOT_OVERLAP_COLLAPSE_START_KEY) ?? reg.get(BOOT_OVERLAP_HANDOFF_KEY);
  reg.remove(BOOT_OVERLAP_COLLAPSE_START_KEY);
  reg.remove(BOOT_OVERLAP_HANDOFF_KEY);

  const t0Raw = reg.get(OVERLAP_REBUILD_T0_KEY);
  reg.remove(OVERLAP_REBUILD_T0_KEY);
  const epochMs =
    typeof t0Raw === 'number' && Number.isFinite(t0Raw)
      ? t0Raw
      : performance.now();

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

  scene._redrawHomeUI();

  const W = scene.scale.width;
  const H = scene.scale.height;
  const margin = 28;

  const texKey = HOMEOVERLAP_TEX_KEY;
  const depth = 18;
  const keys = ['P', 'L', 'A', 'V', 'O', 'E', 'R'];

  /** @type {{ sprite: Phaser.GameObjects.Image, key: string, seed: number, sx0: number, sy0: number, rot0: number, txs: number, tys: number, rotT: number, s0: {x:number,y:number}, kick: {x:number,y:number}, sc: {x:number,y:number}, cp: {x:number,y:number}, over: {x:number,y:number}, tEnd: {x:number,y:number}, shockMs: number, sd: number, cd: number, snapMs: number, rotSpike: number, rotScatter: number, scalePeak: number, alphaDip: number, handoffAlpha: number }[]} */
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
    const handoffAlpha = Phaser.Math.Clamp((handoff.alpha || 0.25) * 2.8, 0.42, 0.92);
    spr.setAlpha(handoffAlpha);

    const g = targetByKey[key];
    const tx = g.x;
    const ty = g.y;
    const txs = g.scaleX;
    const tys = g.scaleY;
    const rotT = g.rotation;

    const seed = 200 + idx * 31;
    const vtx = tx - start.x;
    const vty = ty - start.y;
    const vHomeLen = Math.hypot(vtx, vty) || 1;
    const hnx = vtx / vHomeLen;
    const hny = vty / vHomeLen;
    const awayX = -hnx;
    const awayY = -hny;
    const perpX = -hny;
    const perpY = hnx;

    const ox =
      awayX * Phaser.Math.FloatBetween(45, 115) +
      perpX * Phaser.Math.FloatBetween(-115, 115);
    const oy =
      awayY * Phaser.Math.FloatBetween(35, 105) +
      perpY * Phaser.Math.FloatBetween(-100, 100);

    let scx = start.x + ox;
    let scy = start.y + oy;
    scx = Phaser.Math.Clamp(scx, margin, W - margin);
    scy = Phaser.Math.Clamp(scy, margin, H - margin);

    const kickLen = Phaser.Math.FloatBetween(14, 32);
    const kick = {
      x: awayX * kickLen + perpX * Phaser.Math.FloatBetween(-6, 6),
      y: awayY * kickLen + perpY * Phaser.Math.FloatBetween(-6, 6),
    };

    const drotDeg = Phaser.Math.FloatBetween(18, 35);
    const rotScatter =
      handoff.rotation + Phaser.Math.DegToRad(drotDeg) * (randPhase(seed + 1) < 0.5 ? -1 : 1);

    const dirx = tx - scx;
    const diry = ty - scy;
    const dlen = Math.hypot(dirx, diry) || 1;
    const ux = dirx / dlen;
    const uy = diry / dlen;
    const overN = Phaser.Math.FloatBetween(1.8, 3.6);
    const over = { x: tx + ux * overN, y: ty + uy * overN };

    const cp = {
      x: scx * 0.18 + tx * 0.82,
      y: scy * 0.18 + ty * 0.82,
    };

    const shockMs = Math.round(Phaser.Math.FloatBetween(72, 112));
    const sd = Math.round(Phaser.Math.FloatBetween(100, 160));
    const cd = Math.round(Phaser.Math.FloatBetween(520, 720));
    const snapMs = Math.round(Phaser.Math.FloatBetween(48, 72));

    const rotSpike = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(24, 44)) *
      (randPhase(seed + 2) < 0.5 ? -1 : 1);
    const scalePeak = Phaser.Math.FloatBetween(1.03, 1.08);
    const alphaDip = Phaser.Math.FloatBetween(0.68, 0.78);

    parts.push({
      sprite: spr,
      key,
      seed,
      sx0,
      sy0,
      rot0: handoff.rotation,
      txs,
      tys,
      rotT,
      s0: { x: start.x, y: start.y },
      kick,
      sc: { x: scx, y: scy },
      cp,
      over,
      tEnd: { x: tx, y: ty },
      shockMs,
      sd,
      cd,
      snapMs,
      rotSpike,
      rotScatter,
      scalePeak,
      alphaDip,
      handoffAlpha,
    });
  });

  let maxTEnd = 0;
  parts.forEach((p) => {
    const tDone = p.shockMs + p.sd + p.cd + p.snapMs;
    if (tDone > maxTEnd) maxTEnd = tDone;
  });

  if (!scene._bootToHomeFlying) scene._bootToHomeFlying = [];
  scene._bootToHomeFlying.push(...parts.map((p) => p.sprite));

  const stopRebuild = () => {
    if (scene._overlapRebuildStep) {
      scene.events.off('update', scene._overlapRebuildStep);
      scene._overlapRebuildStep = null;
    }
  };
  scene._cancelOverlapRebuild = stopRebuild;

  /**
   * @param {typeof parts[0]} p
   * @param {number} u ms since rebuild start（全断片同期の破断ショック用に delay なし）
   */
  const samplePart = (p, u) => {
    const {
      s0,
      kick,
      sc,
      cp,
      over,
      tEnd,
      shockMs,
      sd,
      cd,
      snapMs,
      rot0,
      rotSpike,
      rotScatter,
      rotT,
      sx0,
      sy0,
      txs,
      tys,
      scalePeak,
      alphaDip,
      handoffAlpha,
    } = p;

    if (u <= 0) {
      return {
        x: s0.x,
        y: s0.y,
        scaleX: sx0,
        scaleY: sy0,
        rotation: rot0,
        alpha: handoffAlpha,
      };
    }

    if (u <= shockMs) {
      const t = Phaser.Math.Clamp(u / shockMs, 0, 1);
      const env = easeOutCubic(t);
      const x = s0.x + kick.x * env;
      const y = s0.y + kick.y * env;
      const bump = Math.sin(Math.PI * Math.pow(t, 0.92));
      const scaleMul = 1 + (scalePeak - 1) * bump;
      const dipT = Phaser.Math.Clamp(
        Math.sin(Math.PI * Math.min(1, t * 2.4)),
        0,
        1,
      );
      const alpha = handoffAlpha * Phaser.Math.Linear(1, alphaDip, dipT);
      return {
        x,
        y,
        scaleX: sx0 * scaleMul,
        scaleY: sy0 * scaleMul,
        rotation: rot0 + rotSpike * bump * (1 - t * 0.2),
        alpha,
      };
    }

    const pShockX = s0.x + kick.x;
    const pShockY = s0.y + kick.y;

    const u1 = u - shockMs;
    if (u1 <= sd) {
      const tn = Phaser.Math.Clamp(u1 / sd, 0, 1);
      const e = easeOutCubic(tn);
      return {
        x: Phaser.Math.Linear(pShockX, sc.x, e),
        y: Phaser.Math.Linear(pShockY, sc.y, e),
        scaleX: sx0,
        scaleY: sy0,
        rotation: Phaser.Math.Linear(rot0, rotScatter, e),
        alpha: Phaser.Math.Linear(
          handoffAlpha,
          Math.min(1, handoffAlpha * 1.06),
          e,
        ),
      };
    }

    const u2 = u1 - sd;
    if (u2 <= cd) {
      const sn = Phaser.Math.Clamp(u2 / cd, 0, 1);
      const s = easeConvergeT(sn);
      const pt = quadBezier(sc, cp, over, s);
      return {
        x: pt.x,
        y: pt.y,
        scaleX: Phaser.Math.Linear(sx0, txs, s),
        scaleY: Phaser.Math.Linear(sy0, tys, s),
        rotation: Phaser.Math.Linear(rotScatter, rotT, s),
        alpha: Phaser.Math.Linear(Math.min(1, handoffAlpha * 1.06), 1, s),
      };
    }

    const u3 = u2 - cd;
    const wn = Phaser.Math.Clamp(u3 / snapMs, 0, 1);
    const w = easeOutCubic(wn);
    return {
      x: Phaser.Math.Linear(over.x, tEnd.x, w),
      y: Phaser.Math.Linear(over.y, tEnd.y, w),
      scaleX: txs,
      scaleY: tys,
      rotation: rotT,
      alpha: 1,
    };
  };

  const step = () => {
    const now = performance.now();
    const T = now - epochMs;

    parts.forEach((p) => {
      const u = T;
      const st = samplePart(p, u);
      p.sprite.setPosition(st.x, st.y);
      p.sprite.setScale(st.scaleX, st.scaleY);
      p.sprite.setRotation(st.rotation);
      p.sprite.setAlpha(Phaser.Math.Clamp(st.alpha, 0.08, 1));
    });

    if (T < maxTEnd) return;

    stopRebuild();

    parts.forEach((f) => {
      f.sprite.setPosition(f.tEnd.x, f.tEnd.y);
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
  };

  scene._overlapRebuildStep = step;
  scene.events.on('update', step);
}
