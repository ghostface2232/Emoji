import Matter from 'matter-js';
import { lerp } from '../utils/easing.js';

const PARTICLE_COUNT = 360;
const GALAXY_RADIUS_RATIO = 0.34;
const BODY_RADIUS_RATIO = 0.33;
const ENTRY_EDGE_PADDING = 28;
const ENTRY_SPEED_MIN = 6.2;
const ENTRY_SPEED_MAX = 11.4;
const ENTRY_TANGENT_JITTER = 1.2;
const FORMING_MIN_DURATION = 1.15;
const FORMING_MAX_DURATION = 2.8;
const SETTLED_ERROR_RATIO = 0.76;
const SPRING_STIFFNESS_START = 0.0042;
const SPRING_STIFFNESS_END = 0.0185;
const SPRING_RAMP_DURATION = 1.7;
const FORMING_DAMPING_START = 0.03;
const FORMING_DAMPING_END = 0.098;
const FLOW_DAMPING_MIN = 0.062;
const FLOW_DAMPING_MAX = 0.118;
const SEPARATION_RATIO = 1.04;
const SEPARATION_STRENGTH = 0.84;
const FORMING_DRAG = 0.992;
const FLOW_DRAG = 0.986;
const DISTURB_DURATION = 1.8;
const CLICK_EXPLOSION_RADIUS = 220;
const CLICK_EXPLOSION_STRENGTH = 0.048;
const BASE_ROTATION_DEG_PER_MIN = 7.2;
const DIFFERENTIAL_ROTATION_RANGE = 0.24;
const RADIAL_CORRECTION = 0.0028;
const TANGENTIAL_BLEND = 0.12;
const CORE_RATIO = 0.24;
const HALO_RATIO = 0.08;
const NOISE_AMPLITUDE_MIN = 3;
const NOISE_AMPLITUDE_MAX = 5;
const NOISE_PERIOD_MIN = 2;
const NOISE_PERIOD_MAX = 4;
const MIN_BODY_RADIUS = 8;

let state = null;
const galaxyTargetCache = new Map();

