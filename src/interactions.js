/**
 * 포인터(마우스/터치) 인터랙션을 초기화한다.
 * 클릭 시 국소 반발 → 원상 복원 처리.
 *
 * @param {import('pixi.js').Application} app
 * @param {import('./physics.js').PhysicsWorld} physics
 * @param {import('./scenes/sceneManager.js').SceneManager} sceneManager
 */
export function initInteractions(app, physics, sceneManager) {
  app.canvas.addEventListener('pointerdown', (e) => {
    const rect = app.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (app.screen.width / rect.width);
    const y = (e.clientY - rect.top) * (app.screen.height / rect.height);

    sceneManager.onPointerDown(x, y);
  });
}
