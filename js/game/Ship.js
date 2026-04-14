import { dist } from '../utils/Math.js';

const SHIP_SPRITE = [
  // 16x16 pixel art ship - top-down view, nose pointing right
  // 0=empty, 1=dark hull, 2=main hull, 3=cockpit, 4=engine glow
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,2,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,1,2,2,2,3,2,2,1,0,0,0,0],
  [0,0,4,1,2,2,2,3,3,2,2,2,1,0,0,0],
  [0,4,4,1,2,2,2,2,2,2,2,2,2,1,1,0],
  [0,4,4,1,2,2,2,2,2,2,2,2,2,1,1,0],
  [0,0,4,1,2,2,2,3,3,2,2,2,1,0,0,0],
  [0,0,0,0,1,2,2,2,3,2,2,1,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,2,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const COLORS = {
  1: '#1a3a4a', // dark hull outline
  2: '#00aacc', // main hull
  3: '#00ffdd', // cockpit highlight
  4: '#ff6600', // engine glow
};

export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.rotation = -Math.PI / 2;
    this.size = 16;
    this.pixelScale = 2.5;
    this.fireTimer = 0;
    this.alive = true;
    this.invulnTimer = 0;
    this.hitFlash = 0;
    this.targetAngle = -Math.PI / 2;
    this.mouseX = x;
    this.mouseY = y;
    this.engineFlicker = 0;
    this._spriteCache = null;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.rotation = -Math.PI / 2;
    this.fireTimer = 0;
    this.alive = true;
    this.invulnTimer = 0;
    this.hitFlash = 0;
    this.targetAngle = -Math.PI / 2;
    this.mouseX = x;
    this.mouseY = y;
  }

  setMouseTarget(mx, my) {
    this.mouseX = mx;
    this.mouseY = my;
  }

  update(dt, canvasW, canvasH, enemies, shipSpeed) {
    if (!this.alive) return;

    // Follow mouse cursor smoothly
    const dx = this.mouseX - this.x;
    const dy = this.mouseY - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 3) {
      const speed = Math.min(shipSpeed, d * 8);
      this.x += (dx / d) * speed * dt;
      this.y += (dy / d) * speed * dt;
    }

    const margin = this.size * this.pixelScale / 2 + 5;
    this.x = Math.max(margin, Math.min(canvasW - margin, this.x));
    this.y = Math.max(margin, Math.min(canvasH - margin, this.y));

    // Auto-aim at nearest enemy
    if (enemies && enemies.length > 0) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const e of enemies) {
        const ed = dist(this.x, this.y, e.x, e.y);
        if (ed < nearestDist) { nearestDist = ed; nearest = e; }
      }
      if (nearest) {
        this.targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
      }
    } else {
      // Face movement direction when no enemies
      if (d > 10) {
        this.targetAngle = Math.atan2(dy, dx);
      }
    }

    // Smooth rotation toward target
    let angleDiff = this.targetAngle - this.rotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.rotation += angleDiff * Math.min(1, dt * 12);

    this.fireTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.engineFlicker = Math.random();
  }

  canFire() {
    return this.alive && this.fireTimer <= 0;
  }

  setFireCooldown(cooldown) {
    this.fireTimer = cooldown;
  }

  getProjectileSpawn() {
    // Spawn from nose of ship
    const noseOffset = this.size * this.pixelScale * 0.6;
    return {
      x: this.x + Math.cos(this.rotation) * noseOffset,
      y: this.y + Math.sin(this.rotation) * noseOffset,
      angle: this.rotation
    };
  }

  takeDamage() {
    if (this.invulnTimer > 0) return false;
    this.invulnTimer = 0.5;
    this.hitFlash = 0.15;
    return true;
  }

  render(ctx) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const s = this.pixelScale;
    const halfW = (this.size * s) / 2;
    const halfH = (this.size * s) / 2;

    // Invulnerability blink
    if (this.invulnTimer > 0 && this.hitFlash <= 0) {
      ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 40) * 0.4;
    }

    // Draw pixel art sprite
    for (let row = 0; row < SHIP_SPRITE.length; row++) {
      for (let col = 0; col < SHIP_SPRITE[row].length; col++) {
        const val = SHIP_SPRITE[row][col];
        if (val === 0) continue;

        let color;
        if (val === 4) {
          // Animated engine glow
          const flicker = 0.6 + this.engineFlicker * 0.4;
          ctx.globalAlpha = (ctx.globalAlpha || 1) * flicker;
          color = this.hitFlash > 0 ? '#ffffff' : COLORS[val];
        } else {
          color = this.hitFlash > 0 ? '#ffffff' : COLORS[val];
        }

        ctx.fillStyle = color;
        ctx.fillRect(
          col * s - halfW,
          row * s - halfH,
          s,
          s
        );

        if (val === 4) {
          ctx.globalAlpha = this.invulnTimer > 0 && this.hitFlash <= 0
            ? 0.4 + Math.sin(performance.now() / 40) * 0.4
            : 1;
        }
      }
    }

    ctx.restore();
  }
}
