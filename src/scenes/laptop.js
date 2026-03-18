import Matter from 'matter-js';
import { LAPTOP_PATH, samplePackedPointsFromFill } from '../utils/svgSampler.js';
import { lerp } from '../utils/easing.js';

const PARTICLE_COUNT = 400;
const LOADER_ICON_COUNT = 5;
const LOADER_TARGET_OVERSAMPLE = 80;
const LOADER_ROTATION_SPEED = 1.2;
const BASE_FORM_DURATION = 2.45;
const FORM_DURATION_VARIATION = 0.15;
const SEGMENT_COUNT_MIN = 4;
const SEGMENT_COUNT_MAX = 7;
const SNAP_PORTION = 0.23;
const ENTRY_OFFSCREEN = 30;
const ENTRY_STAGE_DEPTH = 78;
const ENTRY_SPREAD_PADDING = 36;
const VIEWPORT_PADDING = 8;
const BODY_RADIUS_RATIO = 0.36;
const SPRING_STIFFNESS = 0.019;
const SPRING_DAMPING = 0.18;
const RECOVER_STIFFNESS_MIN = 0.01;
const RECOVER_STIFFNESS_MAX = 0.022;
const RECOVER_DAMPING_MIN = 0.08;
const RECOVER_DAMPING_MAX = 0.18;
const RECOVER_DURATION = 1.35;
const SETTLED_SEPARATION_RATIO = 1.02;
const SETTLED_SEPARATION_STRENGTH = 0.68;
const DRAG = 0.972;
const CLICK_EXPLOSION_RADIUS = 235;
const CLICK_EXPLOSION_STRENGTH = 0.05;
const BOUNDS_WIDTH = 0.76;
const BOUNDS_HEIGHT = 0.54;
const SVG_ASPECT = 109.418 / 84.5;

let state = null;
const laptopTargetCache = new Map();

