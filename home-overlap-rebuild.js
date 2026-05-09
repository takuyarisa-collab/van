/**
 * Boot の OVERLAP タイトル PNG から Home の PLAY / SUB へ「破片を回収・再接続」する演出。
 * Boot 崩壊開始と同期して散開→二次ベジェで収束→到着時の軽い安定化。一直線・強_glitch・RGBズレは使わない。
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

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
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

  let scatterDur = Phaser.Math.FloatBetween(150, 220);
  let convergeDur = Phaser.Math.FloatBetween(650, 950);
  const stabilizeDur = Phaser.Math.FloatBetween(120, 200);

  /** @type {Record<string, number>} */
  const startDelay = {};
  let acc = 0;
  keys.forEach((key, i) => {
    startDelay[key] = acc;
    if (i === keys.length - 1) return;
    acc += Math.round(Phaser.Math.FloatBetween(30, 80));
    if (i === 3) acc += Math.round(Phaser.Math.FloatBetween(40, 70));
  });

  let maxEnd = 0;
  keys.forEach((key) => {
    const end = startDelay[key] + scatterDur + convergeDur + stabilizeDur;
    if (end > maxEnd) maxEnd = end;
  });
  const budget = Phaser.Math.FloatBetween(1080, 1280);
  if (maxEnd > budget) {
    const s = budget / maxEnd;
    scatterDur *= s;
    convergeDur *= s;
  }

  /** @type {{ sprite: Phaser.GameObjects.Image, key: string, seed: number, sx0: number, sy0: number, rot0: number, txs: number, tys: number, rotT: number, s0: {x:number,y:number}, sc: {x:number,y:number}, sm: {x:number,y:number}, st: {x:number,y:number}, tEnd: {x:number,y:number}, delay: number, sd: number, cd: number, std: number, wobbleK: number }[]} */
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

    const seed = 200 + idx * 31;
    const towardX = tx - start.x;
    const towardY = ty - start.y;
    let sx = Phaser.Math.FloatBetween(40, 120) * (randPhase(seed) < 0.5 ? -1 : 1);
    let sy = Phaser.Math.FloatBetween(-80, 80);
    if (sx * towardX + sy * towardY > 0) sx *= -1;

    let scx = start.x + sx;
    let scy = start.y + sy;
    scx = Phaser.Math.Clamp(scx, margin, W - margin);
    scy = Phaser.Math.Clamp(scy, margin, H - margin);

    const drot =
      Phaser.Math.DegToRad(Phaser.Math.FloatBetween(8, 18)) *
      (randPhase(seed + 1) < 0.5 ? -1 : 1);
    const rotScatter = handoff.rotation + drot;

    const dx = tx - scx;
    const dy = ty - scy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const bend =
      (randPhase(seed + 4) - 0.5) * 72 + Math.sin(seed * 0.11) * 16;
    const smx = (scx + tx) * 0.5 + nx * bend;
    const smy = (scy + ty) * 0.5 + ny * bend;

    const dlen = Math.hypot(towardX, towardY) || 1;
    const ux = towardX / dlen;
    const uy = towardY / dlen;
    const overshootPx = Phaser.Math.FloatBetween(2.2, 4.8);
    const stx = tx + ux * overshootPx;
    const sty = ty + uy * overshootPx;

    const delay = startDelay[key];
    const sd = scatterDur;
    const cd = convergeDur;
    const std = stabilizeDur;
    const wobbleK = 5 + randPhase(seed + 5) * 7;

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
      sc: { x: scx, y: scy },
      sm: { x: smx, y: smy },
      st: { x: stx, y: sty },
      tEnd: { x: tx, y: ty },
      delay,
      sd,
      cd,
      std,
      wobbleK,
      rotScatter,
      handoffAlpha: Phaser.Math.Clamp((handoff.alpha || 0.25) * 2.8, 0.42, 0.92),
    });
  });

  let maxTEnd = 0;
  parts.forEach((p) => {
    const tDone = p.delay + p.sd + p.cd + p.std;
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
   * @param {number} u local ms from part.delay
   */
  const samplePart = (p, u) => {
    const { s0, sc, sm, st, tEnd } = p;
    const { sd, cd, std, rot0, rotScatter, rotT, sx0, sy0, txs, tys, wobbleK } = p;

    if (u <= 0) {
      return {
        x: s0.x,
        y: s0.y,
        scaleX: sx0,
        scaleY: sy0,
        rotation: rot0,
        alpha: p.handoffAlpha,
      };
    }

    if (u <= sd) {
      const t = easeOutCubic(u / sd);
      const bx = Phaser.Math.Linear(s0.x, sc.x, t);
      const by = Phaser.Math.Linear(s0.y, sc.y, t);
      const rx = Phaser.Math.Linear(rot0, rotScatter, t);
      return {
        x: bx,
        y: by,
        scaleX: sx0,
        scaleY: sy0,
        rotation: rx,
        alpha: Phaser.Math.Linear(p.handoffAlpha, Math.min(1, p.handoffAlpha * 1.05), t),
      };
    }

    const u2 = u - sd;
    if (u2 <= cd) {
      const s = easeOutCubic(u2 / cd);
      const omt = 1 - s;
      let bx =
        omt * omt * sc.x + 2 * omt * s * sm.x + s * s * tEnd.x;
      let by =
        omt * omt * sc.y + 2 * omt * s * sm.y + s * s * tEnd.y;
      const dx = tEnd.x - sc.x;
      const dy = tEnd.y - sc.y;
      const plen = Math.hypot(dx, dy) || 1;
      const pnx = -dy / plen;
      const pny = dx / plen;
      const wob =
        Math.sin(s * Math.PI * wobbleK + p.seed * 0.3) * (1 - s) * 6.5;
      bx += pnx * wob;
      by += pny * wob;
      return {
        x: bx,
        y: by,
        scaleX: Phaser.Math.Linear(sx0, txs, s),
        scaleY: Phaser.Math.Linear(sy0, tys, s),
        rotation: Phaser.Math.Linear(rotScatter, rotT, s),
        alpha: Phaser.Math.Linear(Math.min(1, p.handoffAlpha * 1.05), 1, s),
      };
    }

    const u3 = u2 - cd;
    const stNorm = Phaser.Math.Clamp(u3 / std, 0, 1);
    const split = 0.42;
    let px;
    let py;
    if (stNorm < split) {
      const w = easeOutCubic(stNorm / split);
      px = Phaser.Math.Linear(tEnd.x, st.x, w);
      py = Phaser.Math.Linear(tEnd.y, st.y, w);
    } else {
      const w = easeInOutQuad((stNorm - split) / (1 - split));
      px = Phaser.Math.Linear(st.x, tEnd.x, w);
      py = Phaser.Math.Linear(st.y, tEnd.y, w);
    }
    const pulse = 1 + 0.1 * Math.sin(stNorm * Math.PI);
    const rotSettle = rotT + (1 - stNorm) * 0.04 * Math.sin(stNorm * Math.PI * 2 + p.seed * 0.1);
    return {
      x: px,
      y: py,
      scaleX: txs,
      scaleY: tys,
      rotation: rotSettle,
      alpha: Phaser.Math.Clamp(pulse, 0.85, 1),
    };
  };

  const step = () => {
    const now = performance.now();
    const T = now - epochMs;

    parts.forEach((p) => {
      const u = T - p.delay;
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
