/** Stable pseudo-random for Home UI micro-offsets (no per-frame animation). */
export function _homeUiHash32(seed) {
  let x = (seed >>> 0) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
export function _homeUiUnit(seed) {
  return (_homeUiHash32(seed) & 0xffff) / 0xffff;
}
export function _homeUiRandRange(seed, lo, hi) {
  return lo + _homeUiUnit(seed) * (hi - lo);
}
export function _homeUiRandInt(seed, lo, hi) {
  return lo + (_homeUiHash32(seed) % (hi - lo + 1));
}
