/**
 * 포인터(마우스/터치) 인터랙션을 초기화한다.
 * 클릭 시 국소 반발 → 원상 복원 처리.
 *
 * @param {import('pixi.js').Application} app
 * @param {import('./physics.js').PhysicsWorld} physics
 * @param {import('./scenes/sceneManager.js').SceneManager} sceneManager
 */
export function initInteractions(app, physics, sceneManager) {
  const DRAG_STEP = 22;
  let isPointerDown = false;
  let lastDragPoint = null;

  function getPointerPosition(e) {
    const rect = app.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (app.screen.width / rect.width),
      y: (e.clientY - rect.top) * (app.screen.height / rect.height),
    };
  }

  function emitBurst(point) {
    lastDragPoint = point;
    sceneManager.onPointerDown(point.x, point.y);
  }

  app.canvas.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    const { x, y } = getPointerPosition(e);
    emitBurst({ x, y });
  });

  app.canvas.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;

    const point = getPointerPosition(e);
    if (!lastDragPoint) {
      emitBurst(point);
      return;
    }

    const dx = point.x - lastDragPoint.x;
    const dy = point.y - lastDragPoint.y;
    if (dx * dx + dy * dy >= DRAG_STEP * DRAG_STEP) {
      emitBurst(point);
    }
  });

  function stopDrag() {
    isPointerDown = false;
    lastDragPoint = null;
  }

  app.canvas.addEventListener('pointerup', stopDrag);
  app.canvas.addEventListener('pointercancel', stopDrag);
  app.canvas.addEventListener('pointerleave', stopDrag);

  app.canvas.addEventListener('lostpointercapture', stopDrag);
  app.canvas.addEventListener('contextmenu', (e) => {
    if (isPointerDown) e.preventDefault();
  });

  app.canvas.addEventListener('pointerdown', (e) => {
    if (app.canvas.setPointerCapture && e.pointerId !== undefined) {
      app.canvas.setPointerCapture(e.pointerId);
    }
  });

  app.canvas.addEventListener('pointerup', (e) => {
    if (app.canvas.releasePointerCapture && e.pointerId !== undefined) {
      try {
        app.canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }
  });
}
