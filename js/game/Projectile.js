export class Projectile {
  constructor(x, y, vx, vy, baseDamage, rotation) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.baseDamage = baseDamage;
    this.rotation = rotation || 0;
    this.alive = true;
    this.life = 2.0;
    this.radius = 4;
    this.trail = [];
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y, alpha: 0.8 });
    if (this.trail.length > 6) this.trail.shift();
    for (const t of this.trail) t.alpha -= dt * 4;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    if (this.life <= 0) this.alive = false;
  }

  isOffScreen(canvasW, canvasH) {
    const m = 30;
    return this.x < -m || this.x > canvasW + m ||
           this.y < -m || this.y > canvasH + m;
  }

  render(ctx) {
    for (const t of this.trail) {
      if (t.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = t.alpha * 0.35;
      ctx.fillStyle = '#0088cc';
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#00eeff';
    ctx.shadowColor = '#00aaff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
