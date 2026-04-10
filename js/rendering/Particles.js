import { RNG } from '../utils/RNG.js';
import { randomRange, dist } from '../utils/Math.js';

const rng = new RNG();

export class Particle {
  constructor(x, y, vx, vy, color, life, size, type) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.type = type || 'circle';
    this.alpha = 1;
    this.rotation = randomRange(0, Math.PI * 2);
    this.rotSpeed = randomRange(-3, 3);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 80 * dt;
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
    this.rotation += this.rotSpeed * dt;
    return this.life > 0;
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
  }

  emit(x, y, count, color, opts = {}) {
    const {
      speedMin = 40,
      speedMax = 150,
      lifeMin = 0.3,
      lifeMax = 0.8,
      sizeMin = 4,
      sizeMax = 10,
      type = 'square',
      angleMin = 0,
      angleMax = Math.PI * 2
    } = opts;

    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = randomRange(angleMin, angleMax);
      const speed = randomRange(speedMin, speedMax);
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        randomRange(lifeMin, lifeMax),
        randomRange(sizeMin, sizeMax),
        type
      ));
    }
  }

  emitExplosion(x, y, color, intensity = 1) {
    this.emit(x, y, Math.floor(24 * intensity), color, {
      speedMin: 80 * intensity,
      speedMax: 250 * intensity,
      sizeMin: 4,
      sizeMax: 12 * intensity,
      lifeMin: 0.3,
      lifeMax: 0.8,
      type: 'square'
    });
    this.emit(x, y, Math.floor(12 * intensity), '#ffffff', {
      speedMin: 40,
      speedMax: 150 * intensity,
      sizeMin: 2,
      sizeMax: 6,
      lifeMin: 0.2,
      lifeMax: 0.5,
      type: 'square'
    });
  }

  emitTrail(x, y, color) {
    this.emit(x, y, 2, color, {
      speedMin: 10,
      speedMax: 40,
      sizeMin: 2,
      sizeMax: 6,
      lifeMin: 0.1,
      lifeMax: 0.3,
      type: 'square'
    });
  }

  emitResource(x, y, color) {
    this.emit(x, y, 8, color, {
      speedMin: 30,
      speedMax: 100,
      sizeMin: 6,
      sizeMax: 12,
      lifeMin: 0.4,
      lifeMax: 0.8,
      type: 'square'
    });
  }

  emitCritical(x, y) {
    this.emit(x, y, 30, '#ff0040', {
      speedMin: 120,
      speedMax: 350,
      sizeMin: 6,
      sizeMax: 16,
      lifeMin: 0.3,
      lifeMax: 0.7,
      type: 'square'
    });
    this.emit(x, y, 15, '#ffffff', {
      speedMin: 60,
      speedMax: 200,
      sizeMin: 4,
      sizeMax: 8,
      lifeMin: 0.2,
      lifeMax: 0.5,
      type: 'square'
    });
  }

  emitRing(x, y, color, radius = 30) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.particles.push(new Particle(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        Math.cos(angle) * 80,
        Math.sin(angle) * 80,
        color,
        0.5,
        6,
        'square'
      ));
    }
  }

  emitScreenFlash(color, duration) {
    this.flashColor = color;
    this.flashAlpha = 0.5;
    this.flashDuration = duration || 0.15;
    this.flashTimer = this.flashDuration;
  }

  update(dt) {
    this.particles = this.particles.filter(p => p.update(dt));

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.flashAlpha = Math.max(0, (this.flashTimer / this.flashDuration) * 0.5);
    } else {
      this.flashAlpha = 0;
    }
  }

  render(ctx, canvasW, canvasH) {
    ctx.imageSmoothingEnabled = false;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.type === 'square') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      ctx.restore();
    }

    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor || '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}
