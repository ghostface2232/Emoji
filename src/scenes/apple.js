import Matter from 'matter-js';
import { samplePointsFromPath, samplePointsFromFill, APPLE_PATH } from '../utils/svgSampler.js';

const PARTICLE_COUNT = 300;
const OUTLINE_RATIO = 0.45;        // 외곽선에 배치할 비율 (45%)
const SPAWN_DURATION = 0.4;
const SPRING_RAMP_DURATION = 1.2;
const MAX_STIFFNESS = 0.012;
const MAX_DAMPING = 0.08;
const INTERNAL_GRAVITY = 0.15;     // 사과 내부 미세 중력 (아래로)

let state = null;

function getShapeBounds(app) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const size = Math.min(sw, sh) * 0.7;
  return {
    x: (sw - size) / 2,
    y: (sh - size) / 2,
    width: size,
    height: size,
  };
}

export const appleScene = {
  async setup(app, physics, renderer, textures, sceneManager) {
    const bounds = getShapeBounds(app);

    // 1. 타겟 좌표: 외곽 라인(45%) + 내부 채우기(55%)
    const OUTLINE_COUNT = Math.round(PARTICLE_COUNT * OUTLINE_RATIO);
    const FILL_COUNT = PARTICLE_COUNT - OUTLINE_COUNT;

    const outlineTargets = samplePointsFromPath(APPLE_PATH, OUTLINE_COUNT, bounds);
    const fillTargets = samplePointsFromFill(APPLE_PATH, FILL_COUNT, bounds, {
      minDist: 2.5,
      densityBias: 0.2,
      inset: 3.0,
    });
    const targets = [...outlineTargets, ...fillTargets];

    // 2. 중력 없음 (내부 미세 중력은 update에서 수동 적용)
    physics.setGravity(0, 0);

    // 3. 텍스처
    const tex = textures.get(app, '🍎', 32);

    // 4. 사과 형태의 중심(무게중심) 계산 — 내부 중력 방향 기준점
    const centerY = targets.reduce((s, t) => s + t.y, 0) / targets.length;

    // 5. 상태 초기화
    state = {
      bodies: [],
      targets,
      tex,
      bounds,
      sceneManager,
      centerY,
      phase: 'spawning',
      elapsed: 0,
      spawned: 0,
      springSince: 0,
    };
  },

  update(app, physics, dt) {
    if (!state) return;
    state.elapsed += dt;

    const { targets, tex, sceneManager } = state;

    // ── Phase: spawning ──
    if (state.phase === 'spawning') {
      const progress = Math.min(state.elapsed / SPAWN_DURATION, 1);
      const targetCount = Math.floor(progress * PARTICLE_COUNT);

      while (state.spawned < targetCount) {
        const target = targets[state.spawned];
        const x = target.x + (Math.random() - 0.5) * 100;
        const y = -30 - Math.random() * 200;
        const body = physics.createParticleAt(x, y);
        body.targetPosition = target;
        sceneManager.addSprite(body, tex);
        state.bodies.push(body);
        state.spawned++;
      }

      if (state.spawned >= PARTICLE_COUNT) {
        state.phase = 'spring';
        state.springSince = 0;
      }
    }

    // ── 물리 적용 ──
    if (state.bodies.length > 0) {
      let stiffness, damping;

      if (state.phase === 'spawning') {
        stiffness = MAX_STIFFNESS * 0.5;
        damping = MAX_DAMPING * 0.5;
      } else if (state.phase === 'spring') {
        state.springSince += dt;
        const ramp = Math.min(state.springSince / SPRING_RAMP_DURATION, 1);
        stiffness = MAX_STIFFNESS * (0.5 + 0.5 * ramp);
        damping = MAX_DAMPING * (0.5 + 0.5 * ramp);
        if (ramp >= 1) state.phase = 'idle';
      } else {
        stiffness = MAX_STIFFNESS;
        damping = MAX_DAMPING;
      }

      physics.applySpringForces(state.bodies, stiffness, damping);
      physics.applySeparation(state.bodies);

      // 사과 내부 미세 중력: 각 body를 타겟 아래쪽으로 살짝 당김
      // → 빈 공간 없이 꽉 찬 느낌
      for (const body of state.bodies) {
        if (!body.targetPosition) continue;
        const vel = Matter.Body.getVelocity(body);
        Matter.Body.setVelocity(body, {
          x: vel.x,
          y: vel.y + INTERNAL_GRAVITY * dt,
        });
      }
    }
  },

  teardown(app, physics) {
    if (!state) return;
    physics.setGravity(0, 0);
    state = null;
  },

  onPointerDown(app, physics, x, y) {
    physics.applyExplosion({ x, y }, 250, 0.06);
  },
};
