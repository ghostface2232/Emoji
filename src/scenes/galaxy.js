import Matter from 'matter-js';
import { samplePackedPointsFromFill } from '../utils/svgSampler.js';
import { lerp } from '../utils/easing.js';

const GALAXY_PATH =
  'M56.939 19.953C69.501 16.9764 90.212 22.0233 100.005 30.652C92.755 12.812 73.146 0 50.032 0C29.598 0 12.18 12.824 8.934 30.27C5.6254 48.012 17.8988 67.102 43.133 71.618C30.555 74.5946 9.778 69.536 0 60.864C7.2031 78.782 26.855 91.669 50.027 91.669L51.3122 91.6573C71.4292 91.2432 88.3202 78.4543 91.4492 61.2663C94.6914 43.4543 82.3086 24.4893 56.9332 19.9573L56.939 19.953ZM61.107 51.801C57.9429 55.0119 50.396 54.9455 44.267 51.6526C38.1225 48.3518 35.7436 43.0784 38.9076 39.8636C42.0717 36.6527 49.6066 36.7191 55.7556 40.0159C61.8767 43.3167 64.279 48.5862 61.1111 51.8009L61.107 51.801Z';

const SVG_WIDTH = 100.005;
const SVG_HEIGHT = 91.669;

const PARTICLE_COUNT = 400;
const SHAPE_SCALE = 0.74;
const SHAPE_OFFSET_Y = -0.01;
const BODY_RADIUS_RATIO = 0.28;
const ENTRY_EDGE_PADDING = 26;
const ENTRY_SPEED_MIN = 15;
const ENTRY_SPEED_MAX = 26;
const ENTRY_TANGENT_JITTER = 1.8;
const FORMING_MIN_DURATION = 1.5;
const FORMING_MAX_DURATION = 3.0;
const SETTLED_ERROR_RATIO = 0.62;
const SPRING_STIFFNESS_START = 0.008;
const SPRING_STIFFNESS_END = 0.034;
const SPRING_RAMP_DURATION = 1.5;
const FORMING_DAMPING_START = 0.02;
const FORMING_DAMPING_END = 0.11;
const IDLE_DAMPING_MIN = 0.09;
const IDLE_DAMPING_MAX = 0.16;
const SEPARATION_RATIO = 0.82;
const SEPARATION_STRENGTH = 0.6;
const FORMING_DRAG = 0.996;
const IDLE_DRAG = 0.984;
const ANGULAR_DRAG = 0.994;
const DISTURB_DURATION = 1.6;
const CLICK_EXPLOSION_RADIUS = 240;
const CLICK_EXPLOSION_STRENGTH = 0.05;
const WALL_RESTITUTION = 0.85;
const WALL_FRICTION = 0.05;

// --- 회전 흐름 파라미터 ---
const BASE_ROTATION_SPEED = 0.15; // rad/s
const DIFFERENTIAL_FACTOR = -0.08;
const NOISE_AMPLITUDE = 0.00002;

// --- 펄스 파라미터 (heart의 1/10 강도) ---
const PULSE_AMPLITUDE = 1.0; // heart: 3.6
const PULSE_SPEED_RATIO = 6; // 회전 주기당 6번 펄스
const PULSE_SCATTER_STRENGTH = 0.35; // 펄스 확장 시 방사형 산란 속도

// --- 배경 별 파라미터 ---
const BG_STAR_COUNT = 60;
const BG_STAR_SIZE = 14;
const BG_STAR_ALPHA_MIN = 0.4;
const BG_STAR_ALPHA_MAX = 0.75;
const BG_TWINKLE_SPEED_MIN = 0.4;
const BG_TWINKLE_SPEED_MAX = 1.2;

// --- 별똥별 파라미터 ---
const SHOOTING_STAR_INTERVAL_MIN = 1.0;
const SHOOTING_STAR_INTERVAL_MAX = 2.0;
const SHOOTING_STAR_SPEED = 600;
const SHOOTING_STAR_LIFETIME_MIN = 0.5;
const SHOOTING_STAR_LIFETIME_MAX = 1.4;
const SHOOTING_STAR_ANGLE_SPREAD = 0.3; // rad 범위 내 랜덤 방향 변동

