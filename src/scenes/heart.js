import Matter from 'matter-js';
import { HEART_PATH, samplePackedPointsFromFill } from '../utils/svgSampler.js';
import { lerp } from '../utils/easing.js';

const PARTICLE_COUNT = 360;
const SHAPE_SCALE = 0.74;
const SHAPE_OFFSET_Y = -0.01;
const BODY_RADIUS_RATIO = 0.37;
const ENTRY_EDGE_PADDING = 26;
const ENTRY_SPEED_MIN = 8.4;
const ENTRY_SPEED_MAX = 11.2;
const ENTRY_TANGENT_JITTER = 2.2;
const FORMING_MIN_DURATION = 1.15;
const FORMING_MAX_DURATION = 2.25;
const SETTLED_ERROR_RATIO = 0.62;
const SPRING_STIFFNESS_START = 0.008;
const SPRING_STIFFNESS_END = 0.034;
const SPRING_RAMP_DURATION = 1.5;
const FORMING_DAMPING_START = 0.02;
const FORMING_DAMPING_END = 0.11;
const IDLE_DAMPING_MIN = 0.052;
const IDLE_DAMPING_MAX = 0.12;
const HEART_CONTAINMENT_RATIO = 0.92;
const HEART_CONTAINMENT_BOOST = 2.4;
const SEPARATION_RATIO = 1.04;
const SEPARATION_STRENGTH = 1.34;
const FORMING_DRAG = 0.996;
const IDLE_DRAG = 0.99;
const ANGULAR_DRAG = 0.994;
const DISTURB_DURATION = 1.6;
const CLICK_EXPLOSION_RADIUS = 240;
const CLICK_EXPLOSION_STRENGTH = 0.05;
const WALL_RESTITUTION = 0.85;
const WALL_FRICTION = 0.05;
const PULSE_CYCLE_DURATION = 1.4;
const PULSE_JITTER_TIME = 0.04;
const PULSE_AMPLITUDE = 3.6;

const PULSE_KEYFRAMES = [
  { time: 0, value: 0 },
  { time: 0.21, value: 1 },
  { time: 0.35, value: 0.2 },
  { time: 0.56, value: 0.78 },
  { time: 1.4, value: 0 },
];

let state = null;
const heartTargetCache = new Map();

function smoothstep(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function hash01(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function getHeartBounds(app) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const size = Math.min(sw, sh) * SHAPE_SCALE;
  return {
    x: (sw - size) * 0.5,
    y: (sh - size) * 0.5 + size * SHAPE_OFFSET_Y,
    width: size,
    height: size,
  };
}

function getLayoutCacheKey(bounds) {
  return [
    Math.round(bounds.x),
    Math.round(bounds.y),
    Math.round(bounds.width),
    Math.round(bounds.height),
    PARTICLE_COUNT,
  ].join(':');
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

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }
  return items;
}

function getSpawnPosition(app, index) {
  const pad = ENTRY_EDGE_PADDING;
  const sw = app.screen.width;
  const sh = app.screen.height;
  const side = index % 4;

  if (side === 0) {
    return {
      x: pad + Math.random() * Math.max(sw - pad * 2, 1),
      y: pad,
    };
  }

  if (side === 1) {
    return {
      x: sw - pad,
      y: pad + Math.random() * Math.max(sh - pad * 2, 1),
    };
  }

  if (side === 2) {
    return {
      x: pad + Math.random() * Math.max(sw - pad * 2, 1),
      y: sh - pad,
    };
  }

  return {
    x: pad,
    y: pad + Math.random() * Math.max(sh - pad * 2, 1),
  };
}

function applyEntryVelocity(body, spawn, center) {
  const dx = center.x - spawn.x;
  const dy = center.y - spawn.y;
  const dist = Math.max(Math.hypot(dx, dy), 1);
  const nx = dx / dist;
  const ny = dy / dist;
  const tx = -ny;
  const ty = nx;
  const speed = lerp(ENTRY_SPEED_MIN, ENTRY_SPEED_MAX, Math.random());
  const tangent = (Math.random() - 0.5) * ENTRY_TANGENT_JITTER * 2;

  Matter.Body.setVelocity(body, {
    x: nx * speed + tx * tangent,
    y: ny * speed + ty * tangent,
  });
}

