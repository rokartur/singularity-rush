export class ScreenEffects {
  constructor() {
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
  }

  shake(intensity, duration) {
    if (intensity > this.shakeIntensity) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
      this.shakeTimer = duration;
    }
  }

  shakeByScore(score) {
    if (score > 10000) this.shake(8, 0.5);
    else if (score > 1000) this.shake(4, 0.3);
    else if (score > 100) this.shake(2, 0.2);
    else this.shake(1, 0.1);
  }

  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = this.shakeTimer / this.shakeDuration;
      const intensity = this.shakeIntensity * progress;
      this.shakeX = (Math.random() * 2 - 1) * intensity;
      this.shakeY = (Math.random() * 2 - 1) * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeIntensity = 0;
    }
  }

  applyTransform(ctx) {
    if (this.shakeX !== 0 || this.shakeY !== 0) {
      ctx.translate(this.shakeX, this.shakeY);
    }
  }
}
