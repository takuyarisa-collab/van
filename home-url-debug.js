export function homeUrlDebugEnabled() {
  if (typeof window === 'undefined' || !window.location) return false;
  return /[?&]debug=1(?:&|$)/.test(window.location.search || '');
}

/**
 * PLAY 形成の見た目・URL 既定（通常: playFormationSlow=1 disableDefaultPlayPanel=1）。
 * ?debug=1 時: playFormationSpeed=N showPlayFormationTargets=1 等。
 *
 * @returns {{
 *   playFormationSlow: boolean,
 *   disableDefaultPlayPanel: boolean,
 *   playFormationSpeedMul: number,
 *   showPlayFormation: boolean,
 *   showFormationTargets: boolean,
 * }}
 */
export function getPlayFormationPresentationTuning() {
  const getB = typeof window !== 'undefined' ? window.BOOT_PARAM_getBool : null;
  const getN = typeof window !== 'undefined' ? window.BOOT_PARAM_getNum : null;
  if (typeof getB !== 'function') {
    return {
      playFormationSlow: true,
      disableDefaultPlayPanel: true,
      playFormationSpeedMul: 2,
      showPlayFormation: false,
      showFormationTargets: false,
    };
  }
  const dbg = homeUrlDebugEnabled();
  const playFormationSlow = getB('playFormationSlow', true);
  const disableDefaultPlayPanel = getB('disableDefaultPlayPanel', true);
  let playFormationSpeedMul = 2;
  if (dbg && typeof getN === 'function') {
    playFormationSpeedMul = Math.max(0.45, Math.min(4.2, getN('playFormationSpeed', 2)));
  } else if (!playFormationSlow) {
    playFormationSpeedMul = 1;
  }
  let showPlayFormation = false;
  let showFormationTargets = false;
  if (dbg) {
    showPlayFormation = getB('showPlayFormation', false);
    showFormationTargets =
      getB('showPlayFormationTargets', false) || getB('showFormationTargets', false);
  }
  return {
    playFormationSlow,
    disableDefaultPlayPanel,
    playFormationSpeedMul,
    showPlayFormation,
    showFormationTargets,
  };
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
