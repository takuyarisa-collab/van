export function homeUrlDebugEnabled() {
  if (typeof window === 'undefined' || !window.location) return false;
  return /[?&]debug=1(?:&|$)/.test(window.location.search || '');
}

/**
 * PLAY 形成の見た目・URL 既定（通常: playFormationSlow=1 disableDefaultPlayPanel=1）。
 * ?debug=1 時: playFormationSpeed=N showFormationTargets showFormationLock highlightCenterCore（既定 1）showPlayFormationRoles（既定 1）等。
 *
 * @returns {{
 *   playFormationSlow: boolean,
 *   disableDefaultPlayPanel: boolean,
 *   playFormationSpeedMul: number,
 *   playFormationOvershoot: boolean,
 *   showPlayFormation: boolean,
 *   showFormationTargets: boolean,
 *   showFormationLock: boolean,
 *   highlightCenterCore: boolean,
 *   showPlayFormationRoles: boolean,
 * }}
 */
export function getPlayFormationPresentationTuning() {
  const getB = typeof window !== 'undefined' ? window.BOOT_PARAM_getBool : null;
  const getN = typeof window !== 'undefined' ? window.BOOT_PARAM_getNum : null;
  if (typeof getB !== 'function') {
    return {
      playFormationSlow: true,
      disableDefaultPlayPanel: true,
      playFormationSpeedMul: 4.5,
      playFormationOvershoot: false,
      showPlayFormation: false,
      showFormationTargets: false,
      showFormationLock: false,
      highlightCenterCore: false,
      showPlayFormationRoles: false,
    };
  }
  const dbg = homeUrlDebugEnabled();
  const playFormationSlow = getB('playFormationSlow', true);
  const disableDefaultPlayPanel = getB('disableDefaultPlayPanel', true);
  /** 既定は従来比おおよそ 2.1〜2.3 倍遅い形成（URL 非指定時） */
  const defaultSlowMul = 4.5;
  let playFormationSpeedMul = defaultSlowMul;
  if (dbg && typeof getN === 'function') {
    playFormationSpeedMul = Math.max(0.35, Math.min(6.5, getN('playFormationSpeed', defaultSlowMul)));
  } else if (!playFormationSlow) {
    playFormationSpeedMul = 1;
  }
  let showPlayFormation = false;
  let showFormationTargets = false;
  let showFormationLock = false;
  let playFormationOvershoot = false;
  let highlightCenterCore = false;
  let showPlayFormationRoles = false;
  if (dbg) {
    showPlayFormation = getB('showPlayFormation', false);
    showFormationTargets =
      getB('showPlayFormationTargets', false) || getB('showFormationTargets', false);
    showFormationLock = getB('showFormationLock', false);
    playFormationOvershoot = getB('playFormationOvershoot', false);
    highlightCenterCore = getB('highlightCenterCore', true);
    showPlayFormationRoles = getB('showPlayFormationRoles', true);
  }
  return {
    playFormationSlow,
    disableDefaultPlayPanel,
    playFormationSpeedMul,
    playFormationOvershoot,
    showPlayFormation,
    showFormationTargets,
    showFormationLock,
    highlightCenterCore,
    showPlayFormationRoles,
  };
}

/**
 * PLAY 形成シャード有効時、collapseNorm が 1.0 を超えても描画更新するためのブート崩壊延長倍率。
 */
export function getPlayFormationBootCollapseHandoffMul() {
  if (typeof window === 'undefined' || typeof window.BOOT_PARAM_getBool !== 'function') return 1;
  const t = getPlayFormationPresentationTuning();
  if (!t.disableDefaultPlayPanel || !t.playFormationSlow) return 1;
  return 1.54;
}

/** ?debug=1 時に PLAY 形成の URL 既定を一度だけ console に出す */
export function logPlayFormationDebugParamsOnce(scene) {
  if (!homeUrlDebugEnabled() || !scene || scene._playFormationDbgParamsLogged) return;
  scene._playFormationDbgParamsLogged = true;
  const t = getPlayFormationPresentationTuning();
  console.log('[PLAY_FORMATION_DEBUG]', {
    playFormationSpeed: t.playFormationSpeedMul,
    playFormationOvershoot: t.playFormationOvershoot ? 1 : 0,
    showFormationLock: t.showFormationLock ? 1 : 0,
    showFormationTargets: t.showFormationTargets ? 1 : 0,
    highlightCenterCore: t.highlightCenterCore ? 1 : 0,
    showPlayFormationRoles: t.showPlayFormationRoles ? 1 : 0,
    playFormationSlow: t.playFormationSlow,
    disableDefaultPlayPanel: t.disableDefaultPlayPanel,
  });
}

/** @deprecated 互換: getPlayFormationPresentationTuning と同等の debug 系フラグ */
export function homeUrlPlayFormationDebugFlags() {
  const t = getPlayFormationPresentationTuning();
  return {
    showPlayFormation: t.showPlayFormation,
    showFormationTargets: t.showFormationTargets,
  };
}

/** ?debug=1&bgFragNoMask=1 のときのみ true（Boot 背景断片の GeometryMask 切り分け用） */
export function homeUrlBgFragNoMaskEnabled() {
  if (!homeUrlDebugEnabled()) return false;
  if (typeof window === 'undefined' || !window.location) return false;
  return /[?&]bgFragNoMask=1(?:&|$)/.test(window.location.search || '');
}

const _num = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/**
 * ?debug=1 時に HOME の URL レイアウト係数を一度だけ console に出す
 *
 * @param {Phaser.Scene | null | undefined} scene
 */
export function logHomeUrlLayoutDebugOnce(scene) {
  if (!homeUrlDebugEnabled() || !scene || scene._homeUrlLayoutDebugLogged) return;
  scene._homeUrlLayoutDebugLogged = true;
  const w = typeof window !== 'undefined' ? window : {};
  console.log('[HOME_URL_LAYOUT]', {
    playOffsetX: _num(w.HOME_PARAM_playOffsetX),
    playOffsetY: _num(w.HOME_PARAM_playOffsetY),
    playPanelOffsetX: _num(w.HOME_PARAM_playPanelOffsetX),
    playPanelOffsetY: _num(w.HOME_PARAM_playPanelOffsetY),
    playTextOffsetX: _num(w.HOME_PARAM_playTextOffsetX),
    playTextOffsetY: _num(w.HOME_PARAM_playTextOffsetY),
    playSubGap: _num(w.HOME_PARAM_playSubGapPx),
    sub0PanelOffsetX: _num(w.HOME_PARAM_sub0PanelOffsetX),
    sub1PanelOffsetX: _num(w.HOME_PARAM_sub1PanelOffsetX),
    sub2PanelOffsetX: _num(w.HOME_PARAM_sub2PanelOffsetX),
    sub0PanelOffsetY: _num(w.HOME_PARAM_sub0PanelOffsetY),
    sub1PanelOffsetY: _num(w.HOME_PARAM_sub1PanelOffsetY),
    sub2PanelOffsetY: _num(w.HOME_PARAM_sub2PanelOffsetY),
    sub0TextOffsetX: _num(w.HOME_PARAM_sub0TextOffsetX),
    sub1TextOffsetX: _num(w.HOME_PARAM_sub1TextOffsetX),
    sub2TextOffsetX: _num(w.HOME_PARAM_sub2TextOffsetX),
    sub0TextOffsetY: _num(w.HOME_PARAM_sub0TextOffsetY),
    sub1TextOffsetY: _num(w.HOME_PARAM_sub1TextOffsetY),
    sub2TextOffsetY: _num(w.HOME_PARAM_sub2TextOffsetY),
  });
}
