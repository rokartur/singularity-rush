import { formatNumber, clamp } from '../utils/Math.js';

const COMBO_TIMEOUT = 1.5;
const COMBO_THRESHOLDS = [
  { min: 0, mult: 1 },
  { min: 3, mult: 1.5 },
  { min: 8, mult: 2 },
  { min: 15, mult: 3 },
  { min: 25, mult: 5 },
  { min: 40, mult: 8 },
  { min: 60, mult: 15 },
  { min: 80, mult: 30 },
  { min: 100, mult: 50 }
];

export class ComboSystem {
  constructor(gameState) {
    this.gs = gameState;
    this.count = 0;
    this.multiplier = 1;
    this.timer = 0;
    this.bestCombo = 0;
    this.lastMilestone = 0;
  }

  registerClick() {
    this.count++;
    this.timer = COMBO_TIMEOUT;
    this._calcMultiplier();

    if (this.count > this.gs.statistics.highestCombo) {
      this.gs.statistics.highestCombo = this.count;
    }
    if (this.count > this.bestCombo) {
      this.bestCombo = this.count;
    }

    const milestone = this._getMilestone();
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      this.gs.emit('comboMilestone', { level: milestone });
    }

    this.gs.combo.count = this.count;
    this.gs.combo.bestCombo = this.bestCombo;
    this.gs.combo.multiplier = this.multiplier;
  }

  update(dt) {
    if (this.count > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.count = 0;
        this.multiplier = 1;
        this.lastMilestone = 0;
        this.gs.combo.count = 0;
        this.gs.combo.multiplier = 1;
      }
    }
  }

  _calcMultiplier() {
    for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.count >= COMBO_THRESHOLDS[i].min) {
        this.multiplier = COMBO_THRESHOLDS[i].mult;
        break;
      }
    }
  }

  _getMilestone() {
    const milestones = [5, 10, 20, 35, 50, 75, 100];
    let last = 0;
    for (const m of milestones) {
      if (this.count >= m) last = m;
      else break;
    }
    return last;
  }

  getComboData() {
    return {
      count: this.count,
      multiplier: this.multiplier,
      isActive: this.count > 0,
      timer: this.timer
    };
  }
}