function getPulseValue(time) {
  const localTime = ((time % PULSE_CYCLE_DURATION) + PULSE_CYCLE_DURATION) % PULSE_CYCLE_DURATION;

  for (let i = 0; i < PULSE_KEYFRAMES.length - 1; i++) {
    const current = PULSE_KEYFRAMES[i];
    const next = PULSE_KEYFRAMES[i + 1];

    if (localTime < next.time) {
      const segmentT = (localTime - current.time) / Math.max(next.time - current.time, 0.0001);
      return lerp(current.value, next.value, smoothstep(segmentT));
    }
  }

  return 0;
}

function getAverageTargetError() {
  if (!state || state.bodies.length === 0) return Infinity;

  let total = 0;
  for (const body of state.bodies) {
    if (!body.targetPosition) continue;
    total += Math.hypot(
      body.targetPosition.x - body.position.x,
      body.targetPosition.y - body.position.y
    );
  }

  return total / Math.max(state.bodies.length, 1);
}

function resolveHeartCache(bounds) {
  const cacheKey = getLayoutCacheKey(bounds);
  let cached = heartTargetCache.get(cacheKey);

  if (!cached) {
    const sampledTargets = samplePackedPointsFromFill(HEART_PATH, PARTICLE_COUNT, bounds, {
      jitterRatio: 0.18,
      edgeInsetRatio: 0.08,
      relaxIterations: 8,
      spacingScale: 0.88,
      rowOffsetJitter: 0.18,
    });

    let centerX = 0;
    let centerY = 0;
    for (const point of sampledTargets) {
      centerX += point.x;
      centerY += point.y;
    }
    centerX /= Math.max(sampledTargets.length, 1);
    centerY /= Math.max(sampledTargets.length, 1);

    let maxRadius = 1;
    for (const point of sampledTargets) {
      const dist = Math.hypot(point.x - centerX, point.y - centerY);
      if (dist > maxRadius) maxRadius = dist;
    }

    const packingDistance = measurePackingDistance(sampledTargets);
    const bodyRadius = Math.max(9, packingDistance * BODY_RADIUS_RATIO);
    const finalTargets = sampledTargets.map((point) => {
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const dist = Math.hypot(dx, dy);
      const seed = hash01(point.x * 0.013, point.y * 0.017);

      return {
        baseX: point.x,
        baseY: point.y,
        dirX: dist > 0.0001 ? dx / dist : 0,
        dirY: dist > 0.0001 ? dy / dist : -1,
        distNorm: dist / maxRadius,
        pulseOffset: (seed - 0.5) * PULSE_JITTER_TIME,
        pulseScale: 0.92 + seed * 0.22,
      };
    });

    cached = {
      center: { x: centerX, y: centerY },
      packingDistance,
      bodyRadius,
      finalTargets,
    };
    heartTargetCache.set(cacheKey, cached);
  }

  return cached;
}

function applyHeartLayout(app) {
  const bounds = getHeartBounds(app);
  const cached = resolveHeartCache(bounds);

  state.bounds = bounds;
  state.center = cached.center;
  state.packingDistance = cached.packingDistance;
  state.bodyRadius = cached.bodyRadius;

  for (let i = 0; i < cached.finalTargets.length; i++) {
    const next = cached.finalTargets[i];

    if (state.finalTargets[i]) {
      state.finalTargets[i].baseX = next.baseX;
      state.finalTargets[i].baseY = next.baseY;
      state.finalTargets[i].dirX = next.dirX;
      state.finalTargets[i].dirY = next.dirY;
      state.finalTargets[i].distNorm = next.distNorm;
      state.finalTargets[i].pulseOffset = next.pulseOffset;
      state.finalTargets[i].pulseScale = next.pulseScale;
    } else {
      state.finalTargets.push({ ...next });
    }

    if (state.runtimeTargets[i]) {
      state.runtimeTargets[i].x = next.baseX;
      state.runtimeTargets[i].y = next.baseY;
    } else {
      state.runtimeTargets.push({
        x: next.baseX,
        y: next.baseY,
      });
    }
  }

  state.finalTargets.length = cached.finalTargets.length;
  state.runtimeTargets.length = cached.finalTargets.length;

  if (state.phase !== 'forming') {
    syncPulseTargets();
  }
}