function smoothstep(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
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

function getLaptopBounds(app) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const maxWidth = sw * BOUNDS_WIDTH;
  const maxHeight = sh * BOUNDS_HEIGHT;
  const width = Math.min(maxWidth, maxHeight * SVG_ASPECT);
  const height = width / SVG_ASPECT;

  return {
    x: (sw - width) * 0.5,
    y: (sh - height) * 0.5,
    width,
    height,
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

function resolveLaptopCache(bounds) {
  const cacheKey = getLayoutCacheKey(bounds);
  let cached = laptopTargetCache.get(cacheKey);

  if (!cached) {
    const laptopTargetCount = PARTICLE_COUNT - LOADER_ICON_COUNT;
    const candidateTargets = samplePackedPointsFromFill(
      LAPTOP_PATH,
      laptopTargetCount + LOADER_TARGET_OVERSAMPLE,
      bounds,
      {
      jitterRatio: 0.02,
      edgeInsetRatio: 0.05,
      relaxIterations: 18,
      spacingScale: 0.90,
      rowOffsetJitter: 0.02,
      }
    ).map((point) => ({
      x: point.x,
      y: point.y,
    }));

    const candidateSpacing = measurePackingDistance(candidateTargets);
    const loaderTargets = createLoaderTargets(bounds, candidateSpacing);
    const loaderCenter = getLoaderCenter(bounds);
    const exclusionRadius = Math.max(candidateSpacing * 2.45, bounds.height * 0.055);
    const laptopTargets = candidateTargets
      .filter((point) => Math.hypot(point.x - loaderCenter.x, point.y - loaderCenter.y) > exclusionRadius)
      .slice(0, laptopTargetCount)
      .map((point) => ({
        x: point.x,
        y: point.y,
        isLoader: false,
      }));
    if (laptopTargets.length < laptopTargetCount) {
      for (const point of candidateTargets) {
        if (laptopTargets.length >= laptopTargetCount) break;
        if (!laptopTargets.some((target) => target.x === point.x && target.y === point.y)) {
          laptopTargets.push({
            x: point.x,
            y: point.y,
            isLoader: false,
          });
        }
      }
    }
    const finalTargets = laptopTargets.concat(loaderTargets);

    const packingDistance = measurePackingDistance(finalTargets);
    const bodyRadius = Math.max(8.5, packingDistance * BODY_RADIUS_RATIO);

    cached = {
      finalTargets,
      packingDistance,
      bodyRadius,
    };
    laptopTargetCache.set(cacheKey, cached);
  }

  return cached;
}

function applyLaptopLayout(app) {
  const bounds = getLaptopBounds(app);
  const cached = resolveLaptopCache(bounds);
  let interruptedRouting = false;

  state.bounds = bounds;
  state.packingDistance = cached.packingDistance;
  state.bodyRadius = cached.bodyRadius;
  state.loaderCenter = getLoaderCenter(bounds);

  for (let i = 0; i < cached.finalTargets.length; i++) {
    const next = cached.finalTargets[i];

    if (state.finalTargets[i]) {
      state.finalTargets[i].x = next.x;
      state.finalTargets[i].y = next.y;
      state.finalTargets[i].isLoader = next.isLoader;
      state.finalTargets[i].loaderAngle = next.loaderAngle;
      state.finalTargets[i].loaderRadius = next.loaderRadius;
    } else {
      state.finalTargets.push({ ...next });
    }

    if (state.runtimeTargets[i]) {
      state.runtimeTargets[i].x = next.x;
      state.runtimeTargets[i].y = next.y;
    } else {
      state.runtimeTargets.push({
        x: next.x,
        y: next.y,
      });
    }

    if (state.motions[i] && state.motions[i].mode === 'path') {
      state.motions[i].mode = 'spring';
      interruptedRouting = true;
    }

    if (state.bodies[i]) {
      state.bodies[i].targetPosition = state.runtimeTargets[i];
      state.bodies[i].collisionFilter.group = 0;
      state.bodies[i].collisionFilter.mask = -1;
    }
  }

  state.finalTargets.length = cached.finalTargets.length;
  state.runtimeTargets.length = cached.finalTargets.length;

  if (state.phase === 'routing' || interruptedRouting) {
    state.phase = 'recover';
    state.recoverElapsed = 0;
  }

  if (state.phase !== 'routing') {
    syncLoaderTargets(0);
  }
}

function remapPoint(point, fromBounds, toBounds) {
  point.x = toBounds.x + ((point.x - fromBounds.x) / Math.max(fromBounds.width, 1)) * toBounds.width;
  point.y = toBounds.y + ((point.y - fromBounds.y) / Math.max(fromBounds.height, 1)) * toBounds.height;
}

function previewLaptopLayout(app) {
  const previousBounds = state.bounds;
  const bounds = getLaptopBounds(app);
  const scaleX = bounds.width / Math.max(previousBounds.width, 1);
  let interruptedRouting = false;

  for (let i = 0; i < state.finalTargets.length; i++) {
    const target = state.finalTargets[i];
    remapPoint(target, previousBounds, bounds);
    if (target.isLoader) {
      target.loaderRadius *= scaleX;
    }

    state.runtimeTargets[i].x = target.x;
    state.runtimeTargets[i].y = target.y;

    if (state.motions[i] && state.motions[i].mode === 'path') {
      state.motions[i].mode = 'spring';
      interruptedRouting = true;
    }

    if (state.bodies[i]) {
      const mapped = { x: state.bodies[i].position.x, y: state.bodies[i].position.y };
      remapPoint(mapped, previousBounds, bounds);
      Matter.Body.setPosition(state.bodies[i], mapped);
      Matter.Body.setVelocity(state.bodies[i], { x: 0, y: 0 });
      state.bodies[i].targetPosition = state.runtimeTargets[i];
      state.bodies[i].collisionFilter.group = 0;
      state.bodies[i].collisionFilter.mask = -1;
    }
  }

  state.bounds = bounds;
  state.loaderCenter = getLoaderCenter(bounds);
  state.packingDistance *= scaleX;
  state.bodyRadius *= scaleX;

  if (state.phase === 'routing' || interruptedRouting) {
    state.phase = 'recover';
    state.recoverElapsed = 0;
  }

  syncLoaderTargets(0);
}

function getLoaderCenter(bounds) {
  return {
    x: bounds.x + bounds.width * 0.5,
    y: bounds.y + bounds.height * 0.37,
  };
}

function createLoaderTargets(bounds, spacing) {
  const center = getLoaderCenter(bounds);
  const radius = Math.max(spacing * 1.55, bounds.height * 0.026);
  const targets = [];

  for (let i = 0; i < LOADER_ICON_COUNT; i++) {
    const angle = -Math.PI * 0.5 + (Math.PI * 2 * i) / LOADER_ICON_COUNT;
    targets.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      isLoader: true,
      loaderAngle: angle,
      loaderRadius: radius,
    });
  }

  return targets;
}

