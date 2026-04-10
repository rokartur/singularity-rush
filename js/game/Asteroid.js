import { RNG } from '../utils/RNG.js';
import { randomRange, dist } from '../utils/Math.js';

const rng = new RNG();

export class Asteroid {
  constructor(x, y, radius, hp, resources, color) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.hp = hp;
    this.maxHp = hp;
    this.resources = resources;
    this.color = color;
    this.alive = true;
    this.hitFlash = 0;
    this.vx = randomRange(-15, 15);
    this.vy = randomRange(-15, 15);
    this.rotation = randomRange(0, Math.PI * 2);
    this.rotSpeed = randomRange(-0.5, 0.5);
    this.vertices = this._generateVertices();
    this.crackLevel = 0;
    this.spawnAnim = 1.0;
  }

  _generateVertices() {
    const count = rng.nextInt(7, 12);
    const verts = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = this.radius * randomRange(0.7, 1.0);
      verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.2;
    this.crackLevel = 1 - (this.hp / this.maxHp);
    if (this.hp <= 0) {
      this.alive = false;
    }
    return !this.alive;
  }

  update(dt, canvasW, canvasH) {
    if (this.spawnAnim > 0) {
      this.spawnAnim -= dt * 3;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotSpeed * dt;

    if (this.hitFlash > 0) this.hitFlash -= dt;

    const margin = this.radius + 20;
    if (this.x < margin) { this.x = margin; this.vx *= -0.5; }
    if (this.x > canvasW - margin) { this.x = canvasW - margin; this.vx *= -0.5; }
    if (this.y < margin) { this.y = margin; this.vy *= -0.5; }
    if (this.y > canvasH - margin) { this.y = canvasH - margin; this.vy *= -0.5; }
  }

  containsPoint(px, py) {
    return dist(this.x, this.y, px, py) <= this.radius;
  }

  render(ctx) {
    ctx.imageSmoothingEnabled = false;
    const scale = this.spawnAnim > 0 ? 1 - this.spawnAnim : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let i = 1; i < this.vertices.length; i++) {
      ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
    }
    ctx.closePath();

    if (this.hitFlash > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = this.color;
    }
    ctx.fill();

    ctx.strokeStyle = this.hitFlash > 0 ? '#ffffff' : this._lighten(this.color, 30);
    ctx.lineWidth = 3;
    ctx.stroke();

    if (this.crackLevel > 0.1) {
      this._renderCracks(ctx);
    }

    if (this.hp < this.maxHp) {
      ctx.rotate(-this.rotation);
      this._renderHPBar(ctx);
    }

    ctx.restore();
  }

  _renderCracks(ctx) {
    ctx.strokeStyle = `rgba(0,0,0,${Math.min(this.crackLevel * 0.8, 0.7)})`;
    ctx.lineWidth = 1;
    const count = Math.floor(this.crackLevel * 5) + 1;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const len = this.radius * this.crackLevel * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.stroke();
    }
  }

  _renderHPBar(ctx) {
    const barW = this.radius * 1.6;
    const barH = 6;
    const barY = -this.radius - 12;
    const pct = this.hp / this.maxHp;

    ctx.fillStyle = '#333';
    ctx.fillRect(-barW / 2, barY, barW, barH);

    const color = pct > 0.5 ? '#50c878' : pct > 0.25 ? '#f0c040' : '#fe5f55';
    ctx.fillStyle = color;
    ctx.fillRect(-barW / 2, barY, barW * pct, barH);
  }

  _lighten(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return `rgb(${r},${g},${b})`;
  }
}

export class AsteroidManager {
  constructor() {
    this.asteroids = [];
    this.spawnTimer = 0;
    this.galaxyData = null;
  }

  setGalaxy(data) {
    this.galaxyData = data;
    this.asteroids = [];
    this.spawnTimer = 0;
  }

  update(dt, canvasW, canvasH, maxAsteroids) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.asteroids.length < (maxAsteroids || 6) && this.galaxyData) {
      this._spawn(canvasW, canvasH);
      this.spawnTimer = this.galaxyData.asteroidSpawnRate;
    }

    for (const a of this.asteroids) {
      a.update(dt, canvasW, canvasH);
    }

    this.asteroids = this.asteroids.filter(a => a.alive);
  }

  _spawn(canvasW, canvasH) {
    const data = this.galaxyData;
    const tier = Math.floor(this.asteroids.length / 3);
    const hp = Math.floor(data.asteroidHP.base * Math.pow(data.asteroidHP.scale, tier));
    const radius = randomRange(20, 50);
    const res = data.resources;

    const asteroid = new Asteroid(
      randomRange(60, canvasW - 60),
      randomRange(60, canvasH - 60),
      radius,
      hp,
      res,
      data.asteroidColor
    );

    this.asteroids.push(asteroid);
  }

  getAsteroidAt(x, y) {
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      if (this.asteroids[i].containsPoint(x, y)) {
        return this.asteroids[i];
      }
    }
    return null;
  }

  render(ctx) {
    for (const a of this.asteroids) {
      a.render(ctx);
    }
  }
}
