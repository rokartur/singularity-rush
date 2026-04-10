import { formatNumber, clamp } from '../utils/Math.js';

const XP_BASE = 20;
const XP_SCALE = 1.55;

function xpForLevel(level) {
  return Math.floor(XP_BASE * Math.pow(XP_SCALE, level - 1));
}

export class GameState {
  constructor() {
    this.currentGalaxyIndex = 0;
    this.prestigeLevel = 0;
    this.level = 1;
    this.xp = 0;
    this.resources = { iron: 0, nickel: 0 };
    this.hp = 100;
    this.maxHp = 100;
    this.shield = 0;
    this.maxShield = 0;
    this.skillLevels = {};
    this.unlockedGalaxies = [0];
    this.completedGalaxies = [];
    this.bossesKilledInGalaxy = {};
    this.bossProgressCollected = 0;
    this.bossProgressNeeded = 100;
    this.bossProgressActive = false;
    this.bossState = null;
    this.autoMineTimer = 0;
    this.baseExpeditionTime = 15;
    this.expeditionTimeBonus = 0;
    this.expeditionState = {
      active: false,
      timeRemaining: 0,
      maxTime: 15,
      asteroidsDestroyed: 0,
      resourcesGathered: {},
      xpGained: 0,
      maxCombo: 0,
      score: 0
    };
    this.statistics = {
      playtime: 0,
      totalClicks: 0,
      totalDamage: 0,
      asteroidsDestroyed: 0,
      bossesKilled: 0,
      resourcesCollected: 0,
      highestCombo: 0,
      highestGalaxy: 0,
      prestigeCount: 0,
      expeditionRuns: 0
    };
    this.combo = {
      count: 0,
      bestCombo: 0,
      lastClickTime: 0,
      decayTimer: 0,
      multiplier: 1
    };

    this._listeners = new Map();
    this._pendingNotifications = [];
  }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(cb);
  }

  off(event, cb) {
    if (!this._listeners.has(event)) return;
    const arr = this._listeners.get(event);
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  }

  emit(event, data) {
    this._pendingNotifications.push({ event, data });
  }

  flushNotifications() {
    const pending = this._pendingNotifications;
    this._pendingNotifications = [];
    for (const { event, data } of pending) {
      const listeners = this._listeners.get(event);
      if (listeners) {
        for (const cb of listeners) cb(data);
      }
    }
  }

  addXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      this.maxHp += 10;
      this.hp = this.maxHp;
      this.emit('levelUp', { level: this.level });
    }

    if (this.expeditionState.active) {
      this.expeditionState.xpGained += amount;
    }
  }

  xpToNext() {
    return xpForLevel(this.level);
  }

  xpProgress() {
    return this.xp / this.xpToNext();
  }

  addResource(type, amount) {
    if (!this.resources[type]) this.resources[type] = 0;
    this.resources[type] += amount;
    this.statistics.resourcesCollected += amount;
    this.emit('resourceGained', { type, amount });
  }

  removeResource(type, amount) {
    if ((this.resources[type] || 0) < amount) return false;
    this.resources[type] -= amount;
    return true;
  }

  takeDamage(amount) {
    let remaining = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    this.hp = clamp(this.hp - remaining, 0, this.maxHp);
    if (this.hp <= 0) {
      this.emit('playerDied', {});
    }
  }

  heal(amount) {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  recordClick() {
    this.statistics.totalClicks++;
  }

  recordAsteroidDestroyed(xpReward = 1) {
    this.statistics.asteroidsDestroyed++;
    this.addXP(xpReward);
    if (this.expeditionState.active) {
      this.expeditionState.asteroidsDestroyed++;
    }
  }

  recordBossKilled(galaxyIndex) {
    this.statistics.bossesKilled++;
    if (!this.bossesKilledInGalaxy[galaxyIndex]) {
      this.bossesKilledInGalaxy[galaxyIndex] = 0;
    }
    this.bossesKilledInGalaxy[galaxyIndex]++;
  }

  completeGalaxy(index) {
    if (!this.completedGalaxies.includes(index)) {
      this.completedGalaxies.push(index);
    }
    if (index > this.statistics.highestGalaxy) {
      this.statistics.highestGalaxy = index;
    }
  }

  unlockGalaxy(index) {
    if (!this.unlockedGalaxies.includes(index)) {
      this.unlockedGalaxies.push(index);
      this.unlockedGalaxies.sort((a, b) => a - b);
    }
  }

  startExpedition() {
    const maxTime = this.baseExpeditionTime + this.expeditionTimeBonus;
    this.expeditionState = {
      active: true,
      timeRemaining: maxTime,
      maxTime,
      asteroidsDestroyed: 0,
      resourcesGathered: {},
      xpGained: 0,
      maxCombo: 0,
      score: 0
    };
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.statistics.expeditionRuns++;
    this.emit('expeditionStart', { maxTime });
  }

  endExpedition() {
    this.expeditionState.active = false;
    this.expeditionState.maxCombo = Math.max(
      this.expeditionState.maxCombo,
      this.combo.count
    );
    this.emit('expeditionEnd', { summary: { ...this.expeditionState } });
  }

  isExpeditionActive() {
    return this.expeditionState.active;
  }

  getStatSummary() {
    return {
      Level: this.level,
      Galaxy: this.currentGalaxyIndex + 1,
      'Total Clicks': formatNumber(this.statistics.totalClicks),
      'Asteroids Destroyed': formatNumber(this.statistics.asteroidsDestroyed),
      'Bosses Killed': this.statistics.bossesKilled,
      'Expedition Runs': this.statistics.expeditionRuns,
      'Resources Collected': formatNumber(this.statistics.resourcesCollected),
      'Playtime': Math.floor(this.statistics.playtime / 60) + ' min'
    };
  }
}
