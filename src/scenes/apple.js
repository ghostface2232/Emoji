import Matter from 'matter-js';
import { APPLE_PATH, samplePackedPointsFromFill, samplePointsFromPath } from '../utils/svgSampler.js';
import { lerp } from '../utils/easing.js';

const PARTICLE_COUNT = 350;
const SHAPE_SCALE = 0.9;
const SHAPE_OFFSET_Y = -0.045;
const LEAF_SCALE = 1.12;
const LEAF_ORIGIN_X = 41.5;
const LEAF_ORIGIN_Y = 12.5;
const SPAWN_DURATION = 0.92;
const SETTLE_DURATION = 1.28;
const MAX_STIFFNESS = 0.04;
const MAX_DAMPING = 0.16;
const INTERNAL_GRAVITY = 0.08;
const IDLE_INTERNAL_GRAVITY = 0.24;
const IDLE_SWAY_AMPLITUDE = 0.16;
const IDLE_SWAY_SPEED = 0.95;
const IDLE_TARGET_SWAY_X = 3.2;
const IDLE_TARGET_SWAY_Y = 2.2;
const IDLE_TARGET_SWAY_SPEED = 0.75;
const DISTURB_DURATION = 2.2;
const SPAWN_X_SPREAD = 26;
const SPAWN_Y_MIN = 20;
const SPAWN_Y_MAX = 56;
const SPAWN_SPRING_ATTACK = 0.82;
const BODY_RADIUS_RATIO = 0.372;
const SEPARATION_RATIO = 1.02;
const SEPARATION_STRENGTH = 1.12;
const IDLE_DRAG = 0.985;
const ANGULAR_DRAG = 0.992;
const SPAWN_ANGULAR_VELOCITY = 0.22;

const PARAM_COUNT = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

let state = null;

function createLeafTester(fullPathData, bounds) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(svg);

  const dList = Array.isArray(fullPathData) ? fullPathData : [fullPathData];
  const allPaths = dList.map((d) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return p;
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPaths) {
    const b = p.getBBox();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  const leafPathEl = allPaths[1];

  const scaleX = bounds.width / bbox.width;
  const scaleY = bounds.height / bbox.height;
  const scale = Math.min(scaleX, scaleY);
  const fitW = bbox.width * scale;
  const fitH = bbox.height * scale;
  const offX = bounds.x + (bounds.width - fitW) / 2;
  const offY = bounds.y + (bounds.height - fitH) / 2;

  const point = svg.createSVGPoint();

  function isInLeaf(screenX, screenY) {
    point.x = ((screenX - offX) / fitW) * bbox.width + bbox.x;
    point.y = ((screenY - offY) / fitH) * bbox.height + bbox.y;
    return leafPathEl.isPointInFill(point);
  }

  function cleanup() {
    document.body.removeChild(svg);
  }

  return { isInLeaf, cleanup };
}

function formatPathNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function scaleAbsolutePathData(pathData, scale, originX, originY) {
  const tokens = pathData.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const output = [];
  let command = '';
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (/^[a-zA-Z]$/.test(token)) {
      command = token;
      output.push(command);
      index++;
      continue;
    }

    const upper = command.toUpperCase();
    const paramCount = PARAM_COUNT[upper];
    if (paramCount == null || paramCount === 0) {
      index++;
      continue;
    }

    const values = [];
    for (let i = 0; i < paramCount && index < tokens.length; i++, index++) {
      values.push(Number(tokens[index]));
    }

    if (command === upper) {
      if (upper === 'A') {
        values[0] *= scale;
        values[1] *= scale;
        values[5] = originX + (values[5] - originX) * scale;
        values[6] = originY + (values[6] - originY) * scale;
      } else if (upper === 'H') {
        values[0] = originX + (values[0] - originX) * scale;
      } else if (upper === 'V') {
        values[0] = originY + (values[0] - originY) * scale;
      } else {
        for (let i = 0; i < values.length; i += 2) {
          values[i] = originX + (values[i] - originX) * scale;
          values[i + 1] = originY + (values[i + 1] - originY) * scale;
        }
      }
    }

    output.push(values.map(formatPathNumber).join(' '));
  }

  return output.join(' ');
}

const APPLE_SHAPE_PATH = [
  APPLE_PATH[0],
  scaleAbsolutePathData(APPLE_PATH[1], LEAF_SCALE, LEAF_ORIGIN_X, LEAF_ORIGIN_Y),
];

function getShapeBounds(app) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const size = Math.min(sw, sh) * 0.7 * SHAPE_SCALE;
  return {
    x: (sw - size) / 2,
    y: (sh - size) / 2 + size * SHAPE_OFFSET_Y,
    width: size,
    height: size,
  };
}

function measurePackingDistance(points) {
  let total = 0;

  for (let i = 0; i < points.length; i++) {
    let nearestSq = Infinity;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestSq) nearestSq = distSq;
    }
    total += Math.sqrt(nearestSq);
  }

  return total / Math.max(points.length, 1);
}

