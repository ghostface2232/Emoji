import Matter from 'matter-js';
import { samplePointsFromFill, samplePackedPointsFromFill } from '../utils/svgSampler.js';
import { easeInOutQuad, easeOutCubic, lerp } from '../utils/easing.js';

const EYES_SHAPE_PATH =
  'M66.7305 0C79.4648 0 89.7881 15.4508 89.7881 34.5098C89.7879 53.5685 79.4647 69.0186 66.7305 69.0186C56.5924 69.0186 47.9829 59.226 44.8936 45.6162C41.8041 59.2259 33.1956 69.0186 23.0576 69.0186C10.3234 69.0186 0.000176327 53.5685 0 34.5098C0 15.4508 10.3232 0 23.0576 0C33.1954 0 41.8039 9.79216 44.8936 23.4014C47.9831 9.79205 56.5927 0 66.7305 0ZM23.2354 22.752C15.8588 22.7521 9.87891 30.1016 9.87891 39.167C9.87912 48.2322 15.8589 55.5809 23.2354 55.5811C30.6119 55.5811 36.5916 48.2323 36.5918 39.167C36.5918 30.1015 30.612 22.752 23.2354 22.752ZM66.9805 22.752C59.6039 22.7521 53.624 30.1016 53.624 39.167C53.6242 48.2322 59.604 55.5809 66.9805 55.5811C74.357 55.5811 80.3367 48.2323 80.3369 39.167C80.3369 30.1015 74.3571 22.752 66.9805 22.752Z';

const PARTICLE_COUNT = 600;
const SPAWN_DURATION = 1.02;
const SETTLE_DURATION = 1.3;
const SPAWN_SPRING_ATTACK = 0.8;
const MAX_STIFFNESS = 0.042;
const MAX_DAMPING = 0.16;
const BODY_RADIUS_RATIO = 0.34;
const SEPARATION_RATIO = 1.0;
const SEPARATION_STRENGTH = 1.04;
const ACTIVE_DRAG = 0.998;
const IDLE_DRAG = 0.987;
const ANGULAR_DRAG = 0.992;
const SPAWN_X_SPREAD = 20;
const SPAWN_Y_MIN = 20;
const SPAWN_Y_MAX = 72;
const BASE_LOOK_PERIOD = 3.5;
const LOOK_AMPLITUDE_RATIO = 0.05;
const BREATH_AMPLITUDE = 0.01;
const BREATH_SPEED = 0.5;
const QUICK_GLANCE_MIN = 7;
const QUICK_GLANCE_MAX = 10;
const QUICK_GLANCE_OUT = 0.22;
const QUICK_GLANCE_HOLD = 0.16;
const QUICK_GLANCE_RETURN = 0.72;
const CLICK_EXPLOSION_RADIUS = 230;
const CLICK_EXPLOSION_STRENGTH = 0.038;
const DISTURB_DURATION = 1.7;
const FILL_OVERSAMPLE_RATIO = 1.45;
const CONTAINMENT_DISTANCE_RATIO = 0.92;
const CONTAINMENT_BOOST = 1.85;
const PATH_SWAY_PARALLAX_X = 0.16;
const PATH_SWAY_PARALLAX_Y = 0.08;
const INNER_SWAY_X = 0.2;
const INNER_SWAY_Y = 0.12;
const INNER_SWAY_SPEED = 1.05;
const MOTION_STRETCH_X = 0.08;
const MOTION_SQUASH_Y = 0.03;
const ELLIPSE_PARALLAX_EXTRA = 0.7;
const ELLIPSE_INFLUENCE_RADIUS = 0.6;
const ELLIPSE_FILL_RADIUS = 2.0;
const ELLIPSE_FILL_STRENGTH = 0.35;

const SVG_WIDTH = 89.7881;
const SVG_HEIGHT = 69.0186;
const INNER_ELLIPSES = [
  { cx: 23.2354 / SVG_WIDTH, cy: 39.167 / SVG_HEIGHT, rx: 13.357 / SVG_WIDTH, ry: 16.415 / SVG_HEIGHT },
  { cx: 66.9805 / SVG_WIDTH, cy: 39.167 / SVG_HEIGHT, rx: 13.357 / SVG_WIDTH, ry: 16.415 / SVG_HEIGHT },
];

