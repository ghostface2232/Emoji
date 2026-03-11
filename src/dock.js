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

  SCENES.forEach((scene, i) => {
    const el = document.createElement('div');
    el.className = 'dock-item' + (i === 0 ? ' active' : '');
    el.textContent = scene.emoji;
    el.dataset.scene = scene.id;

    el.addEventListener('click', () => {
      dock.querySelectorAll('.dock-item').forEach((d) => d.classList.remove('active'));
      el.classList.add('active');
      onSelect(scene.id);
    });

    dock.appendChild(el);
  });
}