function remapPoint(point, fromBounds, toBounds) {
  point.x = toBounds.x + ((point.x - fromBounds.x) / Math.max(fromBounds.width, 1)) * toBounds.width;
  point.y = toBounds.y + ((point.y - fromBounds.y) / Math.max(fromBounds.height, 1)) * toBounds.height;
}

function previewHeartLayout(app) {
  const previousBounds = state.bounds;
  const bounds = getHeartBounds(app);
  const scaleX = bounds.width / Math.max(previousBounds.width, 1);

  for (const target of state.finalTargets) {
    const mapped = { x: target.baseX, y: target.baseY };
    remapPoint(mapped, previousBounds, bounds);
    target.baseX = mapped.x;
    target.baseY = mapped.y;
  }

  for (const target of state.runtimeTargets) {
    remapPoint(target, previousBounds, bounds);
  }

  const center = { x: state.center.x, y: state.center.y };
  remapPoint(center, previousBounds, bounds);
  state.center = center;

  for (const body of state.bodies) {
    const mapped = { x: body.position.x, y: body.position.y };
    remapPoint(mapped, previousBounds, bounds);
    Matter.Body.setPosition(body, mapped);
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
  }

  state.bounds = bounds;
  state.packingDistance *= scaleX;
  state.bodyRadius *= scaleX;

  if (state.phase !== 'forming') {
    syncPulseTargets();
  }
}

function getSpringProfile() {
  if (state.phase === 'forming') {
    const progress = Math.min(state.elapsed / SPRING_RAMP_DURATION, 1);
    return {
      stiffness: lerp(SPRING_STIFFNESS_START, SPRING_STIFFNESS_END, smoothstep(progress)),
      damping: lerp(FORMING_DAMPING_START, FORMING_DAMPING_END, smoothstep(progress)),
    };
  }

  const disturb = Math.min(state.disturbElapsed / DISTURB_DURATION, 1);
  return {
    stiffness: lerp(SPRING_STIFFNESS_END * 0.72, SPRING_STIFFNESS_END * 1.16, disturb),
    damping: lerp(IDLE_DAMPING_MIN, IDLE_DAMPING_MAX, disturb),
  };
}

function applyHeartSpringForces(baseStiffness, baseDamping, dt) {
  for (const body of state.bodies) {
    if (!body.targetPosition) continue;

    body.springAge = (body.springAge || 0) + dt;
    const ageRamp = smoothstep(body.springAge / 0.72);
    const stiffness = baseStiffness * (0.32 + 0.68 * ageRamp);
    const damping = lerp(baseDamping * 0.5, baseDamping, ageRamp);
    const dx = body.targetPosition.x - body.position.x;
    const dy = body.targetPosition.y - body.position.y;
    const targetDist = Math.hypot(dx, dy);
    const containmentStart = state.packingDistance * HEART_CONTAINMENT_RATIO;
    const containmentT = Math.max(
      0,
      Math.min(1, (targetDist - containmentStart) / Math.max(state.packingDistance * 1.7, 1))
    );
    const containmentBoost = lerp(1, HEART_CONTAINMENT_BOOST, containmentT);
    const velocity = Matter.Body.getVelocity(body);

    Matter.Body.setVelocity(body, {
      x: velocity.x * (1 - damping) + dx * stiffness * containmentBoost,
      y: velocity.y * (1 - damping) + dy * stiffness * containmentBoost,
    });
  }
}

function syncPulseTargets() {
  for (let i = 0; i < state.runtimeTargets.length; i++) {
    const target = state.runtimeTargets[i];
    const base = state.finalTargets[i];
    const pulse = getPulseValue(state.pulseTime + base.pulseOffset);
    const radialWeight = 0.06 + Math.pow(base.distNorm, 1.85) * 1.42;
    const offset = pulse * state.packingDistance * PULSE_AMPLITUDE * radialWeight * base.pulseScale;
    const verticalBias = 1 + Math.max(0, base.dirY) * 0.2 - Math.max(0, -base.dirY) * 0.06;

    // 중심부는 거의 고정하고 외곽만 더 크게 밀어내서 단순 스케일처럼 보이지 않게 만든다.
    target.x = base.baseX + base.dirX * offset;
    target.y = base.baseY + base.dirY * offset * verticalBias;
  }
}

