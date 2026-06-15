import { Texture, CanvasSource } from 'pixi.js';

/**
 * Canvas에 이모지를 그려 PixiJS Texture로 변환한다.
 * @param {import('pixi.js').Application} app
 * @param {string} emoji - 단일 이모지 문자
 * @param {number} [size=64] - 논리 크기 (px)
 * @returns {Texture}
 */
export function createEmojiTexture(app, emoji, size = 64) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // 2배 슈퍼샘플링으로 렌더링 후 축소 → 부드러운 테두리
  const scale = 2;
  const pxSize = size * dpr * scale;

  const canvas = document.createElement('canvas');
  canvas.width = pxSize;
  canvas.height = pxSize;

  const source = new CanvasSource({ resource: canvas, resolution: dpr * scale });

  const ctx = source.context2D;
  ctx.clearRect(0, 0, pxSize, pxSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 폰트 크기는 캔버스에 약간의 여백을 두어 잉크가 경계를 넘지 않게 한다.
  const fontPx = pxSize * 0.72;
  ctx.font = `${fontPx}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;

  // advance width 기준이 아니라 실제 잉크 경계(actualBoundingBox)를 측정하여
  // 그 경계를 캔버스 정중앙에 맞춘다. 이렇게 하면 Apple Color Emoji처럼
  // 글리프 비트맵이 advance box 안에서 한쪽으로 치우친 폰트에서도
  // 좌우/상하 클리핑 없이 항상 중앙에 정렬된다.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(emoji);

  const hasInkBounds =
    Number.isFinite(m.actualBoundingBoxLeft) &&
    Number.isFinite(m.actualBoundingBoxRight) &&
    Number.isFinite(m.actualBoundingBoxAscent) &&
    Number.isFinite(m.actualBoundingBoxDescent) &&
    (m.actualBoundingBoxLeft !== 0 || m.actualBoundingBoxRight !== 0);

  if (hasInkBounds) {
    const inkLeft = m.actualBoundingBoxLeft;
    const inkRight = m.actualBoundingBoxRight;
    const inkAscent = m.actualBoundingBoxAscent;
    const inkDescent = m.actualBoundingBoxDescent;
    // 잉크의 중심이 캔버스 정중앙에 오도록 펜 위치를 역산한다.
    // 가로: 잉크 범위는 [penX - inkLeft, penX + inkRight]
    // 세로: 잉크 범위는 [penY - inkAscent, penY + inkDescent]
    const penX = pxSize / 2 - (inkRight - inkLeft) / 2;
    const penY = pxSize / 2 - (inkDescent - inkAscent) / 2;
    ctx.fillText(emoji, penX, penY);
  } else {
    // 잉크 경계 측정을 지원하지 않는 환경에서는 기존 중앙 정렬로 폴백한다.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, pxSize / 2, pxSize / 2);
  }

  source.update();

  return new Texture({ source });
}

/**
 * 이모지 텍스처를 캐싱하여 동일 이모지·사이즈 조합은 한 번만 생성한다.
 */
export class TextureCache {
  constructor() {
    /** @type {Map<string, Texture>} */
    this._map = new Map();
  }

  /**
   * @param {import('pixi.js').Application} app
   * @param {string} emoji
   * @param {number} [size=64]
   * @returns {Texture}
   */
  get(app, emoji, size = 64) {
    const key = `${emoji}_${size}`;
    if (!this._map.has(key)) {
      this._map.set(key, createEmojiTexture(app, emoji, size));
    }
    return this._map.get(key);
  }
}
