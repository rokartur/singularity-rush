export class Galaxy {
  constructor(gameState) {
    this.gs = gameState;
    this.galaxies = [];
    this.currentData = null;
    this.bossResourcesCollected = this.gs.bossProgressCollected ?? 0;
    this.bossResourcesNeeded = this.gs.bossProgressNeeded ?? 200;
    this.bossActive = this.gs.bossProgressActive ?? false;
    this.bossTimer = 0;
  }

  loadData(galaxiesData) {
    this.galaxies = galaxiesData;
    this.bossResourcesCollected = this.gs.bossProgressCollected ?? 0;
    this.bossResourcesNeeded = this.gs.bossProgressNeeded ?? this.bossResourcesNeeded;
    this.bossActive = this.gs.bossProgressActive ?? false;
    this._updateCurrent();
  }

  _syncBossProgress() {
    this.gs.bossProgressCollected = this.bossResourcesCollected;
    this.gs.bossProgressNeeded = this.bossResourcesNeeded;
    this.gs.bossProgressActive = this.bossActive;
  }

  _updateCurrent() {
    const idx = this.gs.currentGalaxyIndex;
    if (idx >= 0 && idx < this.galaxies.length) {
      this.currentData = this.galaxies[idx];
    }
  }

  getCurrent() {
    return this.currentData;
  }

  getHighestUnlocked() {
    return Math.max(...this.gs.unlockedGalaxies);
  }

  isUnlocked(index) {
    return this.gs.unlockedGalaxies.includes(index);
  }

  travel(index) {
    if (index < 0 || index >= this.galaxies.length) return false;
    if (!this.isUnlocked(index)) return false;

    this.gs.currentGalaxyIndex = index;
    this._updateCurrent();
    this.bossResourcesCollected = 0;
    this.bossActive = false;
    this._syncBossProgress();
    this.gs.emit('galaxyTraveled', { index, data: this.currentData });
    return true;
  }

  canUnlock(index) {
    if (index < 0 || index >= this.galaxies.length) return false;
    if (this.isUnlocked(index)) return true;
    const highest = this.getHighestUnlocked();
    return index <= highest + 1;
  }

  unlock(index) {
    if (!this.canUnlock(index)) return false;

    const isNewUnlock = !this.isUnlocked(index);

    if (isNewUnlock) {
      this.gs.completeGalaxy(index - 1);
      this.gs.unlockGalaxy(index);
    }

    this.gs.currentGalaxyIndex = index;
    this._updateCurrent();
    this.bossResourcesCollected = 0;
    this.bossActive = false;
    this._syncBossProgress();

    if (isNewUnlock) {
      this.gs.emit('galaxyUnlocked', { index, data: this.currentData });
    } else {
      this.gs.emit('galaxyTraveled', { index, data: this.currentData });
    }
    return true;
  }

  addBossProgress(amount) {
    if (this.bossActive) return;
    this.bossResourcesCollected += amount;
    if (this.bossResourcesCollected >= this.bossResourcesNeeded) {
      this.bossActive = true;
      this._syncBossProgress();
      this.gs.emit('bossSpawn', { data: this.currentData.boss });
      return;
    }
    this._syncBossProgress();
  }

  setBossDefeated() {
    this.bossActive = false;
    this.bossResourcesCollected = 0;
    this._syncBossProgress();
    const legacyBossResources = Object.values(this.currentData.boss.reward?.resources || {})
      .reduce((total, amount) => total + Math.max(0, Math.floor(amount || 0)), 0);
    const reward = {
      ...(this.currentData.boss.reward || {}),
      resources: Math.max(0, Math.floor(this.currentData.resourceReward ?? legacyBossResources ?? 0))
    };
    this.gs.recordBossKilled(this.gs.currentGalaxyIndex);
    this.gs.addXP(reward.xp || 50);
    this.gs.emit('bossDefeated', { reward });
  }

  getBossProgress() {
    return {
      current: this.bossResourcesCollected,
      needed: this.bossResourcesNeeded,
      percent: (this.bossResourcesCollected / this.bossResourcesNeeded) * 100,
      active: this.bossActive
    };
  }

  getAllGalaxies() {
    return this.galaxies.map((g, i) => ({
      ...g,
      unlocked: this.isUnlocked(i),
      completed: this.gs.completedGalaxies.includes(i),
      canUnlock: this.canUnlock(i),
      bossKilled: (this.gs.bossesKilledInGalaxy[i] || 0) > 0
    }));
  }
}