function getEdgeSpawnData(app, index) {
  const pad = ENTRY_SPREAD_PADDING;
  const sw = app.screen.width;
  const sh = app.screen.height;
  const side = index % 4;

  if (side === 0) {
    const laneX = pad + Math.random() * Math.max(sw - pad * 2, 1);
    return {
      start: {
        x: laneX,
        y: -ENTRY_OFFSCREEN,
      },
      stage: {
        x: laneX,
        y: ENTRY_STAGE_DEPTH,
      },
    };
  }

  if (side === 1) {
    const laneY = pad + Math.random() * Math.max(sh - pad * 2, 1);
    return {
      start: {
        x: sw + ENTRY_OFFSCREEN,
        y: laneY,
      },
      stage: {
        x: sw - ENTRY_STAGE_DEPTH,
        y: laneY,
      },
    };
  }

  if (side === 2) {
    const laneX = pad + Math.random() * Math.max(sw - pad * 2, 1);
    return {
      start: {
        x: laneX,
        y: sh + ENTRY_OFFSCREEN,
      },
      stage: {
        x: laneX,
        y: sh - ENTRY_STAGE_DEPTH,
      },
    };
  }

  const laneY = pad + Math.random() * Math.max(sh - pad * 2, 1);
  return {
    start: {
      x: -ENTRY_OFFSCREEN,
      y: laneY,
    },
    stage: {
      x: ENTRY_STAGE_DEPTH,
      y: laneY,
    },
  };
}

function createDistanceParts(total, count) {
  if (count <= 0) return [];
  if (count === 1) return [total];

  const weights = [];
  let totalWeight = 0;

  for (let i = 0; i < count; i++) {
    const weight = 0.65 + Math.random() * 0.7;
    weights.push(weight);
    totalWeight += weight;
  }

  const parts = [];
  let remaining = total;
  let remainingWeight = totalWeight;

  for (let i = 0; i < count - 1; i++) {
    const part = total * (weights[i] / remainingWeight);
    parts.push(part);
    remaining -= part;
    remainingWeight -= weights[i];
  }

  parts.push(Math.max(remaining, 0));
  return parts;
}

function chooseStartAxis(dxAbs, dyAbs) {
  if (dxAbs === 0) return 'y';
  if (dyAbs === 0) return 'x';

  const dominantAxis = dxAbs >= dyAbs ? 'x' : 'y';
  return Math.random() < 0.68 ? dominantAxis : (dominantAxis === 'x' ? 'y' : 'x');
}

export function generateOrthogonalPath(startPos, endPos) {
  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const dxAbs = Math.abs(dx);
  const dyAbs = Math.abs(dy);
  const segmentCount = SEGMENT_COUNT_MIN + Math.floor(Math.random() * (SEGMENT_COUNT_MAX - SEGMENT_COUNT_MIN + 1));
  const startAxis = chooseStartAxis(dxAbs, dyAbs);

  let xCount = startAxis === 'x' ? Math.ceil(segmentCount / 2) : Math.floor(segmentCount / 2);
  let yCount = segmentCount - xCount;

  if (dxAbs < 0.001) {
    yCount = segmentCount;
    xCount = 0;
  } else if (dyAbs < 0.001) {
    xCount = segmentCount;
    yCount = 0;
  }

  const xParts = createDistanceParts(dxAbs, xCount);
  const yParts = createDistanceParts(dyAbs, yCount);
  const xSign = Math.sign(dx) || 1;
  const ySign = Math.sign(dy) || 1;
  const waypoints = [];

  let xIndex = 0;
  let yIndex = 0;
  let currentX = startPos.x;
  let currentY = startPos.y;
  let axis = startAxis;

  for (let i = 0; i < segmentCount; i++) {
    if (axis === 'x' && xIndex < xParts.length) {
      currentX += xParts[xIndex++] * xSign;
    } else if (axis === 'y' && yIndex < yParts.length) {
      currentY += yParts[yIndex++] * ySign;
    }

    waypoints.push({ x: currentX, y: currentY });

    if (axis === 'x' && yIndex < yParts.length) axis = 'y';
    else if (axis === 'y' && xIndex < xParts.length) axis = 'x';
  }

  if (waypoints.length === 0 || waypoints[waypoints.length - 1].x !== endPos.x || waypoints[waypoints.length - 1].y !== endPos.y) {
    waypoints.push({ x: endPos.x, y: endPos.y });
  }

  return waypoints;
}

