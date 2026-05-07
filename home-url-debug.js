export function homeUrlDebugEnabled() {
  if (typeof window === 'undefined' || !window.location) return false;
  return /[?&]debug=1(?:&|$)/.test(window.location.search || '');
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
