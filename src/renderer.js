import { Application, Sprite } from 'pixi.js';

const MAX_DPR = 2;

export class Renderer {
  constructor() {
    /** @type {Application} */
    this.app = new Application();
  }

  /**
   * PixiJS Application을 초기화하고 캔버스를 DOM에 삽입한다.
   * @param {string} containerSelector - 캔버스를 삽입할 CSS 셀렉터
   * @returns {Promise<void>}
   */
  async init(containerSelector) {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    await this.app.init({
      backgroundAlpha: 0,
      resizeTo: window,
      antialias: true,
      resolution: dpr,
      autoDensity: true,
    });

    const container = document.querySelector(containerSelector);
    container.appendChild(this.app.canvas);

  }

  /**
   * 텍스처로부터 Sprite를 생성하고 stage에 추가한다.
   * @param {import('pixi.js').Texture} texture
   * @returns {Sprite}
   */
  createSprite(texture) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    this.app.stage.addChild(sprite);
    return sprite;
  }

  /**
   * stage에서 스프라이트를 제거한다.
   * @param {Sprite} sprite
   */
  removeSprite(sprite) {
    this.app.stage.removeChild(sprite);
  }

}