function appendOrthogonalWaypoint(list, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > 0.001 && Math.abs(dy) > 0.001) {
    list.push({ x: to.x, y: from.y });
  }

  if (
    list.length === 0 ||
    Math.abs(list[list.length - 1].x - to.x) > 0.001 ||
    Math.abs(list[list.length - 1].y - to.y) > 0.001
  ) {
    list.push({ x: to.x, y: to.y });
  }
}

function createMotionPlan(startPos, stagePos, endPos) {
  const rawWaypoints = [];
  if (Math.abs(stagePos.x - startPos.x) > 0.001 || Math.abs(stagePos.y - startPos.y) > 0.001) {
    rawWaypoints.push({ x: stagePos.x, y: stagePos.y });
  }
  rawWaypoints.push(...generateOrthogonalPath(stagePos, endPos));
  const waypoints = [];
  let previous = { x: startPos.x, y: startPos.y };

  for (const waypoint of rawWaypoints) {
    appendOrthogonalWaypoint(waypoints, previous, waypoint);
    previous = waypoint;
  }

  const segments = [];
  previous = { x: startPos.x, y: startPos.y };
  let totalLength = 0;

  for (const waypoint of waypoints) {
    const dx = waypoint.x - previous.x;
    const dy = waypoint.y - previous.y;
    const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    const length = Math.abs(axis === 'x' ? dx : dy);

    if (length > 0.001) {
      segments.push({
        axis,
        startX: previous.x,
        startY: previous.y,
        endX: waypoint.x,
        endY: waypoint.y,
        length,
        sign: Math.sign(axis === 'x' ? dx : dy) || 1,
      });
      totalLength += length;
    }

    previous = waypoint;
  }

  const durationScale = 1 + (Math.random() * 2 - 1) * FORM_DURATION_VARIATION;
  const duration = BASE_FORM_DURATION * durationScale;
  const speed = totalLength / Math.max(duration, 0.001);

  return {
    waypoints,
    segments,
    segmentIndex: 0,
    speed,
    mode: 'path',
  };
}

function finalizeSegment(body, motion, segment) {
  Matter.Body.setPosition(body, { x: segment.endX, y: segment.endY });
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  motion.segmentIndex++;
  if (motion.segmentIndex >= motion.segments.length) {
    motion.mode = 'spring';
    body.collisionFilter.group = 0;
    body.collisionFilter.mask = -1;
  }
}

