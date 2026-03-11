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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${pxSize * 0.72}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;
  ctx.fillText(emoji, pxSize / 2, pxSize / 2);

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
