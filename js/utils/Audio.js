export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterVolume = 0.5;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _play(freq, type, duration, volume, detune) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    gain.gain.value = volume * this.masterVolume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  clickHit(comboLevel) {
    const baseFreq = 440 + Math.min(comboLevel, 20) * 30;
    this._play(baseFreq, 'square', 0.05, 0.15);
  }

  asteroidDestroy(size) {
    const freq = 150 + size * 50;
    this._play(freq, 'sawtooth', 0.15, 0.2);
    setTimeout(() => this._play(freq * 1.5, 'square', 0.08, 0.1), 30);
  }

  criticalHit() {
    this._play(200, 'sawtooth', 0.3, 0.3);
    this._play(100, 'square', 0.4, 0.2, -50);
    setTimeout(() => this._play(800, 'sine', 0.2, 0.15), 50);
  }

  upgrade() {
    this._play(523, 'square', 0.08, 0.15);
    setTimeout(() => this._play(659, 'square', 0.08, 0.15), 80);
    setTimeout(() => this._play(784, 'square', 0.12, 0.15), 160);
  }

  comboMilestone(level) {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this._play(n, 'sine', 0.15, 0.2), i * 60);
    });
  }

  bossPhase() {
    this._play(120, 'sawtooth', 0.5, 0.25);
    this._play(80, 'square', 0.6, 0.2, -100);
  }

  bossKill() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((n, i) => {
      setTimeout(() => this._play(n, 'sine', 0.3, 0.25), i * 80);
    });
    setTimeout(() => {
      this._play(100, 'sawtooth', 0.8, 0.3);
      this._play(200, 'square', 0.6, 0.2);
    }, 500);
  }

  newGalaxy() {
    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this._play(n, 'sine', 0.4, 0.2), i * 120);
    });
    setTimeout(() => this._play(1568, 'sine', 0.8, 0.3), 600);
  }

  achievement() {
    this._play(880, 'sine', 0.1, 0.15);
    setTimeout(() => this._play(1100, 'sine', 0.15, 0.15), 100);
  }

  sell() {
    this._play(600, 'square', 0.05, 0.12);
    setTimeout(() => this._play(800, 'square', 0.05, 0.12), 50);
  }

  error() {
    this._play(200, 'sawtooth', 0.15, 0.15);
  }

  tick() {
    this._play(1200, 'sine', 0.02, 0.05);
  }
}

export const audio = new Audio();