function executePathSegment(body, motion, dt) {
  const segment = motion.segments[motion.segmentIndex];
  if (!segment) {
    motion.mode = 'spring';
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    return;
  }

  const axis = segment.axis;
  const currentPos = body.position;
  const remaining = axis === 'x'
    ? segment.endX - currentPos.x
    : segment.endY - currentPos.y;
  const absRemaining = Math.abs(remaining);

  if (axis === 'x' && Math.abs(currentPos.y - segment.startY) > 0.001) {
    Matter.Body.setPosition(body, { x: currentPos.x, y: segment.startY });
  } else if (axis === 'y' && Math.abs(currentPos.x - segment.startX) > 0.001) {
    Matter.Body.setPosition(body, { x: segment.startX, y: currentPos.y });
  }

  if (absRemaining <= 0.8) {
    finalizeSegment(body, motion, segment);
    return;
  }

  const isLastSegment = motion.segmentIndex === motion.segments.length - 1;
  const progress = 1 - absRemaining / Math.max(segment.length, 1);
  const snapThreshold = 1 - SNAP_PORTION;
  let desiredStep = motion.speed * dt;

  if (isLastSegment && progress >= snapThreshold) {
    const snapT = (progress - snapThreshold) / Math.max(SNAP_PORTION, 0.0001);
    desiredStep = lerp(desiredStep, absRemaining, smoothstep(snapT));
  }

  const step = Math.min(absRemaining, desiredStep);
  const velocity = { x: 0, y: 0 };
  velocity[axis] = segment.sign * step;
  Matter.Body.setVelocity(body, velocity);

  if (absRemaining <= Math.max(motion.speed * dt, 1.4)) {
    finalizeSegment(body, motion, segment);
  }
}

function executeOrthogonalMotion(dt) {
  let activeCount = 0;

  for (let i = 0; i < state.bodies.length; i++) {
    const body = state.bodies[i];
    const motion = state.motions[i];
    if (!motion || motion.mode !== 'path') continue;

    activeCount++;
    executePathSegment(body, motion, dt);
  }

  return activeCount;
}

function getSpringBodies() {
  const springBodies = [];

  for (let i = 0; i < state.bodies.length; i++) {
    const motion = state.motions[i];
    if (motion && motion.mode === 'path') continue;
    springBodies.push(state.bodies[i]);
  }

  return springBodies;
}

function syncLoaderTargets(dt) {
  state.loaderRotation += dt * LOADER_ROTATION_SPEED;

  for (let i = 0; i < state.runtimeTargets.length; i++) {
    const base = state.finalTargets[i];
    if (!base.isLoader) continue;

    const angle = base.loaderAngle + state.loaderRotation;
    state.runtimeTargets[i].x = state.loaderCenter.x + Math.cos(angle) * base.loaderRadius;
    state.runtimeTargets[i].y = state.loaderCenter.y + Math.sin(angle) * base.loaderRadius;
  }
}

function getSpringProfile() {
  if (state.phase === 'recover') {
    const recoverT = Math.min(state.recoverElapsed / RECOVER_DURATION, 1);
    return {
      stiffness: lerp(RECOVER_STIFFNESS_MIN, RECOVER_STIFFNESS_MAX, smoothstep(recoverT)),
      damping: lerp(RECOVER_DAMPING_MIN, RECOVER_DAMPING_MAX, smoothstep(recoverT)),
    };
  }

  return {
    stiffness: SPRING_STIFFNESS,
    damping: SPRING_DAMPING,
  };
}

function applyLaptopSpringForces(stiffness, damping) {
  for (let i = 0; i < state.bodies.length; i++) {
    const body = state.bodies[i];
    const motion = state.motions[i];
    if (motion && motion.mode === 'path') continue;

    const target = state.runtimeTargets[i];
    body.targetPosition = target;
    const dx = target.x - body.position.x;
    const dy = target.y - body.position.y;
    const velocity = Matter.Body.getVelocity(body);

    Matter.Body.setVelocity(body, {
      x: velocity.x * (1 - damping) + dx * stiffness,
      y: velocity.y * (1 - damping) + dy * stiffness,
    });
  }
}

function constrainBodiesToViewport(app) {
  const minX = VIEWPORT_PADDING + state.bodyRadius;
  const maxX = app.screen.width - VIEWPORT_PADDING - state.bodyRadius;
  const minY = VIEWPORT_PADDING + state.bodyRadius;
  const maxY = app.screen.height - VIEWPORT_PADDING - state.bodyRadius;

  for (let i = 0; i < state.bodies.length; i++) {
    const motion = state.motions[i];
    if (motion && motion.mode === 'path') continue;
    const body = state.bodies[i];
    const outX = body.position.x < minX || body.position.x > maxX;
    const outY = body.position.y < minY || body.position.y > maxY;
    const clampedX = Math.max(minX, Math.min(maxX, body.position.x));
    const clampedY = Math.max(minY, Math.min(maxY, body.position.y));

    if (outX || outY) {
      const velocity = Matter.Body.getVelocity(body);
      Matter.Body.setPosition(body, { x: clampedX, y: clampedY });
      Matter.Body.setVelocity(body, {
        x: outX ? 0 : velocity.x * 0.35,
        y: outY ? 0 : velocity.y * 0.35,
      });
    }
  }
}