function updatePhase(dt) {
  if (state.phase === 'forming') {
    if (state.elapsed < FORMING_MIN_DURATION) return;

    const averageError = getAverageTargetError();
    if (
      averageError <= state.packingDistance * SETTLED_ERROR_RATIO ||
      state.elapsed >= FORMING_MAX_DURATION
    ) {
      state.phase = 'pulse';
      state.pulseTime = 0;
      syncPulseTargets();
    }
    return;
  }

  state.pulseTime += dt;
  state.disturbElapsed = Math.min(state.disturbElapsed + dt, DISTURB_DURATION);
  syncPulseTargets();
}

export const heartScene = {
  async prewarm(app) {
    const bounds = getHeartBounds(app);
    resolveHeartCache(bounds);
  },

  async setup(app, physics, renderer, textures, sceneManager) {
    const bounds = getHeartBounds(app);
    const cached = resolveHeartCache(bounds);
    const tex = textures.get(app, '❤️', 32);
    const finalTargets = cached.finalTargets.map((target) => ({ ...target }));
    const runtimeTargets = finalTargets.map((target) => ({
      x: target.baseX,
      y: target.baseY,
    }));
    const spawnTargets = runtimeTargets.slice();
    const bodies = [];

    physics.setGravity(0, 0);

    const wallState = (physics.walls || []).map((wall) => ({
      wall,
      restitution: wall.restitution,
      friction: wall.friction,
    }));
    for (const entry of wallState) {
      entry.wall.restitution = WALL_RESTITUTION;
      entry.wall.friction = WALL_FRICTION;
    }

    shuffleInPlace(spawnTargets);

    for (let i = 0; i < spawnTargets.length; i++) {
      const spawn = getSpawnPosition(app, i);
      const body = physics.createParticleAt(spawn.x, spawn.y, {
        radius: cached.bodyRadius,
        restitution: 0.85,
        friction: 0.04,
        frictionAir: 0.006,
        collisionGroup: 0,
        lockRotation: false,
      });

      body.targetPosition = spawnTargets[i];
      body.springAge = 0;
      Matter.Body.setAngle(body, Math.random() * Math.PI * 2);
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.42);
      applyEntryVelocity(body, spawn, cached.center);

      sceneManager.addSprite(body, tex);
      bodies.push(body);
    }

    state = {
      physics,
      sceneManager,
      bounds,
      finalTargets,
      runtimeTargets,
      bodies,
      center: cached.center,
      packingDistance: cached.packingDistance,
      bodyRadius: cached.bodyRadius,
      wallState,
      phase: 'forming',
      elapsed: 0,
      pulseTime: 0,
      disturbElapsed: DISTURB_DURATION,
    };
  },

  update(app, physics, dt) {
    if (!state) return;

    state.elapsed += dt;
    updatePhase(dt);

    if (state.bodies.length === 0) return;

    const { stiffness, damping } = getSpringProfile();
    applyHeartSpringForces(stiffness, damping, dt);

    physics.applySeparation(
      state.bodies,
      state.packingDistance * SEPARATION_RATIO,
      state.phase === 'forming' ? SEPARATION_STRENGTH : SEPARATION_STRENGTH * 0.88
    );

    for (const body of state.bodies) {
      const velocity = Matter.Body.getVelocity(body);
      const drag = state.phase === 'forming' ? FORMING_DRAG : IDLE_DRAG;

      Matter.Body.setAngularVelocity(body, body.angularVelocity * ANGULAR_DRAG);
      Matter.Body.setVelocity(body, {
        x: velocity.x * drag,
        y: velocity.y * drag,
      });
    }
  },

  teardown() {
    if (!state) return;

    state.physics.setGravity(0, 0);
    for (const entry of state.wallState) {
      entry.wall.restitution = entry.restitution;
      entry.wall.friction = entry.friction;
    }
    state = null;
  },

  resize(app, physics, renderer, textures, sceneManager, options = {}) {
    if (!state) return;
    if (options.mode === 'preview') {
      previewHeartLayout(app);
      return;
    }
    applyHeartLayout(app);
  },

  onPointerDown(app, physics, x, y) {
    if (state) {
      state.disturbElapsed = 0;
    }
    physics.applyExplosion({ x, y }, CLICK_EXPLOSION_RADIUS, CLICK_EXPLOSION_STRENGTH);
  },
};
