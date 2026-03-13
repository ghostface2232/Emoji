import { appleScene } from './apple.js';
import { eyesScene } from './eyes.js';
import { heartScene } from './heart.js';
import { laptopScene } from './laptop.js';
import { galaxyScene } from './galaxy.js';

/** @typedef {{ setup: Function, update: Function, teardown: Function, onPointerDown: Function }} Scene */

const SCENE_MAP = {
  apple: appleScene,
  eyes: eyesScene,
  heart: heartScene,
  laptop: laptopScene,
  galaxy: galaxyScene,
};

export class SceneManager {
  /**
   * @param {import('pixi.js').Application} app
   * @param {import('../physics.js').PhysicsWorld} physics
   * @param {import('../renderer.js').Renderer} renderer
   * @param {import('../utils/textures.js').TextureCache} textures
   */
  constructor(app, physics, renderer, textures) {
    this.app = app;
    this.physics = physics;
    this.renderer = renderer;
    this.textures = textures;
    /** @type {Scene | null} */
    this.current = null;
    this.currentId = null;

    /** @type {Map<import('matter-js').Body, import('pixi.js').Sprite>} */
    this.bodyToSprite = new Map();
    this.switchToken = 0;
    this.loadingEl = this.createLoadingOverlay();
    this.prewarmPromises = new Map();
  }

  createLoadingOverlay() {
    const el = document.getElementById('scene-loading') || document.createElement('div');
    el.id = 'scene-loading';
    el.innerHTML = '<div class="scene-loading__inner"><div class="scene-loading__emoji">👀</div><div class="scene-loading__label">Loading scene</div></div>';
    if (!el.parentNode) {
      document.body.appendChild(el);
    }
    return el;
  }

  setLoadingState(visible, sceneId) {
    if (!this.loadingEl) return;
    const emojiMap = {
      apple: '🍎',
      eyes: '👀',
      heart: '❤️',
      laptop: '💻',
      galaxy: '⭐',
    };
    const labelMap = {
      galaxy: 'stars',
    };
    const emojiEl = this.loadingEl.querySelector('.scene-loading__emoji');
    const labelEl = this.loadingEl.querySelector('.scene-loading__label');
    if (emojiEl) emojiEl.textContent = emojiMap[sceneId] || '✨';
    if (labelEl) labelEl.textContent = visible ? `Loading ${labelMap[sceneId] || sceneId}` : '';
    this.loadingEl.classList.toggle('visible', visible);
  }

  async waitForNextPaint() {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  prewarm(sceneId) {
    const scene = SCENE_MAP[sceneId];
    if (!scene || !scene.prewarm) return Promise.resolve();
    if (this.prewarmPromises.has(sceneId)) {
      return this.prewarmPromises.get(sceneId);
    }

    const promise = Promise.resolve(
      scene.prewarm(this.app, this.physics, this.renderer, this.textures, this)
    ).finally(() => {
      this.prewarmPromises.delete(sceneId);
    });

    this.prewarmPromises.set(sceneId, promise);
    return promise;
  }

  // ── Body↔Sprite 생명주기 ──────────────────────

  /**
   * Body에 대응하는 Sprite를 생성하고 Map에 등록한다.
   * @param {import('matter-js').Body} body
   * @param {import('pixi.js').Texture} texture
   * @returns {import('pixi.js').Sprite}
   */
  addSprite(body, texture) {
    const sprite = this.renderer.createSprite(texture);
    sprite.x = body.position.x;
    sprite.y = body.position.y;
    this.bodyToSprite.set(body, sprite);
    return sprite;
  }

  /**
   * Body와 대응 Sprite를 모두 제거한다.
   * @param {import('matter-js').Body} body
   */
  removeSprite(body) {
    const sprite = this.bodyToSprite.get(body);
    if (sprite) {
      this.renderer.removeSprite(sprite);
      this.bodyToSprite.delete(body);
    }
  }

  /**
   * 모든 Body↔Sprite 매핑을 제거한다. 장면 전환 시 호출.
   */
  clearSprites() {
    for (const sprite of this.bodyToSprite.values()) {
      this.renderer.removeSprite(sprite);
    }
    this.bodyToSprite.clear();
  }

  // ── 장면 전환 ──────────────────────────────────

  /**
   * 장면을 전환한다.
   * @param {string} sceneId
   */
  async switchTo(sceneId) {
    const token = ++this.switchToken;
    if (this.current) {
      this.current.teardown(this.app, this.physics);
    }

    this.clearSprites();
    this.physics.clearParticles();

    const scene = SCENE_MAP[sceneId];
    if (!scene) {
      console.warn(`Unknown scene: ${sceneId}`);
      return;
    }

    this.current = scene;
    this.currentId = sceneId;
    this.setLoadingState(true, sceneId);

    try {
      await this.waitForNextPaint();
      if (token !== this.switchToken) return;
      await scene.setup(this.app, this.physics, this.renderer, this.textures, this);
    } finally {
      if (token === this.switchToken) {
        this.setLoadingState(false, sceneId);
      }
    }
  }

  // ── 매 프레임 ──────────────────────────────────

  /**
   * ticker에서 매 프레임 호출.
   * a. 장면별 update (force 적용 등)
   * b. 물리 스텝
   * c. Body→Sprite 위치/회전 동기화
   * @param {number} dt
   */
  update(dt) {
    // a. 장면별 로직 (스프링, 반발 등)
    if (this.current) {
      this.current.update(this.app, this.physics, dt);
    }

    // b. 물리 스텝
    this.physics.step();

    // c. 모든 Body→Sprite 동기화
    for (const [body, sprite] of this.bodyToSprite) {
      sprite.x = body.position.x;
      sprite.y = body.position.y;
      sprite.rotation = body.angle;
    }
  }

  /**
   * 포인터 다운 이벤트를 현재 장면에 전달.
   * @param {number} x
   * @param {number} y
   */
  onPointerDown(x, y) {
    if (this.current && this.current.onPointerDown) {
      this.current.onPointerDown(this.app, this.physics, x, y);
    }
  }
}