let state = null;
const galaxyTargetCache = new Map();

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

function getGalaxyBounds(app) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const size = Math.min(sw, sh) * SHAPE_SCALE;
  const aspect = SVG_WIDTH / SVG_HEIGHT;
  const width = size * aspect;
  const height = size;
  return {
    x: (sw - width) * 0.5,
    y: (sh - height) * 0.5 + height * SHAPE_OFFSET_Y,
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

function resolveGalaxyCache(bounds) {
  const cacheKey = getLayoutCacheKey(bounds);
  let cached = galaxyTargetCache.get(cacheKey);

  if (!cached) {
    const sampledTargets = samplePackedPointsFromFill(GALAXY_PATH, PARTICLE_COUNT, bounds, {
      jitterRatio: 0.06,
      edgeInsetRatio: 0.03,
      relaxIterations: 14,
      spacingScale: 0.92,
      rowOffsetJitter: 0.08,
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
      const distFromCenter = Math.hypot(dx, dy);
      return {
        baseX: point.x,
        baseY: point.y,
        distFromCenter,
        dirX: distFromCenter > 0.001 ? dx / distFromCenter : 0,
        dirY: distFromCenter > 0.001 ? dy / distFromCenter : -1,
        distNorm: distFromCenter / maxRadius,
      };
    });

    cached = {
      center: { x: centerX, y: centerY },
      maxRadius,
      packingDistance,
      bodyRadius,
      finalTargets,
    };
    galaxyTargetCache.set(cacheKey, cached);
  }

  return cached;
}

function applyGalaxyLayout(app) {
  const bounds = getGalaxyBounds(app);
  const cached = resolveGalaxyCache(bounds);

  state.bounds = bounds;
  state.center = cached.center;
  state.maxRadius = cached.maxRadius;
  state.packingDistance = cached.packingDistance;
  state.bodyRadius = cached.bodyRadius;

  for (let i = 0; i < cached.finalTargets.length; i++) {
    const next = cached.finalTargets[i];

    if (state.finalTargets[i]) {
      state.finalTargets[i].baseX = next.baseX;
      state.finalTargets[i].baseY = next.baseY;
      state.finalTargets[i].distFromCenter = next.distFromCenter;
      state.finalTargets[i].dirX = next.dirX;
      state.finalTargets[i].dirY = next.dirY;
      state.finalTargets[i].distNorm = next.distNorm;
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

  if (state.phase === 'rotating') {
    syncRotationTargets();
  }
}

function remapPoint(point, fromBounds, toBounds) {
  point.x = toBounds.x + ((point.x - fromBounds.x) / Math.max(fromBounds.width, 1)) * toBounds.width;
  point.y = toBounds.y + ((point.y - fromBounds.y) / Math.max(fromBounds.height, 1)) * toBounds.height;
}

function previewGalaxyLayout(app) {
  const previousBounds = state.bounds;
  const bounds = getGalaxyBounds(app);
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
  state.maxRadius *= scaleX;
  state.packingDistance *= scaleX;
  state.bodyRadius *= scaleX;

  if (state.phase === 'rotating') {
    syncRotationTargets();
  }
}

function createBackgroundStars(app, renderer, textures) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const tex = textures.get(app, '⭐', BG_STAR_SIZE);
  const stars = [];

  for (let i = 0; i < BG_STAR_COUNT; i++) {
    const sprite = renderer.createSprite(tex);
    sprite.x = Math.random() * sw;
    sprite.y = Math.random() * sh;
    sprite.scale.set(0.6 + Math.random() * 0.4);
    const baseAlpha = BG_STAR_ALPHA_MIN + Math.random() * (BG_STAR_ALPHA_MAX - BG_STAR_ALPHA_MIN);
    sprite.alpha = baseAlpha;

    stars.push({
      sprite,
      baseAlpha,
      twinkleSpeed: BG_TWINKLE_SPEED_MIN + Math.random() * (BG_TWINKLE_SPEED_MAX - BG_TWINKLE_SPEED_MIN),
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }

  return stars;
}

function removeBackgroundStars(renderer) {
  if (!state || !state.bgStars) return;
  for (const star of state.bgStars) {
    renderer.removeSprite(star.sprite);
  }
}

function updateBackgroundStars(time) {
  if (!state || !state.bgStars) return;
  for (const star of state.bgStars) {
    const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    star.sprite.alpha = star.baseAlpha * (0.6 + 0.4 * twinkle);
  }
}

function scheduleNextShootingStar() {
  state.nextShootingStarAt = state.time +
    SHOOTING_STAR_INTERVAL_MIN +
    Math.random() * (SHOOTING_STAR_INTERVAL_MAX - SHOOTING_STAR_INTERVAL_MIN);
}

function spawnShootingStar(app, renderer, textures) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const tex = textures.get(app, '⭐', 32);
  const sprite = renderer.createSprite(tex);

  // 오른쪽 위 영역에서 출발
  sprite.x = sw * (0.5 + Math.random() * 0.5);
  sprite.y = -10;
  sprite.alpha = 1;

  // 왼쪽 아래 방향 + 약간의 랜덤 변동
  const baseAngle = Math.PI * 0.75; // 좌하 135도
  const angle = baseAngle + (Math.random() - 0.5) * SHOOTING_STAR_ANGLE_SPREAD;
  sprite.rotation = angle + Math.PI * 0.5;

  state.shootingStars.push({
    sprite,
    vx: Math.cos(angle) * SHOOTING_STAR_SPEED,
    vy: Math.sin(angle) * SHOOTING_STAR_SPEED,
    age: 0,
    lifetime: SHOOTING_STAR_LIFETIME_MIN + Math.random() * (SHOOTING_STAR_LIFETIME_MAX - SHOOTING_STAR_LIFETIME_MIN),
  });

  scheduleNextShootingStar();
}

function updateShootingStars(dt, renderer) {
  for (let i = state.shootingStars.length - 1; i >= 0; i--) {
    const star = state.shootingStars[i];
    star.age += dt;
    star.sprite.x += star.vx * dt;
    star.sprite.y += star.vy * dt;

    // fade in 빠르게, fade out 부드럽게
    const t = star.age / star.lifetime;
    if (t < 0.1) {
      star.sprite.alpha = t / 0.1;
    } else {
      star.sprite.alpha = Math.max(0, 1 - (t - 0.1) / 0.9);
    }

    if (star.age >= star.lifetime) {
      renderer.removeSprite(star.sprite);
      state.shootingStars.splice(i, 1);
    }
  }
}

function getSpawnPosition(app, index) {
  const pad = ENTRY_EDGE_PADDING;
  const sw = app.screen.width;
  const sh = app.screen.height;
  const side = index % 4;

  if (side === 0) return { x: pad + Math.random() * Math.max(sw - pad * 2, 1), y: pad };
  if (side === 1) return { x: sw - pad, y: pad + Math.random() * Math.max(sh - pad * 2, 1) };
  if (side === 2) return { x: pad + Math.random() * Math.max(sw - pad * 2, 1), y: sh - pad };
  return { x: pad, y: pad + Math.random() * Math.max(sh - pad * 2, 1) };
}

function applyEntryVelocity(body, spawn, target, distFromCenter, maxRadius) {
  const dx = target.x - spawn.x;
  const dy = target.y - spawn.y;
  const dist = Math.max(Math.hypot(dx, dy), 1);
  const nx = dx / dist;
  const ny = dy / dist;
  const tx = -ny;
  const ty = nx;

  // 중심 근처 파티클에 더 강한 impulse → 핵이 먼저 응축
  const proximityBoost = 1 + (1 - Math.min(distFromCenter / maxRadius, 1)) * 1.5;
  const speed = lerp(ENTRY_SPEED_MIN, ENTRY_SPEED_MAX, Math.random()) * proximityBoost;
  const tangent = (Math.random() - 0.5) * ENTRY_TANGENT_JITTER * 2;

  Matter.Body.setVelocity(body, {
    x: nx * speed + tx * tangent,
    y: ny * speed + ty * tangent,
  });
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

function applyGalaxySpringForces(baseStiffness, baseDamping, dt) {
  for (const body of state.bodies) {
    if (!body.targetPosition) continue;

    body.springAge = (body.springAge || 0) + dt;
    const ageRamp = smoothstep(body.springAge / 0.72);
    const stiffness = baseStiffness * (0.32 + 0.68 * ageRamp);
    const damping = lerp(baseDamping * 0.5, baseDamping, ageRamp);
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
  if (state.phase === 'forming') {
    if (state.elapsed < FORMING_MIN_DURATION) return;

    const averageError = getAverageTargetError();
    if (
      averageError <= state.packingDistance * SETTLED_ERROR_RATIO ||
      state.elapsed >= FORMING_MAX_DURATION
    ) {
      state.phase = 'rotating';
    }
    return;
  }

  // rotating phase
  state.disturbElapsed = Math.min(state.disturbElapsed + dt, DISTURB_DURATION);
}

function syncRotationTargets() {
  state.totalAngle += (state.phase === 'rotating' ? BASE_ROTATION_SPEED : 0) * state.lastDt;

  // 회전 주기(2π / BASE_ROTATION_SPEED)당 PULSE_SPEED_RATIO번 펄스
  const pulsePhase = state.totalAngle * PULSE_SPEED_RATIO;
  const pulseValue = state.phase === 'rotating'
    ? Math.sin(pulsePhase) * PULSE_AMPLITUDE * state.packingDistance
    : 0;

  // 펄스 미분 (확장 구간: cos > 0 일 때 팽창 중)
  state.pulseDerivative = state.phase === 'rotating'
    ? Math.cos(pulsePhase) * PULSE_SPEED_RATIO * BASE_ROTATION_SPEED
    : 0;

  for (let i = 0; i < state.runtimeTargets.length; i++) {
    const base = state.finalTargets[i];
    const target = state.runtimeTargets[i];

    if (state.phase === 'rotating') {
      // 차등 회전: 안쪽은 빠르게, 바깥쪽은 느리게
      const particleAngle = state.totalAngle * (1 - DIFFERENTIAL_FACTOR * (base.distFromCenter / state.maxRadius));
      const cosA = Math.cos(particleAngle);
      const sinA = Math.sin(particleAngle);
      const dx = base.baseX - state.center.x;
      const dy = base.baseY - state.center.y;

      // 펄스: 중심부 거의 고정, 외곽이 더 크게 팽창/수축
      const radialWeight = Math.pow(base.distNorm, 1.5);
      const pulseOffset = pulseValue * radialWeight;

      target.x = state.center.x + dx * cosA - dy * sinA + base.dirX * pulseOffset;
      target.y = state.center.y + dx * sinA + dy * cosA + base.dirY * pulseOffset;
    } else {
      target.x = base.baseX;
      target.y = base.baseY;
    }
  }
}

export const galaxyScene = {
  async prewarm(app) {
    const bounds = getGalaxyBounds(app);
    resolveGalaxyCache(bounds);
  },

  async setup(app, physics, renderer, textures, sceneManager) {
    const bounds = getGalaxyBounds(app);
    const cached = resolveGalaxyCache(bounds);
    const tex = textures.get(app, '⭐', 32);
    const finalTargets = cached.finalTargets.map((t) => ({ ...t }));
    const runtimeTargets = finalTargets.map((t) => ({
      x: t.baseX,
      y: t.baseY,
    }));
    const spawnTargets = runtimeTargets.slice();
    const bodies = [];
    const noiseParams = [];

    physics.setGravity(0, 0);

    const bgStars = createBackgroundStars(app, renderer, textures);

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
        frictionAir: 0.02,
        collisionGroup: 0,
        lockRotation: false,
      });

      body.targetPosition = spawnTargets[i];
      body.springAge = 0;
      Matter.Body.setAngle(body, Math.random() * Math.PI * 2);
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.42);
      applyEntryVelocity(
        body, spawn, spawnTargets[i],
        finalTargets[i].distFromCenter, cached.maxRadius
      );

      sceneManager.addSprite(body, tex);
      bodies.push(body);

      noiseParams.push({
        freq: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }

    state = {
      physics,
      sceneManager,
      renderer,
      bounds,
      finalTargets,
      runtimeTargets,
      bodies,
      noiseParams,
      bgStars,
      center: cached.center,
      maxRadius: cached.maxRadius,
      packingDistance: cached.packingDistance,
      bodyRadius: cached.bodyRadius,
      wallState,
      phase: 'forming',
      elapsed: 0,
      totalAngle: 0,
      time: 0,
      lastDt: 0,
      disturbElapsed: DISTURB_DURATION,
      shootingStars: [],
      nextShootingStarAt: 2 + Math.random(),
      textures,
    };
  },

  update(app, physics, dt) {
    if (!state) return;

    state.elapsed += dt;
    state.time += dt;
    state.lastDt = dt;
    updatePhase(dt);
    syncRotationTargets();
    updateBackgroundStars(state.time);

    // 별똥별
    if (state.time >= state.nextShootingStarAt) {
      spawnShootingStar(app, state.renderer, state.textures);
    }
    updateShootingStars(dt, state.renderer);

    if (state.bodies.length === 0) return;

    const { stiffness, damping } = getSpringProfile();
    applyGalaxySpringForces(stiffness, damping, dt);

    physics.applySeparation(
      state.bodies,
      state.packingDistance * SEPARATION_RATIO,
      state.phase === 'forming' ? SEPARATION_STRENGTH : SEPARATION_STRENGTH * 0.88
    );

    // 난류 힘 + 펄스 산란 (rotating 단계)
    if (state.phase === 'rotating') {
      // 펄스가 팽창 중일 때만 산란 (derivative > 0)
      const scatterDrive = Math.max(0, state.pulseDerivative) * PULSE_SCATTER_STRENGTH;

      for (let i = 0; i < state.bodies.length; i++) {
        const body = state.bodies[i];
        const noise = state.noiseParams[i];
        const base = state.finalTargets[i];

        // 난류
        let fx = NOISE_AMPLITUDE * Math.sin(state.time * noise.freq + noise.phase);
        let fy = NOISE_AMPLITUDE * Math.cos(state.time * noise.freq * 1.3 + noise.phase);

        // 펄스 산란: 팽창 시 방사형으로 밀어내기
        if (scatterDrive > 0) {
          const radialWeight = Math.pow(base.distNorm, 1.5);
          const velocity = Matter.Body.getVelocity(body);
          Matter.Body.setVelocity(body, {
            x: velocity.x + base.dirX * scatterDrive * radialWeight,
            y: velocity.y + base.dirY * scatterDrive * radialWeight,
          });
        }

        Matter.Body.applyForce(body, body.position, { x: fx, y: fy });
      }
    }

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
    removeBackgroundStars(state.renderer);
    for (const star of state.shootingStars) {
      state.renderer.removeSprite(star.sprite);
    }
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
      previewGalaxyLayout(app);
      return;
    }
    applyGalaxyLayout(app);
  },

  onPointerDown(app, physics, x, y) {
    if (state) {
      if (state.phase === 'forming') {
        state.phase = 'rotating';
      }
      state.disturbElapsed = 0;
    }
    physics.applyExplosion({ x, y }, CLICK_EXPLOSION_RADIUS, CLICK_EXPLOSION_STRENGTH);
  },
};
