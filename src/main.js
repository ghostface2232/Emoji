import { Renderer } from './renderer.js';
import { TextureCache } from './utils/textures.js';
import { PhysicsWorld } from './physics.js';
import { initDock } from './dock.js';
import { initInteractions } from './interactions.js';
import { SceneManager } from './scenes/sceneManager.js';

async function boot() {
  // 1. PixiJS 초기화
  const renderer = new Renderer();
  await renderer.init('#canvas-container');
  const app = renderer.app;

  // 2. 텍스처 캐시
  const textures = new TextureCache();

  // 3. Matter.js 물리 월드 초기화
  const physics = new PhysicsWorld();

  // 4. 장면 관리자 생성
  const sceneManager = new SceneManager(app, physics, renderer, textures);

  // 5. Dock UI 초기화 (장면 전환 콜백 연결)
  initDock((sceneId) => sceneManager.switchTo(sceneId));

  // 6. 포인터 인터랙션 초기화
  initInteractions(app, physics, sceneManager);

  // 7. 메인 루프
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    sceneManager.update(dt);
  });

  // 8. 기본 장면 로드
  sceneManager.switchTo('apple');
}

boot().catch(console.error);
