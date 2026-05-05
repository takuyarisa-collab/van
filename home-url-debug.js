export function homeUrlDebugEnabled() {
  if (typeof window === 'undefined' || !window.location) return false;
  return /[?&]debug=1(?:&|$)/.test(window.location.search || '');
}