function smoothstep(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function hash01(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
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

function getGalaxyLayout(app) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const maxRadius = Math.min(sw, sh) * GALAXY_RADIUS_RATIO;

  return {
    center: {
      x: sw * 0.5,
      y: sh * 0.5,
    },
    maxRadius,
  };
}

function getLayoutCacheKey(layout) {
  return [
    Math.round(layout.center.x * 2),
    Math.round(layout.center.y * 2),
    Math.round(layout.maxRadius),
    PARTICLE_COUNT,
  ].join(':');
}

function getSpawnPosition(app, index) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const pad = ENTRY_EDGE_PADDING;
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

function applyEntryVelocity(body, spawn, center, target) {
  const toCenterX = center.x - spawn.x;
  const toCenterY = center.y - spawn.y;
  const toTargetX = target.baseX - spawn.x;
  const toTargetY = target.baseY - spawn.y;
  const dirX = toCenterX * 0.72 + toTargetX * 0.28;
  const dirY = toCenterY * 0.72 + toTargetY * 0.28;
  const dist = Math.max(Math.hypot(dirX, dirY), 1);
  const nx = dirX / dist;
  const ny = dirY / dist;
  const tx = -ny;
  const ty = nx;
  const speed = lerp(ENTRY_SPEED_MAX, ENTRY_SPEED_MIN, target.radiusNorm);
  const tangent = (Math.random() - 0.5) * ENTRY_TANGENT_JITTER * 2;

  Matter.Body.setVelocity(body, {
    x: nx * speed + tx * tangent,
    y: ny * speed + ty * tangent,
  });
}

function generateSpiralGalaxy(numPoints, centerX, centerY, maxRadius) {
  const points = [];
  const armCount = maxRadius >= 250 ? 3 : 2;
  const coreCount = Math.round(numPoints * CORE_RATIO);
  const haloCount = Math.round(numPoints * HALO_RATIO);
  const armCountTotal = Math.max(numPoints - coreCount - haloCount, 0);
  const thetaSpan = armCount === 3 ? Math.PI * 1.7 : Math.PI * 1.95;
  const a = maxRadius * 0.055;
  const b = Math.log((maxRadius * 0.98) / Math.max(a, 1)) / thetaSpan;

  for (let i = 0; i < coreCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = maxRadius * 0.18 * Math.pow(Math.random(), 1.7);
    const spread = 6 + (1 - radius / Math.max(maxRadius, 1)) * 8;
    const radialOffset = (Math.random() - 0.5) * spread;
    const tangentOffset = (Math.random() - 0.5) * spread;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    points.push({
      x: centerX + cos * (radius + radialOffset) - sin * tangentOffset,
      y: centerY + sin * (radius + radialOffset) + cos * tangentOffset,
      baseRadius: Math.max(0, radius),
      baseAngle: angle,
      kind: 'core',
    });
  }

  for (let i = 0; i < armCountTotal; i++) {
    const armIndex = i % armCount;
    const theta = thetaSpan * Math.pow(Math.random(), 1.58);
    const radius = Math.min(maxRadius, a * Math.exp(b * theta));
    const radiusNorm = radius / Math.max(maxRadius, 1);
    const armAngle = (Math.PI * 2 * armIndex) / armCount;
    const angle = armAngle + theta + (Math.random() - 0.5) * 0.14;
    const armWidth = lerp(4, maxRadius * 0.085, Math.pow(radiusNorm, 1.15));
    const radialOffset = (Math.random() - 0.5) * armWidth * 0.35;
    const tangentOffset = (Math.random() - 0.5) * armWidth;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    points.push({
      x: centerX + cos * (radius + radialOffset) - sin * tangentOffset,
      y: centerY + sin * (radius + radialOffset) + cos * tangentOffset,
      baseRadius: Math.max(0, radius),
      baseAngle: angle,
      kind: 'arm',
    });
  }

  for (let i = points.length; i < numPoints; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = lerp(maxRadius * 0.12, maxRadius * 0.9, Math.pow(Math.random(), 1.15));
    const spread = lerp(3, 10, radius / Math.max(maxRadius, 1));
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    points.push({
      x: centerX + cos * radius + (Math.random() - 0.5) * spread,
      y: centerY + sin * radius + (Math.random() - 0.5) * spread,
      baseRadius: radius,
      baseAngle: angle,
      kind: 'halo',
    });
  }

  return points;
}

function resolveGalaxyCache(app) {
  const layout = getGalaxyLayout(app);
  const cacheKey = getLayoutCacheKey(layout);
  let cached = galaxyTargetCache.get(cacheKey);

  if (!cached) {
    const rawTargets = generateSpiralGalaxy(
      PARTICLE_COUNT,
      layout.center.x,
      layout.center.y,
      layout.maxRadius
    );
    const packingDistance = measurePackingDistance(rawTargets);
    const bodyRadius = Math.max(MIN_BODY_RADIUS, packingDistance * BODY_RADIUS_RATIO);
    const fullRotationSpeed = (BASE_ROTATION_DEG_PER_MIN * Math.PI) / 180 / 60;

    const finalTargets = rawTargets.map((point) => {
      const dx = point.x - layout.center.x;
      const dy = point.y - layout.center.y;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const radiusNorm = radius / Math.max(layout.maxRadius, 1);
      const seed = hash01(point.x * 0.013, point.y * 0.017);
      const phaseSeed = hash01(point.x * 0.021, point.y * 0.031);
      const noiseSeed = hash01(point.x * 0.027, point.y * 0.041);
      const rotationScale = lerp(
        1 + DIFFERENTIAL_ROTATION_RANGE,
        1 - DIFFERENTIAL_ROTATION_RANGE * 0.9,
        smoothstep(radiusNorm)
      ) * lerp(0.96, 1.04, seed);

      return {
        baseX: point.x,
        baseY: point.y,
        baseRadius: radius,
        baseAngle: angle,
        radiusNorm,
        rotationSpeed: fullRotationSpeed * rotationScale,
        noiseAmplitude: lerp(NOISE_AMPLITUDE_MIN, NOISE_AMPLITUDE_MAX, noiseSeed),
        noiseFreqA: (Math.PI * 2) / lerp(NOISE_PERIOD_MIN, NOISE_PERIOD_MAX, phaseSeed),
        noiseFreqB: (Math.PI * 2) / lerp(NOISE_PERIOD_MIN, NOISE_PERIOD_MAX, seed),
        noisePhaseA: phaseSeed * Math.PI * 2,
        noisePhaseB: seed * Math.PI * 2,
        tangentialBias: lerp(0.8, 1.18, seed),
        kind: point.kind,
      };
    });

    cached = {
      center: layout.center,
      maxRadius: layout.maxRadius,
      packingDistance,
      bodyRadius,
      finalTargets,
    };
    galaxyTargetCache.set(cacheKey, cached);
  }

  return cached;
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

function syncGalaxyTargets() {
  for (let i = 0; i < state.runtimeTargets.length; i++) {
    const runtimeTarget = state.runtimeTargets[i];
    const base = state.finalTargets[i];
    const angle = base.baseAngle + state.flowTime * base.rotationSpeed;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tangentX = -sin;
    const tangentY = cos;
    const radialNoise = Math.sin(state.flowTime * base.noiseFreqA + base.noisePhaseA)
      * base.noiseAmplitude
      * (0.4 + base.radiusNorm * 0.6);
    const tangentialNoise = Math.cos(state.flowTime * base.noiseFreqB + base.noisePhaseB)
      * base.noiseAmplitude
      * 0.55;

    runtimeTarget.x = state.center.x
      + cos * base.baseRadius
      + cos * radialNoise
      + tangentX * tangentialNoise;
    runtimeTarget.y = state.center.y
      + sin * base.baseRadius
      + sin * radialNoise
      + tangentY * tangentialNoise;
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
    stiffness: lerp(SPRING_STIFFNESS_END * 0.66, SPRING_STIFFNESS_END, disturb),
    damping: lerp(FLOW_DAMPING_MIN, FLOW_DAMPING_MAX, disturb),
  };
}

function applyGalaxySpringForces(baseStiffness, baseDamping, dt) {
  for (const body of state.bodies) {
    if (!body.targetPosition) continue;

    body.springAge = (body.springAge || 0) + dt;
    const ageRamp = smoothstep(body.springAge / 0.7);
    const stiffness = baseStiffness * (0.34 + 0.66 * ageRamp);
    const damping = lerp(baseDamping * 0.45, baseDamping, ageRamp);
    const dx = body.targetPosition.x - body.position.x;
    const dy = body.targetPosition.y - body.position.y;
    const velocity = Matter.Body.getVelocity(body);

    let nextX = velocity.x * (1 - damping) + dx * stiffness;
    let nextY = velocity.y * (1 - damping) + dy * stiffness;

    if (state.phase === 'flow') {
      const targetMeta = body.flowTarget;
      const targetRadius = Math.hypot(
        body.targetPosition.x - state.center.x,
        body.targetPosition.y - state.center.y
      );

      if (targetMeta && targetRadius > 0.0001) {
        const radialX = (body.targetPosition.x - state.center.x) / targetRadius;
        const radialY = (body.targetPosition.y - state.center.y) / targetRadius;
        const tangentX = -radialY;
        const tangentY = radialX;
        const currentRadius = Math.hypot(
          body.position.x - state.center.x,
          body.position.y - state.center.y
        );
        const desiredTangential = targetRadius * targetMeta.rotationSpeed * targetMeta.tangentialBias;
        const tangentialVelocity = nextX * tangentX + nextY * tangentY;
        const tangentialDelta = (desiredTangential - tangentialVelocity) * TANGENTIAL_BLEND;
        const radialDelta = targetRadius - currentRadius;

        nextX += tangentX * tangentialDelta + radialX * radialDelta * RADIAL_CORRECTION;
        nextY += tangentY * tangentialDelta + radialY * radialDelta * RADIAL_CORRECTION;
      }
    }

    Matter.Body.setVelocity(body, { x: nextX, y: nextY });
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
      state.phase = 'flow';
      state.flowTime = 0;
      syncGalaxyTargets();
    }
    return;
  }

  state.flowTime += dt;
  state.disturbElapsed = Math.min(state.disturbElapsed + dt, DISTURB_DURATION);
  syncGalaxyTargets();
}

export const galaxyScene = {
  async prewarm(app) {
    resolveGalaxyCache(app);
  },

  async setup(app, physics, renderer, textures, sceneManager) {
    const cached = resolveGalaxyCache(app);
    const finalTargets = shuffleInPlace(cached.finalTargets.map((target) => ({ ...target })));
    const runtimeTargets = finalTargets.map((target) => ({
      x: target.baseX,
      y: target.baseY,
    }));
    const bodies = [];

    physics.setGravity(0, 0);

    state = {
      physics,
      sceneManager,
      center: cached.center,
      maxRadius: cached.maxRadius,
      packingDistance: cached.packingDistance,
      bodyRadius: cached.bodyRadius,
      finalTargets,
      runtimeTargets,
      bodies,
      phase: 'forming',
      elapsed: 0,
      flowTime: 0,
      disturbElapsed: DISTURB_DURATION,
    };

    for (let i = 0; i < runtimeTargets.length; i++) {
      const spawn = getSpawnPosition(app, i);
      const target = finalTargets[i];
      const body = physics.createParticleAt(spawn.x, spawn.y, {
        radius: cached.bodyRadius,
        restitution: 0.42,
        friction: 0.04,
        frictionAir: 0.014,
        collisionGroup: -1,
        lockRotation: true,
      });

      body.targetPosition = runtimeTargets[i];
      body.flowTarget = target;
      body.springAge = 0;
      applyEntryVelocity(body, spawn, cached.center, target);

      sceneManager.addSprite(body, textures.get(app, '⭐', 32));
      bodies.push(body);
    }
  },

  update(app, physics, dt) {
    if (!state) return;

    state.elapsed += dt;
    updatePhase(dt);

    if (state.bodies.length === 0) return;

    const { stiffness, damping } = getSpringProfile();
    applyGalaxySpringForces(stiffness, damping, dt);

    physics.applySeparation(
      state.bodies,
      state.packingDistance * SEPARATION_RATIO,
      state.phase === 'forming' ? SEPARATION_STRENGTH : SEPARATION_STRENGTH * 0.8
    );

    for (const body of state.bodies) {
      const velocity = Matter.Body.getVelocity(body);
      const drag = state.phase === 'forming' ? FORMING_DRAG : FLOW_DRAG;

      Matter.Body.setVelocity(body, {
        x: velocity.x * drag,
        y: velocity.y * drag,
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
    physics.applyExplosion({ x, y }, CLICK_EXPLOSION_RADIUS, CLICK_EXPLOSION_STRENGTH);
  },
};