export const laptopScene = {
  async prewarm(app) {
    const bounds = getLaptopBounds(app);
    resolveLaptopCache(bounds);
  },

  async setup(app, physics, renderer, textures, sceneManager) {
    const bounds = getLaptopBounds(app);
    const cached = resolveLaptopCache(bounds);
    const assignedTargets = shuffleInPlace(cached.finalTargets.map((target) => ({ ...target })));
    const runtimeTargets = assignedTargets.map((target) => ({
      x: target.x,
      y: target.y,
    }));
    const tex = textures.get(app, '💻', 32);
    const motions = [];
    const bodies = [];

    physics.setGravity(0, 0);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const spawn = getEdgeSpawnData(app, i);
      const startPos = spawn.start;
      const stagePos = spawn.stage;
      const endPos = assignedTargets[i];
      const body = physics.createParticleAt(startPos.x, startPos.y, {
        radius: cached.bodyRadius,
        restitution: 0,
        friction: 0,
        frictionAir: 0.02,
        collisionGroup: 0,
        lockRotation: true,
      });

      body.collisionFilter.mask = 0;
      body.targetPosition = runtimeTargets[i];
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      motions.push(createMotionPlan(startPos, stagePos, endPos));
      bodies.push(body);
      sceneManager.addSprite(body, tex);
    }

    state = {
      physics,
      sceneManager,
      bounds,
      finalTargets: assignedTargets,
      runtimeTargets,
      motions,
      bodies,
      packingDistance: cached.packingDistance,
      bodyRadius: cached.bodyRadius,
      loaderCenter: getLoaderCenter(bounds),
      loaderRotation: 0,
      phase: 'routing',
      recoverElapsed: RECOVER_DURATION,
    };
  },

  update(app, physics, dt) {
    if (!state) return;

    const activePaths = executeOrthogonalMotion(dt);

    if (activePaths === 0 && state.phase === 'routing') {
      state.phase = 'settled';
    }

    if (state.phase === 'recover') {
      state.recoverElapsed = Math.min(state.recoverElapsed + dt, RECOVER_DURATION);
      if (state.recoverElapsed >= RECOVER_DURATION) {
        state.phase = 'settled';
      }
    }

    if (state.phase !== 'routing') {
      syncLoaderTargets(dt);
    }

    const { stiffness, damping } = getSpringProfile();
    applyLaptopSpringForces(stiffness, damping);

    const springBodies = getSpringBodies();
    if (springBodies.length > 1) {
      physics.applySeparation(
        springBodies,
        state.packingDistance * SETTLED_SEPARATION_RATIO,
        SETTLED_SEPARATION_STRENGTH
      );
    }

    for (let i = 0; i < state.bodies.length; i++) {
      const motion = state.motions[i];
      if (motion && motion.mode === 'path') continue;

      const body = state.bodies[i];
      const velocity = Matter.Body.getVelocity(body);
      Matter.Body.setVelocity(body, {
        x: velocity.x * DRAG,
        y: velocity.y * DRAG,
      });
    }

    if (state.phase !== 'recover') {
      constrainBodiesToViewport(app);
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
      previewLaptopLayout(app);
      return;
    }
    applyLaptopLayout(app);
  },

  onPointerDown(app, physics, x, y) {
    if (!state) return;

    for (const motion of state.motions) {
      motion.mode = 'spring';
    }
    for (const body of state.bodies) {
      body.collisionFilter.group = 0;
      body.collisionFilter.mask = -1;
    }

    state.phase = 'recover';
    state.recoverElapsed = 0;
    physics.applyExplosion({ x, y }, CLICK_EXPLOSION_RADIUS, CLICK_EXPLOSION_STRENGTH);
  },
};
