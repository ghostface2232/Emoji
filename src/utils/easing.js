/**
 * 이징 함수 모음.
 * 반발 후 원상 복원 애니메이션 등에 사용한다.
 */

/** @param {number} t 0–1 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** @param {number} t 0–1 */
export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

/** @param {number} t 0–1 */
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 두 값 사이를 선형 보간한다.
 * @param {number} a
 * @param {number} b
 * @param {number} t 0–1
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