function getLeafMetrics(bounds) {
  const points = samplePointsFromPath(APPLE_SHAPE_PATH[1], 72, bounds);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return {
    centerX: (minX + maxX) * 0.5,
    topY: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function smoothstep(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function syncIdleTargets() {
  for (let i = 0; i < state.runtimeTargets.length; i++) {
    const base = state.finalTargets[i];
    const current = state.runtimeTargets[i];
    const seed = state.idleSeeds[i];
    const time = state.idleMotionTime * IDLE_TARGET_SWAY_SPEED;

    current.x = base.x + Math.sin(time + seed * 6.283) * IDLE_TARGET_SWAY_X;
    current.y = base.y + Math.cos(time * 0.82 + seed * 4.913) * IDLE_TARGET_SWAY_Y;
  }
}

function getSpringProfile() {
  if (state.phase === 'spawning') {
    const progress = Math.min(state.elapsed / SPAWN_DURATION, 1);
    return {
      stiffness: lerp(MAX_STIFFNESS * 0.26, MAX_STIFFNESS * 0.62, smoothstep(progress)),
      damping: lerp(MAX_DAMPING * 0.34, MAX_DAMPING * 0.62, smoothstep(progress)),
    };
  }

  if (state.phase === 'settle') {
    const ramp = Math.min(state.settleElapsed / SETTLE_DURATION, 1);
    return {
      stiffness: lerp(MAX_STIFFNESS * 0.62, MAX_STIFFNESS * 0.84, smoothstep(ramp)),
      damping: lerp(MAX_DAMPING * 0.62, MAX_DAMPING * 0.9, smoothstep(ramp)),
    };
  }

  const disturb = Math.min(state.disturbElapsed / DISTURB_DURATION, 1);
  return {
    stiffness: lerp(MAX_STIFFNESS * 0.2, MAX_STIFFNESS * 0.45, disturb),
    damping: lerp(MAX_DAMPING * 0.5, MAX_DAMPING * 0.72, disturb),
  };
}

function applyAppleSpringForces(baseStiffness, baseDamping, dt) {
  for (const body of state.bodies) {
    if (!body.targetPosition) continue;

    body.springAge = (body.springAge || 0) + dt;
    const ageRamp = smoothstep(body.springAge / SPAWN_SPRING_ATTACK);
    const stiffness = baseStiffness * (0.28 + 0.72 * ageRamp);
    const damping = lerp(baseDamping * 0.58, baseDamping, ageRamp);
    const dx = body.targetPosition.x - body.position.x;
    const dy = body.targetPosition.y - body.position.y;
    const velocity = Matter.Body.getVelocity(body);

    Matter.Body.setVelocity(body, {
      x: velocity.x * (1 - damping) + dx * stiffness,
      y: velocity.y * (1 - damping) + dy * stiffness,
    });
  }
}

function updatePhase(dt) {
  if (state.phase === 'spawning') {
    const progress = Math.min(state.elapsed / SPAWN_DURATION, 1);
    const targetCount = Math.floor(progress * PARTICLE_COUNT);

    while (state.spawned < targetCount) {
      const runtimeTarget = state.runtimeTargets[state.spawned];
      const x = runtimeTarget.x + (Math.random() - 0.5) * SPAWN_X_SPREAD;
      const y = -SPAWN_Y_MIN - Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
      const body = state.physics.createParticleAt(x, y, {
        radius: state.bodyRadius,
        restitution: 0.08,
        friction: 0.08,
        frictionAir: 0.038,
        collisionGroup: 0,
        lockRotation: false,
      });

      body.targetPosition = runtimeTarget;
      body.springAge = 0;
      Matter.Body.setAngle(body, Math.random() * Math.PI * 2);
      Matter.Body.setAngularVelocity(
        body,
        (Math.random() - 0.5) * SPAWN_ANGULAR_VELOCITY * 2
      );
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 0.7,
        y: 1.15 + Math.random() * 1.05,
      });
      const tex = state.leafFlags[state.spawned] ? state.leafTex : state.tex;
      state.sceneManager.addSprite(body, tex);
      state.bodies.push(body);
      state.spawned++;
    }

    if (state.spawned >= PARTICLE_COUNT) {
      state.phase = 'settle';
      state.phaseElapsed = 0;
      state.settleElapsed = 0;
    }

    return;
  }

  state.phaseElapsed += dt;

  if (state.phase === 'settle') {
    state.settleElapsed += dt;

    if (state.settleElapsed >= SETTLE_DURATION) {
      state.phase = 'idle';
      state.phaseElapsed = 0;
    }
    return;
  }

  if (state.phase === 'idle') {
    syncIdleTargets();
  }
}

export const appleScene = {
  async setup(app, physics, renderer, textures, sceneManager) {
    const bounds = getShapeBounds(app);
    const leafMetrics = getLeafMetrics(bounds);
    const leafBandY = leafMetrics.topY + leafMetrics.height * 0.72;
    const finalTargets = samplePackedPointsFromFill(APPLE_SHAPE_PATH, PARTICLE_COUNT, bounds, {
      jitterRatio: 0.24,
      edgeInsetRatio: 0.12,
      relaxIterations: 7,
      spacingScale: 0.87,
      rowOffsetJitter: 0.26,
      scoreFn: ({ x, y }) => {
        const topBias = Math.max(0, 1 - (y - bounds.y) / Math.max(bounds.height * 0.38, 1));
        const leafCenterBias = Math.max(0, 1 - Math.abs(x - leafMetrics.centerX) / Math.max(leafMetrics.width * 0.7, 1));
        const leafBandBias = y <= leafBandY
          ? 1.35
          : Math.max(0, 1 - (y - leafBandY) / Math.max(bounds.height * 0.1, 1));
        return topBias * leafCenterBias * leafBandBias * 2.1;
      },
    });
    const runtimeTargets = finalTargets.map((target) => ({ ...target }));
    const packingDistance = measurePackingDistance(finalTargets);
    const bodyRadius = Math.max(8.5, packingDistance * BODY_RADIUS_RATIO);
    const idleSeeds = finalTargets.map(() => Math.random());

    const { isInLeaf, cleanup: cleanupLeafTester } = createLeafTester(APPLE_SHAPE_PATH, bounds);
    const leafFlags = finalTargets.map((t) => isInLeaf(t.x, t.y));
    cleanupLeafTester();

    // Expand leaf coverage: add nearest non-leaf points to fill out the leaf
    const leafIndices = [];
    const nonLeafIndices = [];
    for (let i = 0; i < leafFlags.length; i++) {
      if (leafFlags[i]) leafIndices.push(i);
      else nonLeafIndices.push(i);
    }
    if (leafIndices.length > 0) {
      const scored = nonLeafIndices.map((i) => {
        let minDistSq = Infinity;
        for (const li of leafIndices) {
          const dx = finalTargets[i].x - finalTargets[li].x;
          const dy = finalTargets[i].y - finalTargets[li].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) minDistSq = distSq;
        }
        return { index: i, dist: minDistSq };
      });
      scored.sort((a, b) => a.dist - b.dist);
      const extraLeafCount = 5;
      for (let i = 0; i < Math.min(extraLeafCount, scored.length); i++) {
        leafFlags[scored[i].index] = true;
      }
    }

    physics.setGravity(0, 0);

    state = {
      bounds,
      tex: textures.get(app, '🍎', 32),
      leafTex: textures.get(app, '🍏', 32),
      leafFlags,
      bodies: [],
      finalTargets,
      runtimeTargets,
      packingDistance,
      bodyRadius,
      physics,
      sceneManager,
      idleSeeds,
      phase: 'spawning',
      elapsed: 0,
      phaseElapsed: 0,
      settleElapsed: 0,
      spawned: 0,
      idleMotionTime: 0,
      disturbElapsed: DISTURB_DURATION,
    };
  },

  update(app, physics, dt) {
    if (!state) return;

    state.elapsed += dt;
    updatePhase(dt);

    if (state.bodies.length === 0) return;

    const { stiffness, damping } = getSpringProfile();
    applyAppleSpringForces(stiffness, damping, dt);

    const separationStrength = state.phase === 'idle'
      ? SEPARATION_STRENGTH * 0.72
      : SEPARATION_STRENGTH;
    physics.applySeparation(
      state.bodies,
      state.packingDistance * SEPARATION_RATIO,
      separationStrength
    );

    if (state.phase === 'idle') {
      state.idleMotionTime += dt;
      state.disturbElapsed = Math.min(state.disturbElapsed + dt, DISTURB_DURATION);
    }

    for (const body of state.bodies) {
      const velocity = Matter.Body.getVelocity(body);
      const drag = state.phase === 'idle' ? IDLE_DRAG : 1;
      const gravityY = state.phase === 'idle' ? IDLE_INTERNAL_GRAVITY : INTERNAL_GRAVITY;
      let gravityX = 0;

      if (state.phase === 'idle') {
        const normalizedX = (body.position.x - body.targetPosition.x) / Math.max(state.packingDistance, 1);
        gravityX =
          Math.sin(state.idleMotionTime * IDLE_SWAY_SPEED + body.targetPosition.y * 0.012) *
          IDLE_SWAY_AMPLITUDE -
          normalizedX * 0.015;
      }

      Matter.Body.setAngularVelocity(body, body.angularVelocity * ANGULAR_DRAG);
      Matter.Body.setVelocity(body, {
        x: velocity.x * drag + gravityX * dt,
        y: velocity.y * drag + gravityY * dt,
      });
    }
  },

  teardown() {
    if (!state) return;
    state.physics.setGravity(0, 0);
    state = null;
  },

  onPointerDown(app, physics, x, y) {
    if (state) {
      state.disturbElapsed = 0;
    }
    physics.applyExplosion({ x, y }, 235, 0.04);
  },
};