let state = null;
const eyesTargetCache = new Map();

function smoothstep(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function ellipseInfluence(normX, normY) {
  let maxInfluence = 0;
  for (const e of INNER_ELLIPSES) {
    const dx = (normX - e.cx) / e.rx;
    const dy = (normY - e.cy) / e.ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 1) continue;
    const influence = Math.max(0, 1 - (dist - 1) / ELLIPSE_INFLUENCE_RADIUS);
    if (influence > maxInfluence) maxInfluence = influence;
  }
  return maxInfluence;
}

function ellipseFillFactor(normX, normY) {
  let maxFactor = 0;
  for (const e of INNER_ELLIPSES) {
    const dx = (normX - e.cx) / e.rx;
    const dy = (normY - e.cy) / e.ry;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 1) { maxFactor = 1; continue; }
    const factor = Math.max(0, 1 - (dist - 1) / ELLIPSE_FILL_RADIUS);
    if (factor > maxFactor) maxFactor = factor;
  }
  return maxFactor;
}

function getEyeLayout(app) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const eyeWidth = Math.min(sw * 0.66, sh * 0.47 * 1.3);
  const eyeHeight = eyeWidth / 1.3;
  const centerY = sh * 0.44;

  return {
    eye: {
      x: sw * 0.5 - eyeWidth * 0.5,
      y: centerY - eyeHeight * 0.5,
      width: eyeWidth,
      height: eyeHeight,
    },
    maxOffset: sw * LOOK_AMPLITUDE_RATIO,
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

function resolveEyesCache(bounds) {
  const cacheKey = getLayoutCacheKey(bounds);
  let cached = eyesTargetCache.get(cacheKey);

  if (!cached) {
    const sampledTargets = sampleEyeTargets(bounds, PARTICLE_COUNT, 0);
    const packingDistance = measurePackingDistance(sampledTargets.map((target) => ({
      x: target.baseX,
      y: target.baseY,
    })));
    const bodyRadius = Math.max(9.25, packingDistance * BODY_RADIUS_RATIO);

    cached = {
      finalTargets: sampledTargets.map((target) => ({
        baseX: target.baseX,
        baseY: target.baseY,
        x: target.baseX,
        y: target.baseY,
        eyeIndex: target.eyeIndex,
      })),
      packingDistance,
      bodyRadius,
    };
    eyesTargetCache.set(cacheKey, cached);
  }

  return cached;
}

function applyEyesLayout(app) {
  const layout = getEyeLayout(app);
  const cached = resolveEyesCache(layout.eye);

  state.eyeBounds = layout.eye;
  state.maxOffset = layout.maxOffset;
  state.packingDistance = cached.packingDistance;
  state.bodyRadius = cached.bodyRadius;
  state.totalCount = cached.finalTargets.length;

  for (let i = 0; i < cached.finalTargets.length; i++) {
    const next = cached.finalTargets[i];
    const normX = (next.baseX - layout.eye.x) / layout.eye.width;
    const normY = (next.baseY - layout.eye.y) / layout.eye.height;

    if (state.finalTargets[i]) {
      state.finalTargets[i].baseX = next.baseX;
      state.finalTargets[i].baseY = next.baseY;
      state.finalTargets[i].x = next.baseX;
      state.finalTargets[i].y = next.baseY;
      state.finalTargets[i].eyeIndex = next.eyeIndex;
    } else {
      state.finalTargets.push({
        baseX: next.baseX,
        baseY: next.baseY,
        x: next.baseX,
        y: next.baseY,
        eyeIndex: next.eyeIndex,
      });
    }

    if (state.runtimeTargets[i]) {
      state.runtimeTargets[i].x = next.baseX;
      state.runtimeTargets[i].y = next.baseY;
      state.runtimeTargets[i].eyeIndex = next.eyeIndex;
      state.runtimeTargets[i].ellipseInfluence = ellipseInfluence(normX, normY);
      state.runtimeTargets[i].fillFactor = ellipseFillFactor(normX, normY);
    } else {
      state.runtimeTargets.push({
        x: next.baseX,
        y: next.baseY,
        eyeIndex: next.eyeIndex,
        ellipseInfluence: ellipseInfluence(normX, normY),
        fillFactor: ellipseFillFactor(normX, normY),
      });
    }
  }

  state.finalTargets.length = cached.finalTargets.length;
  state.runtimeTargets.length = cached.finalTargets.length;
  state.eyeCenters = computeEyeCenters(state.finalTargets);

  if (state.phase === 'idle') {
    syncIdleTargets();
  }

  for (let i = 0; i < state.bodies.length; i++) {
    state.bodies[i].targetPosition = state.runtimeTargets[i];
  }
}

function remapPoint(point, fromBounds, toBounds) {
  point.x = toBounds.x + ((point.x - fromBounds.x) / Math.max(fromBounds.width, 1)) * toBounds.width;
  point.y = toBounds.y + ((point.y - fromBounds.y) / Math.max(fromBounds.height, 1)) * toBounds.height;
}

function previewEyesLayout(app) {
  const previousBounds = state.eyeBounds;
  const layout = getEyeLayout(app);
  const scaleX = layout.eye.width / Math.max(previousBounds.width, 1);

  for (const target of state.finalTargets) {
    remapPoint(target, previousBounds, layout.eye);
    target.baseX = target.x;
    target.baseY = target.y;
  }

  for (const target of state.runtimeTargets) {
    remapPoint(target, previousBounds, layout.eye);
  }

  for (const center of state.eyeCenters) {
    remapPoint(center, previousBounds, layout.eye);
  }

  for (const body of state.bodies) {
    const mapped = { x: body.position.x, y: body.position.y };
    remapPoint(mapped, previousBounds, layout.eye);
    Matter.Body.setPosition(body, mapped);
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
  }

  state.eyeBounds = layout.eye;
  state.maxOffset *= scaleX;
  state.glanceOffset *= scaleX;
  state.lastLookOffset *= scaleX;
  state.packingDistance *= scaleX;
  state.bodyRadius *= scaleX;
}

function selectEvenSubset(points, count) {
  if (points.length <= count) return points.slice();

  const remaining = points.slice();
  const selected = [];
  let seedIndex = 0;
  let bestSeedScore = Infinity;
  let sumX = 0;
  let sumY = 0;

  for (const point of remaining) {
    sumX += point.x;
    sumY += point.y;
  }

  const centerX = sumX / Math.max(remaining.length, 1);
  const centerY = sumY / Math.max(remaining.length, 1);

  for (let i = 0; i < remaining.length; i++) {
    const dx = remaining[i].x - centerX;
    const dy = remaining[i].y - centerY;
    const score = dx * dx + dy * dy;
    if (score < bestSeedScore) {
      bestSeedScore = score;
      seedIndex = i;
    }
  }

  selected.push(remaining.splice(seedIndex, 1)[0]);

  while (selected.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      let nearestSq = Infinity;

      for (const chosen of selected) {
        const dx = remaining[i].x - chosen.x;
        const dy = remaining[i].y - chosen.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestSq) nearestSq = distSq;
      }

      if (nearestSq > bestDistance) {
        bestDistance = nearestSq;
        bestIndex = i;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

function sampleEyeTargets(bounds, count, eyeIndex) {
  const minDistCandidates = [2.2, 1.9, 1.6, 1.3, 1.0, 0.7, 0.4];
  const oversampleCount = Math.ceil(count * FILL_OVERSAMPLE_RATIO);

  for (const minDist of minDistCandidates) {
    const points = samplePointsFromFill(EYES_SHAPE_PATH, oversampleCount, bounds, {
      minDist,
      inset: 0.12,
      densityBias: 0,
    });

    if (points.length >= oversampleCount * 0.82) {
      return selectEvenSubset(points, count).map((point) => ({
        baseX: point.x,
        baseY: point.y,
        x: point.x,
        y: point.y,
        eyeIndex,
      }));
    }
  }

  const packedFallback = samplePackedPointsFromFill(EYES_SHAPE_PATH, count, bounds, {
    jitterRatio: 0.16,
    edgeInsetRatio: 0.02,
    relaxIterations: 6,
    spacingScale: 0.86,
    rowOffsetJitter: 0.14,
  });

  return packedFallback.slice(0, count).map((point) => ({
    baseX: point.x,
    baseY: point.y,
    x: point.x,
    y: point.y,
    eyeIndex,
  }));
}

function computeEyeCenters(targets) {
  const sums = [{ x: 0, y: 0, count: 0 }];

  for (const target of targets) {
    const bucket = sums[0];
    bucket.x += target.baseX;
    bucket.y += target.baseY;
    bucket.count++;
  }

  return sums.map((bucket) => ({
    x: bucket.x / Math.max(bucket.count, 1),
    y: bucket.y / Math.max(bucket.count, 1),
  }));
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

function getSpringProfile() {
  if (state.phase === 'spawning') {
    const progress = Math.min(state.elapsed / SPAWN_DURATION, 1);
    return {
      stiffness: lerp(MAX_STIFFNESS * 0.38, MAX_STIFFNESS * 0.88, smoothstep(progress)),
      damping: lerp(MAX_DAMPING * 0.32, MAX_DAMPING * 0.72, smoothstep(progress)),
    };
  }

  if (state.phase === 'settling') {
    const progress = Math.min(state.settleElapsed / SETTLE_DURATION, 1);
    return {
      stiffness: lerp(MAX_STIFFNESS * 0.86, MAX_STIFFNESS, smoothstep(progress)),
      damping: lerp(MAX_DAMPING * 0.72, MAX_DAMPING * 0.92, smoothstep(progress)),
    };
  }

  const disturb = Math.min(state.disturbElapsed / DISTURB_DURATION, 1);
  return {
    stiffness: lerp(MAX_STIFFNESS * 0.24, MAX_STIFFNESS * 0.52, disturb),
    damping: lerp(MAX_DAMPING * 0.46, MAX_DAMPING * 0.72, disturb),
  };
}

function applyEyeSpringForces(baseStiffness, baseDamping, dt) {
  for (const body of state.bodies) {
    if (!body.targetPosition) continue;

    body.springAge = (body.springAge || 0) + dt;
    const ageRamp = smoothstep(body.springAge / SPAWN_SPRING_ATTACK);
    const stiffness = baseStiffness * (0.28 + 0.72 * ageRamp);
    const damping = lerp(baseDamping * 0.6, baseDamping, ageRamp);
    const dx = body.targetPosition.x - body.position.x;
    const dy = body.targetPosition.y - body.position.y;
    const targetDist = Math.hypot(dx, dy);
    const containmentStart = state.packingDistance * CONTAINMENT_DISTANCE_RATIO;
    const containmentT = Math.max(0, Math.min(
      1,
      (targetDist - containmentStart) / Math.max(state.packingDistance * 1.5, 1)
    ));
    const containmentBoost = lerp(1, CONTAINMENT_BOOST, containmentT);
    const velocity = Matter.Body.getVelocity(body);

    Matter.Body.setVelocity(body, {
      x: velocity.x * (1 - damping) + dx * stiffness * containmentBoost,
      y: velocity.y * (1 - damping) + dy * stiffness * containmentBoost,
    });
  }
}

function scheduleNextGlance() {
  state.nextGlanceAt = state.idleTime + QUICK_GLANCE_MIN + Math.random() * (QUICK_GLANCE_MAX - QUICK_GLANCE_MIN);
}

function startQuickGlance() {
  const direction = Math.sin((state.idleTime / BASE_LOOK_PERIOD) * Math.PI * 2) >= 0 ? -1 : 1;
  state.glance = {
    phase: 'out',
    elapsed: 0,
    from: state.glanceOffset,
    to: direction * state.maxOffset * 0.95,
  };
}

function updateQuickGlance(dt) {
  if (!state.glance) {
    if (state.idleTime >= state.nextGlanceAt) {
      startQuickGlance();
    }
    return;
  }

  const glance = state.glance;
  glance.elapsed += dt;

  if (glance.phase === 'out') {
    const t = Math.min(glance.elapsed / QUICK_GLANCE_OUT, 1);
    state.glanceOffset = lerp(glance.from, glance.to, easeOutCubic(t));
    if (t >= 1) {
      glance.phase = 'hold';
      glance.elapsed = 0;
    }
    return;
  }

  if (glance.phase === 'hold') {
    state.glanceOffset = glance.to;
    if (glance.elapsed >= QUICK_GLANCE_HOLD) {
      glance.phase = 'return';
      glance.elapsed = 0;
    }
    return;
  }

  const t = Math.min(glance.elapsed / QUICK_GLANCE_RETURN, 1);
  state.glanceOffset = lerp(glance.to, 0, easeInOutQuad(t));
  if (t >= 1) {
    state.glance = null;
    state.glanceOffset = 0;
    scheduleNextGlance();
  }
}

function syncIdleTargets() {
  updateQuickGlance(state.lastDt);

  const lookWave = Math.sin((state.idleTime / BASE_LOOK_PERIOD) * Math.PI * 2);
  const sharedLookOffset = lookWave * state.maxOffset + state.glanceOffset;
  const lookVelocity =
    (sharedLookOffset - state.lastLookOffset) / Math.max(state.lastDt, 1 / 120);
  const sharedScale = 1 + Math.sin(state.idleTime * BREATH_SPEED) * BREATH_AMPLITUDE;
  const swayDrive = state.maxOffset > 0 ? sharedLookOffset / state.maxOffset : 0;
  const motionDrive = Math.max(
    -1,
    Math.min(1, lookVelocity / Math.max(state.maxOffset * 3.2, 1))
  );
  const swayTime = state.idleTime * INNER_SWAY_SPEED;
  const halfWidth = Math.max(state.eyeBounds.width * 0.5, 1);
  const halfHeight = Math.max(state.eyeBounds.height * 0.5, 1);

  for (let i = 0; i < state.runtimeTargets.length; i++) {
    const target = state.runtimeTargets[i];
    const base = state.finalTargets[i];
    const eyeCenter = state.eyeCenters[0];
    const relativeX = base.baseX - eyeCenter.x;
    const relativeY = base.baseY - eyeCenter.y;
    const normalizedX = (base.baseX - eyeCenter.x) / halfWidth;
    const normalizedY = (base.baseY - eyeCenter.y) / halfHeight;
    const directionalScaleX =
      1 + motionDrive * -normalizedX * MOTION_STRETCH_X;
    const directionalScaleY =
      1 - Math.abs(motionDrive) * MOTION_SQUASH_Y * (1 - Math.abs(normalizedY) * 0.35);
    const localSwayX =
      normalizedX * swayDrive * state.packingDistance * PATH_SWAY_PARALLAX_X +
      Math.sin(swayTime + normalizedX * 2.1 + normalizedY * 1.4) *
        state.packingDistance * INNER_SWAY_X;
    const localSwayY =
      -normalizedY * Math.abs(swayDrive) * state.packingDistance * PATH_SWAY_PARALLAX_Y +
      Math.cos(swayTime * 0.9 + normalizedX * 1.7 - normalizedY * 1.2) *
        state.packingDistance * INNER_SWAY_Y;

    const ellipseExtra = target.ellipseInfluence * sharedLookOffset * ELLIPSE_PARALLAX_EXTRA;
    const fillExtra = target.fillFactor * (1 - target.ellipseInfluence) * sharedLookOffset * ELLIPSE_FILL_STRENGTH;
    target.x =
      eyeCenter.x +
      relativeX * sharedScale * directionalScaleX +
      sharedLookOffset +
      ellipseExtra +
      fillExtra +
      localSwayX;
    target.y =
      eyeCenter.y +
      relativeY * sharedScale * directionalScaleY +
      localSwayY;
  }

  state.lastLookOffset = sharedLookOffset;
}

function updatePhase(app, dt) {
  if (state.phase === 'spawning') {
    const progress = Math.min(state.elapsed / SPAWN_DURATION, 1);
    const targetCount = Math.floor(progress * state.totalCount);

    while (state.spawned < targetCount) {
      const runtimeTarget = state.runtimeTargets[state.spawned];
      const x = runtimeTarget.x + (Math.random() - 0.5) * SPAWN_X_SPREAD;
      const y = app.screen.height + SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
      const body = state.physics.createParticleAt(x, y, {
        radius: state.bodyRadius,
        restitution: 0.08,
        friction: 0.08,
        frictionAir: 0.024,
        collisionGroup: 0,
        lockRotation: false,
      });

      body.targetPosition = runtimeTarget;
      body.springAge = 0;
      Matter.Body.setAngle(body, Math.random() * Math.PI * 2);
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.18);
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 0.35,
        y: -(3 + Math.random() * 1.2),
      });

      state.sceneManager.addSprite(body, state.tex);
      state.bodies.push(body);
      state.spawned++;
    }

    if (state.spawned >= state.totalCount) {
      state.phase = 'settling';
      state.settleElapsed = 0;
    }

    return;
  }

  if (state.phase === 'settling') {
    state.settleElapsed += dt;
    if (state.settleElapsed >= SETTLE_DURATION) {
      state.phase = 'idle';
      state.idleTime = 0;
      state.glance = null;
      state.glanceOffset = 0;
      state.lastLookOffset = 0;
      scheduleNextGlance();
    }
    return;
  }

  state.idleTime += dt;
  syncIdleTargets();
}

export const eyesScene = {
  async prewarm(app) {
    const layout = getEyeLayout(app);
    resolveEyesCache(layout.eye);
  },

  async setup(app, physics, renderer, textures, sceneManager) {
    const layout = getEyeLayout(app);
    const cached = resolveEyesCache(layout.eye);
    const finalTargets = cached.finalTargets.map((target) => ({ ...target }));
    const runtimeTargets = finalTargets.map((target) => {
      const normX = (target.baseX - layout.eye.x) / layout.eye.width;
      const normY = (target.baseY - layout.eye.y) / layout.eye.height;
      const ei = ellipseInfluence(normX, normY);
      return {
        x: target.baseX,
        y: target.baseY,
        eyeIndex: target.eyeIndex,
        ellipseInfluence: ei,
        fillFactor: ellipseFillFactor(normX, normY),
      };
    });
    const { packingDistance, bodyRadius } = cached;

    physics.setGravity(0, 0);

    state = {
      physics,
      sceneManager,
      tex: textures.get(app, '\uD83D\uDC40', 32),
      eyeBounds: layout.eye,
      finalTargets,
      runtimeTargets,
      eyeCenters: computeEyeCenters(finalTargets),
      maxOffset: layout.maxOffset,
      bodyRadius,
      packingDistance,
      totalCount: finalTargets.length,
      bodies: [],
      phase: 'spawning',
      elapsed: 0,
      settleElapsed: 0,
      idleTime: 0,
      glance: null,
      glanceOffset: 0,
      nextGlanceAt: QUICK_GLANCE_MIN,
      disturbElapsed: DISTURB_DURATION,
      spawned: 0,
      lastDt: 0,
      lastLookOffset: 0,
    };
  },

  update(app, physics, dt) {
    if (!state) return;

    state.elapsed += dt;
    state.lastDt = dt;
    updatePhase(app, dt);

    if (state.bodies.length === 0) return;

    const { stiffness, damping } = getSpringProfile();
    applyEyeSpringForces(stiffness, damping, dt);

    const separationStrength = state.phase === 'idle'
      ? SEPARATION_STRENGTH * 0.74
      : SEPARATION_STRENGTH;
    physics.applySeparation(
      state.bodies,
      state.packingDistance * SEPARATION_RATIO,
      separationStrength
    );

    if (state.phase === 'idle') {
      state.disturbElapsed = Math.min(state.disturbElapsed + dt, DISTURB_DURATION);
    }

    for (const body of state.bodies) {
      const velocity = Matter.Body.getVelocity(body);
      const drag = state.phase === 'idle' ? IDLE_DRAG : ACTIVE_DRAG;
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
    state = null;
  },

  resize(app, physics, renderer, textures, sceneManager, options = {}) {
    if (!state) return;
    if (options.mode === 'preview') {
      previewEyesLayout(app);
      return;
    }
    applyEyesLayout(app);
  },

  onPointerDown(app, physics, x, y) {
    if (state) {
      state.disturbElapsed = 0;
    }
    physics.applyExplosion({ x, y }, CLICK_EXPLOSION_RADIUS, CLICK_EXPLOSION_STRENGTH);
  },
};
