/**
 * 장면 정의 목록
 * id: 장면 식별자, emoji: Dock에 표시할 이모지
 */
const SCENES = [
  { id: 'apple',  emoji: '🍎' },
  { id: 'eyes',   emoji: '👀' },
  { id: 'heart',  emoji: '❤️' },
  { id: 'laptop', emoji: '💻' },
  { id: 'galaxy', emoji: '⭐' },
];

/**
 * 하단 Dock UI를 초기화한다.
 * @param {(sceneId: string) => void} onSelect - 장면 선택 콜백
 */
export function initDock(onSelect) {
  const dock = document.getElementById('dock');
  const items = [];
  let pointerX = 0;
  let frameId = 0;

  function applyDockMagnification() {
    const dockRect = dock.getBoundingClientRect();

    for (const el of items) {
      const centerX = dockRect.left + el.offsetLeft + el.offsetWidth * 0.5;
      const distance = Math.abs(pointerX - centerX);
      const influence = Math.max(0, 1 - distance / 96);
      const scale = 1 + influence * 0.4;
      const lift = -influence * 8;

      el.style.setProperty('--dock-scale', scale.toFixed(3));
      el.style.setProperty('--dock-lift', `${lift.toFixed(2)}px`);
    }

    frameId = 0;
  }

  function scheduleDockMagnification(clientX) {
    pointerX = clientX;
    if (frameId) return;
    frameId = requestAnimationFrame(applyDockMagnification);
  }

  function resetDockMagnification() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
    for (const el of items) {
      el.style.setProperty('--dock-scale', '1');
      el.style.setProperty('--dock-lift', '0px');
    }
  }

  SCENES.forEach((scene, i) => {
    const el = document.createElement('div');
    el.className = 'dock-item';
    el.textContent = scene.emoji;
    el.dataset.scene = scene.id;

    el.addEventListener('click', () => {
      dock.querySelectorAll('.dock-item').forEach((d) => d.classList.remove('active'));
      el.classList.add('active');
      onSelect(scene.id);
    });

    dock.appendChild(el);
    items.push(el);
  });

  dock.addEventListener('pointermove', (event) => {
    scheduleDockMagnification(event.clientX);
  });

  dock.addEventListener('pointerleave', () => {
    resetDockMagnification();
  });
}
