/**
 * Boot の OVERLAP タイトル PNG から Home の PLAY / SUB へ「破断 → 飛散 → 回収 → 固定」で再接続する演出。
 * 破断ショック（崩壊開始同期）→ 外側 easeOutCubic 飛散（同期）→ 二次ベジェで Home へ収束 → オーバーシュートで固定。
 * 収束開始・スナップ開始は断片ごとにずらし、PLAY の「y」は ▷ 着地後に短いフェードで点灯する。
 */
import { BOOT_BG_HOME_PANEL_REVEAL_MS } from './boot-bg-collapse-fragments.js';
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

/**
 * Boot 崩壊時に登録: { items: { x, y, ch }[] } — 赤系ログ断片が PLAY の「y」座標へ収束してから y を点灯する。
 */
export const REG_BOOT_Y_LETTER_FRAGS = 'bootYLetterFragments';

/** overlapRebuildT0 から Home 背景スキャン再開までの遅延（ms）— 黒帯（断層）が立った後にグリッド復旧が見えるよう少し遅らせる */
export const HOME_BG_REBUILD_DELAY_MS = 400;

export const REG = {
  collapseStartHandoff: BOOT_OVERLAP_COLLAPSE_START_KEY,
  rebuildT0: OVERLAP_REBUILD_T0_KEY,
  homeWaitCollapse: REG_BOOT_HOME_WAIT_COLLAPSE,
  collapseDoneForHome: REG_BOOT_COLLAPSE_DONE_FOR_HOME,
  yLetterFrags: REG_BOOT_Y_LETTER_FRAGS,
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

/** 決定的な [lo, hi) に近い範囲（終端扱いは呼び出し側で round） */
function seededRange(lo, hi, seed) {
  return lo + randPhase(seed) * (hi - lo);
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
  return Phaser.Math.Linear(easeInOutCubic(t), easeOutExpo(t), 0.56);
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
  const yLetterFragSpec = reg.get(REG_BOOT_Y_LETTER_FRAGS);
  reg.remove(REG_BOOT_Y_LETTER_FRAGS);
  const epochMs =
    typeof t0Raw === 'number' && Number.isFinite(t0Raw)
      ? t0Raw
      : performance.now();
  scene._overlapRebuildEpochMs = epochMs;

  scene._homeLinkReveal = { play: 0, sub: [0, 0, 0] };
  scene._homeBgPanelReveal = scene._homeWaitBootCollapse
    ? { play: 0, sub: [0, 0, 0] }
    : { play: 1, sub: [1, 1, 1] };
  if (scene._homeWaitBootCollapse) {
    scene._playFormationPanelRevealMul = 0.06;
  } else {
    scene._playFormationPanelRevealMul = undefined;
  }
  scene._overlapGlyphReveal = { P: 0, L: 0, A: 0, V: 0, y: 0 };
  scene._bootYRevealUsesLogFragments = Boolean(
    yLetterFragSpec?.items?.length,
  );
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
    scene._bootYRevealUsesLogFragments = false;
    scene._overlapGlyphReveal = null;
    scene._homeLinkReveal = { play: 1, sub: [1, 1, 1] };
    scene._homeBgPanelReveal = { play: 1, sub: [1, 1, 1] };
    scene._playFormationPanelRevealMul = undefined;
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
    const chord = Math.hypot(dirx, diry) || 1;
    const ux = dirx / chord;
    const uy = diry / chord;
    const overN = Phaser.Math.FloatBetween(1.05, 2.25);
    const over = { x: tx + ux * overN, y: ty + uy * overN };

    const pxB = -uy;
    const pyB = ux;
    const bend = Phaser.Math.FloatBetween(0.09, 0.19) * chord * (randPhase(seed + 3) < 0.5 ? -1 : 1);
    const cp = {
      x: scx * 0.32 + tx * 0.68 + pxB * bend,
      y: scy * 0.32 + ty * 0.68 + pyB * bend,
    };

    const shockMs = Math.round(Phaser.Math.FloatBetween(76, 94));
    const sd = Math.round(Phaser.Math.FloatBetween(122, 176));
    const cdBase = Math.round(Phaser.Math.FloatBetween(880, 1080));
    const overlapSlowConverge = key === 'P' || key === 'L' || key === 'A' || key === 'V';
    const cd = overlapSlowConverge ? Math.round(cdBase * 1.68) : cdBase;
    const snapMs = Math.round(Phaser.Math.FloatBetween(158, 212));

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
      landed: false,
      lagConvMs: 0,
      postSnapDelayMs: 0,
      totalDur: 0,
      overlapSlowConverge,
    });
  });

  let dP = seededRange(0, 26, 7101);
  let dL = dP + seededRange(40, 118, 7102);
  let dA = dL + seededRange(38, 115, 7103);
  if (randPhase(7104) < 0.26) {
    const bumpL = seededRange(-22, 38, 7105);
    const bumpA = seededRange(-18, 28, 7106);
    dL = Math.max(dP + 32, dL + bumpL);
    dA = Math.max(dL + 36, dA + bumpA);
  }
  const dV = Math.max(dP, dL, dA) + seededRange(50, 118, 7107);

  const playMaxStart = Math.max(dP, dL, dA, dV);
  let dO = playMaxStart + seededRange(40, 108, 7111);
  let dE = dO + seededRange(78, 172, 7112);
  let dR = dE + seededRange(82, 178, 7113);

  const lagMap = {
    P: dP,
    L: dL,
    A: dA,
    V: dV,
    O: dO,
    E: dE,
    R: dR,
  };

  parts.forEach((p) => {
    p.lagConvMs = Math.round(lagMap[p.key] ?? 0);
    p.postSnapDelayMs = Math.round(seededRange(30, 90, p.seed + 7400));
    p.totalDur =
      p.shockMs + p.sd + p.lagConvMs + p.cd + p.postSnapDelayMs + p.snapMs;
  });

  if (!scene._bootToHomeFlying) scene._bootToHomeFlying = [];
  scene._bootToHomeFlying.push(...parts.map((p) => p.sprite));

  const cancelOverlapRevealSideEffects = () => {
    if (scene._overlapYRevealTimer) {
      scene.time.removeEvent(scene._overlapYRevealTimer);
      scene._overlapYRevealTimer = null;
    }
    if (scene._overlapYRevealTweenObj) {
      scene.tweens.killTweensOf(scene._overlapYRevealTweenObj);
      scene._overlapYRevealTweenObj = null;
    }
    scene._overlapYRevealTween = null;
  };

  const scheduleYReveal = () => {
    cancelOverlapRevealSideEffects();
    const delayMs = Math.round(seededRange(28, 82, 7921));
    scene._overlapYRevealTimer = scene.time.delayedCall(delayMs, () => {
      scene._overlapYRevealTimer = null;
      scene._overlapYRevealTweenObj = { v: 0 };
      scene._overlapYRevealTween = scene.tweens.add({
        targets: scene._overlapYRevealTweenObj,
        v: 1,
        duration: Math.round(seededRange(88, 148, 7922)),
        ease: 'Sine.easeOut',
        onUpdate: () => {
          if (scene._overlapGlyphReveal) {
            scene._overlapGlyphReveal.y = scene._overlapYRevealTweenObj.v;
          }
          scene._redrawHomeUI();
        },
        onComplete: () => {
          if (scene._overlapGlyphReveal) {
            scene._overlapGlyphReveal.y = 1;
          }
          scene._overlapYRevealTweenObj = null;
          scene._overlapYRevealTween = null;
          scene._redrawHomeUI();
          const baseGA =
            typeof scene._startYGlyphAlpha === 'number'
              ? scene._startYGlyphAlpha
              : 0.82;
          const settle = { g: Math.min(0.55, baseGA * 0.62) };
          scene.tweens.add({
            targets: settle,
            g: baseGA,
            duration: Math.round(seededRange(140, 220, 7923)),
            ease: 'Sine.easeOut',
            onUpdate: () => {
              scene._startYGlyphAlpha = settle.g;
              scene._redrawHomeUI();
            },
            onComplete: () => {
              scene._startYGlyphAlpha = baseGA;
              scene._redrawHomeUI();
            },
          });
        },
      });
    });
  };

  const runBootYLetterFragmentConverge = (onAllDone) => {
    const items = yLetterFragSpec?.items;
    if (!items?.length) {
      onAllDone?.();
      return;
    }
    scene._redrawHomeUI();
    const tx = scene._startY?.x ?? 0;
    const ty = scene._startY?.y ?? 0;
    const depth = 20;
    let remaining = items.length;
    const doneOne = () => {
      remaining -= 1;
      if (remaining <= 0) onAllDone?.();
    };
    items.forEach((it, i) => {
      const ch = String(it.ch ?? '>').slice(0, 1);
      const spr = scene.add
        .text(it.x, it.y, ch, {
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: '22px',
          color: '#ff3a3a',
          stroke: '#1a0505',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(depth)
        .setAlpha(0.94);
      if (!scene._bootToHomeFlying) scene._bootToHomeFlying = [];
      scene._bootToHomeFlying.push(spr);
      const dur = Math.round(seededRange(380, 520, 8500 + i * 17));
      const delay = Math.round(seededRange(0, 95, 8600 + i * 13));
      scene.tweens.add({
        targets: spr,
        x: tx,
        y: ty,
        scaleX: 0.42,
        scaleY: 0.42,
        alpha: 0.15,
        angle: seededRange(-14, 14, 8700 + i),
        duration: dur,
        delay,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (spr && !spr.destroyed) spr.destroy();
          doneOne();
        },
      });
    });
  };

  if (scene._bootYRevealUsesLogFragments) {
    runBootYLetterFragmentConverge(() => {
      scheduleYReveal();
    });
  }

  const stopRebuild = () => {
    cancelOverlapRevealSideEffects();
    if (scene._overlapRebuildStep) {
      scene.events.off('update', scene._overlapRebuildStep);
      scene._overlapRebuildStep = null;
    }
  };
  scene._cancelOverlapRebuild = stopRebuild;

  const scatterEndState = (p) => {
    const { s0, kick, sx0, sy0, rotScatter, handoffAlpha } = p;
    return {
      x: s0.x + kick.x,
      y: s0.y + kick.y,
      scaleX: sx0,
      scaleY: sy0,
      rotation: rotScatter,
      alpha: Math.min(1, handoffAlpha * 1.06),
    };
  };

  const convergeEndState = (p) => {
    const { over, txs, tys, rotT } = p;
    return {
      x: over.x,
      y: over.y,
      scaleX: txs,
      scaleY: tys,
      rotation: rotT,
      alpha: 1,
    };
  };

  /**
   * @param {typeof parts[0]} p
   * @param {number} u ms since rebuild start — 破断〜飛散は全断片同期、収束〜スナップのみ lag でずらす
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
      lagConvMs,
      postSnapDelayMs,
      overlapSlowConverge,
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

    const uRel = u1 - sd;
    if (uRel < lagConvMs) {
      return scatterEndState(p);
    }

    const uConv = uRel - lagConvMs;
    if (uConv <= cd) {
      const sn = Phaser.Math.Clamp(uConv / cd, 0, 1);
      const s = overlapSlowConverge ? easeInOutCubic(sn) : easeConvergeT(sn);
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

    const uAfterConv = uConv - cd;
    if (uAfterConv < postSnapDelayMs) {
      return convergeEndState(p);
    }

    const uSnap = uAfterConv - postSnapDelayMs;
    if (uSnap <= snapMs) {
      const wn = Phaser.Math.Clamp(uSnap / snapMs, 0, 1);
      const w = overlapSlowConverge ? easeInOutCubic(wn) : easeOutCubic(wn);
      return {
        x: Phaser.Math.Linear(over.x, tEnd.x, w),
        y: Phaser.Math.Linear(over.y, tEnd.y, w),
        scaleX: txs,
        scaleY: tys,
        rotation: rotT,
        alpha: 1,
      };
    }

    return {
      x: tEnd.x,
      y: tEnd.y,
      scaleX: txs,
      scaleY: tys,
      rotation: rotT,
      alpha: 1,
    };
  };

  const landOnePart = (p) => {
    if (p.landed) return;
    p.landed = true;
    if (p.sprite && !p.sprite.destroyed) {
      p.sprite.destroy();
    }
    if (!scene._overlapGlyphReveal) {
      scene._overlapGlyphReveal = { P: 0, L: 0, A: 0, V: 0, y: 0 };
    }
    const gr = scene._overlapGlyphReveal;
    if (p.key === 'P') gr.P = 1;
    if (p.key === 'L') gr.L = 1;
    if (p.key === 'A') gr.A = 1;
    if (p.key === 'V') {
      gr.V = 1;
      if (!scene._bootYRevealUsesLogFragments) {
        scheduleYReveal();
      }
    }
    if (p.key === 'O') scene._homeLinkReveal.sub[0] = 1;
    if (p.key === 'E') scene._homeLinkReveal.sub[1] = 1;
    if (p.key === 'R') scene._homeLinkReveal.sub[2] = 1;
    scene._redrawHomeUI();
  };

  const isOverlapRebuildSettled = () => {
    if (!parts.every((p) => p.landed)) return false;
    const gr = scene._overlapGlyphReveal;
    if (gr && (gr.y ?? 0) < 1) return false;
    return true;
  };

  const step = () => {
    const now = performance.now();
    const T = now - epochMs;

    if (scene._homeWaitBootCollapse && T >= BOOT_BG_HOME_PANEL_REVEAL_MS) {
      const r = scene._homeBgPanelReveal;
      if (r && r.play < 1) {
        scene._homeBgPanelReveal = { play: 1, sub: [1, 1, 1] };
        scene._redrawHomeUI();
      }
    }

    parts.forEach((p) => {
      if (p.landed) return;
      if (T >= p.totalDur) {
        landOnePart(p);
      } else {
        const st = samplePart(p, T);
        p.sprite.setPosition(st.x, st.y);
        p.sprite.setScale(st.scaleX, st.scaleY);
        p.sprite.setRotation(st.rotation);
        p.sprite.setAlpha(Phaser.Math.Clamp(st.alpha, 0.08, 1));
      }
    });

    if (!isOverlapRebuildSettled()) return;

    stopRebuild();
    scene._bootYRevealUsesLogFragments = false;

    parts.forEach((f) => {
      if (f.sprite && !f.sprite.destroyed) {
        f.sprite.setPosition(f.tEnd.x, f.tEnd.y);
        f.sprite.setScale(f.txs, f.tys);
        f.sprite.setRotation(f.rotT);
        f.sprite.setAlpha(1);
        f.sprite.destroy();
      }
    });
    if (scene._bootToHomeFlying?.length) {
      scene._bootToHomeFlying = scene._bootToHomeFlying.filter((s) => !s.destroyed);
    }

    scene._overlapGlyphReveal = null;

    scene._delta.startFrame.offsetX = Phaser.Math.FloatBetween(-3.5, 3.5);
    scene._delta.startFrame.offsetY = Phaser.Math.FloatBetween(-2.8, 2.8);
    scene._delta.startFrame.alpha = 0.86;

    scene._homeLinkReveal = { play: 1, sub: [1, 1, 1] };
    scene._homeBgPanelReveal = { play: 1, sub: [1, 1, 1] };

    scene.tweens.add({
      targets: scene._delta.startFrame,
      offsetX: 0,
      offsetY: 0,
      alpha: 1,
      duration: Phaser.Math.FloatBetween(58, 82),
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
