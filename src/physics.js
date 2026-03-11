import Matter from 'matter-js';

const { Engine, World, Bodies, Body, Composite } = Matter;

const FIXED_DT = 1000 / 60; // 16.67ms
const WALL_THICKNESS = 100;
const MAX_FORCE = 0.05; // 단일 축 최대 힘

function clampForce(f) {
  return { x: Math.max(-MAX_FORCE, Math.min(MAX_FORCE, f.x || 0)),
           y: Math.max(-MAX_FORCE, Math.min(MAX_FORCE, f.y || 0)) };
}

function safeApplyForce(body, force) {
  const f = clampForce(force);
  if (!isFinite(f.x) || !isFinite(f.y)) return;
  Body.applyForce(body, body.position, f);
}

export class PhysicsWorld {
  constructor() {
    this.engine = Engine.create({ gravity: { x: 0, y: 0 } });
    this.world = this.engine.world;

    /** @type {Matter.Body[]} */
    this.particles = [];

    /** @type {Matter.Body[]} */
    this.walls = [];

    this._buildWalls(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', () => {
      this._rebuildWalls(window.innerWidth, window.innerHeight);
    });
  }

  // ── 벽 ──────────────────────────────────────────

  _buildWalls(w, h) {
    const t = WALL_THICKNESS;
    const opts = { isStatic: true, restitution: 0.5, friction: 0.3 };

    this.walls = [
      Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, opts),         // top
      Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opts),      // bottom
      Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, opts),         // left
      Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, opts),      // right
    ];

    Composite.add(this.world, this.walls);
  }

  _rebuildWalls(w, h) {
    Composite.remove(this.world, this.walls);
    this._buildWalls(w, h);
  }

  // ── 파티클 생성 / 제거 ──────────────────────────

  /**
   * @param {number} count
   * @param {{ from: 'top' | 'bottom' | 'edges' | 'random' }} spawnConfig
   * @returns {Matter.Body[]}
   */
  createParticles(count, spawnConfig = { from: 'random' }) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const radius = 14;
    const opts = {
      restitution: 0.5,
      friction: 0.3,
      frictionAir: 0.02,
      collisionFilter: {
        group: -1,  // 음수 그룹: 같은 그룹끼리 충돌하지 않음
      },
    };

    const bodies = [];

    for (let i = 0; i < count; i++) {
      const { x, y } = this._spawnPosition(w, h, spawnConfig.from, i, count);
      const body = Bodies.circle(x, y, radius, opts);
      body.targetPosition = null;
      bodies.push(body);
    }

    Composite.add(this.world, bodies);
    this.particles.push(...bodies);
    return bodies;
  }

  _spawnPosition(w, h, from, index, total) {
    const pad = 20; // 벽 안쪽 여백 (벽 Body와 겹치지 않도록)
    switch (from) {
      case 'top':
        return { x: pad + Math.random() * (w - pad * 2), y: pad + Math.random() * 40 };
      case 'bottom':
        return { x: pad + Math.random() * (w - pad * 2), y: h - pad - Math.random() * 40 };
      case 'edges': {
        const side = index % 4;
        if (side === 0) return { x: pad, y: pad + Math.random() * (h - pad * 2) };
        if (side === 1) return { x: w - pad, y: pad + Math.random() * (h - pad * 2) };
        if (side === 2) return { x: pad + Math.random() * (w - pad * 2), y: pad };
        return { x: pad + Math.random() * (w - pad * 2), y: h - pad };
      }
      case 'random':
      default:
        return { x: pad + Math.random() * (w - pad * 2), y: pad + Math.random() * (h - pad * 2) };
    }
  }

  /**
   * 지정된 좌표에 단일 파티클을 생성한다.
   * @param {number} x
   * @param {number} y
   * @returns {Matter.Body}
   */
  createParticleAt(x, y) {
    const body = Bodies.circle(x, y, 14, {
      restitution: 0.5,
      friction: 0.3,
      frictionAir: 0.02,
      collisionFilter: { group: -1 },
    });
    body.targetPosition = null;
    Composite.add(this.world, [body]);
    this.particles.push(body);
    return body;
  }

  clearParticles() {
    Composite.remove(this.world, this.particles);
    this.particles = [];
  }

  // ── Static barrier (보이지 않는 그릇) ─────────────

  /**
   * 좌표 배열을 따라 static circle body들을 촘촘히 배치한다.
   * @param {{ x: number, y: number }[]} points
   * @param {number} [radius=6]
   * @returns {Matter.Body[]}
   */
  createBarrier(points, radius = 6) {
    const bodies = points.map((pt) =>
      Bodies.circle(pt.x, pt.y, radius, {
        isStatic: true,
        restitution: 0.3,
        friction: 0.5,
      })
    );
    Composite.add(this.world, bodies);
    return bodies;
  }

  /**
   * barrier body 배열을 월드에서 제거한다.
   * @param {Matter.Body[]} barriers
   */
  removeBarrier(barriers) {
    Composite.remove(this.world, barriers);
  }

  // ── 중력 ────────────────────────────────────────

  setGravity(x, y) {
    this.engine.gravity.x = x;
    this.engine.gravity.y = y;
  }

  // ── 스프링 힘 ───────────────────────────────────

  /**
   * targetPosition을 향해 스프링 + 감쇠력을 적용한다.
   * @param {Matter.Body[]} bodies
   * @param {number} stiffness
   * @param {number} damping - 속도 감쇠 계수
   */
  applySpringForces(bodies, stiffness = 0.012, damping = 0.08) {
    for (const body of bodies) {
      if (!body.targetPosition) continue;
      if (!isFinite(body.position.x)) continue;

      const dx = body.targetPosition.x - body.position.x;
      const dy = body.targetPosition.y - body.position.y;
      const vel = Body.getVelocity(body);

      // 낮은 stiffness → 느린 복원, 낮은 damping → 관성 유지하며 ease-out
      Body.setVelocity(body, {
        x: vel.x * (1 - damping) + dx * stiffness,
        y: vel.y * (1 - damping) + dy * stiffness,
      });
    }
  }

  // ── 소프트 반발 (겹침 방지) ─────────────────────

  /**
   * 파티클 간 겹침을 소프트 반발력으로 방지한다.
   * @param {Matter.Body[]} bodies
   * @param {number} minDist - 이 거리 이하면 반발 (body 지름 정도)
   * @param {number} strength - 반발 세기
   */
  applySeparation(bodies, minDist = 38, strength = 3) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        let dx = b.position.x - a.position.x;
        let dy = b.position.y - a.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minDist * minDist) continue;

        const dist = Math.sqrt(distSq);
        if (dist < 0.01) {
          // 완전 겹침 → 랜덤 방향으로 밀어냄
          const angle = Math.random() * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
        } else {
          dx /= dist;
          dy /= dist;
        }

        const overlap = minDist - dist;

        // 1) 위치 직접 보정 (즉시 겹침 해소)
        const correction = overlap * 0.5;
        Body.setPosition(a, {
          x: a.position.x - dx * correction,
          y: a.position.y - dy * correction,
        });
        Body.setPosition(b, {
          x: b.position.x + dx * correction,
          y: b.position.y + dy * correction,
        });

        // 2) 속도 반발 (자연스러운 튕김)
        const push = (overlap / minDist) * strength;
        const velA = Body.getVelocity(a);
        const velB = Body.getVelocity(b);
        Body.setVelocity(a, { x: velA.x - dx * push, y: velA.y - dy * push });
        Body.setVelocity(b, { x: velB.x + dx * push, y: velB.y + dy * push });
      }
    }
  }

  // ── 폭발 반발 ──────────────────────────────────

  /**
   * @param {{ x: number, y: number }} clickPos
   * @param {number} radius
   * @param {number} strength
   */
  applyExplosion(clickPos, radius = 200, strength = 0.05) {
    for (const body of this.particles) {
      const dx = body.position.x - clickPos.x;
      const dy = body.position.y - clickPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius || dist < 1) continue;

      const factor = strength * (1 - dist / radius);
      safeApplyForce(body, {
        x: (dx / dist) * factor,
        y: (dy / dist) * factor,
      });
    }
  }

  // ── 물리 스텝 ──────────────────────────────────

  step() {
    Engine.update(this.engine, FIXED_DT);
  }
}
