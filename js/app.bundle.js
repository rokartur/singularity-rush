(() => {
  // js/utils/Math.js
  var SUFFIXES = [
    "",
    "K",
    "M",
    "B",
    "T",
    "Qa",
    "Qi",
    "Sx",
    "Sp",
    "Oc",
    "No",
    "Dc"
  ];
  function formatNumber(num) {
    if (num < 1e3) return Math.floor(num).toLocaleString("en");
    if (!isFinite(num)) return "\u221E";
    const tier = Math.min(Math.floor(Math.log10(Math.abs(num)) / 3), SUFFIXES.length - 1);
    const suffix = SUFFIXES[tier];
    const scale = Math.pow(10, tier * 3);
    const scaled = num / scale;
    return scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0) + suffix;
  }
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }
  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // js/game/GameState.js
  var XP_BASE = 20;
  var XP_SCALE = 1.55;
  function xpForLevel(level) {
    return Math.floor(XP_BASE * Math.pow(XP_SCALE, level - 1));
  }
  var GameState = class {
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
      this._listeners = /* @__PURE__ */ new Map();
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
        this.emit("levelUp", { level: this.level });
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
      this.emit("resourceGained", { type, amount });
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
        this.emit("playerDied", {});
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
      this.emit("expeditionStart", { maxTime });
    }
    endExpedition() {
      this.expeditionState.active = false;
      this.expeditionState.maxCombo = Math.max(
        this.expeditionState.maxCombo,
        this.combo.count
      );
      this.emit("expeditionEnd", { summary: { ...this.expeditionState } });
    }
    isExpeditionActive() {
      return this.expeditionState.active;
    }
    getStatSummary() {
      return {
        Level: this.level,
        Galaxy: this.currentGalaxyIndex + 1,
        "Total Clicks": formatNumber(this.statistics.totalClicks),
        "Asteroids Destroyed": formatNumber(this.statistics.asteroidsDestroyed),
        "Bosses Killed": this.statistics.bossesKilled,
        "Expedition Runs": this.statistics.expeditionRuns,
        "Resources Collected": formatNumber(this.statistics.resourcesCollected),
        "Playtime": Math.floor(this.statistics.playtime / 60) + " min"
      };
    }
  };

  // js/utils/RNG.js
  var RNG = class {
    constructor(seed) {
      this.seed = seed || Date.now();
    }
    next() {
      this.seed = (this.seed * 16807 + 0) % 2147483647;
      return (this.seed - 1) / 2147483646;
    }
    nextInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }
    nextFloat(min, max) {
      return this.next() * (max - min) + min;
    }
    pick(array) {
      return array[this.nextInt(0, array.length - 1)];
    }
    weightedPick(items) {
      const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
      let roll = this.next() * totalWeight;
      for (const item of items) {
        roll -= item.weight || 1;
        if (roll <= 0) return item;
      }
      return items[items.length - 1];
    }
    chance(probability) {
      return this.next() < probability;
    }
    shuffle(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.nextInt(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  };

  // js/game/Asteroid.js
  var rng = new RNG();
  var Asteroid = class {
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
      this.spawnAnim = 1;
    }
    _generateVertices() {
      const count = rng.nextInt(7, 12);
      const verts = [];
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const r = this.radius * randomRange(0.7, 1);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
      return verts;
    }
    takeDamage(amount) {
      this.hp -= amount;
      this.hitFlash = 0.2;
      this.crackLevel = 1 - this.hp / this.maxHp;
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
      if (this.x < margin) {
        this.x = margin;
        this.vx *= -0.5;
      }
      if (this.x > canvasW - margin) {
        this.x = canvasW - margin;
        this.vx *= -0.5;
      }
      if (this.y < margin) {
        this.y = margin;
        this.vy *= -0.5;
      }
      if (this.y > canvasH - margin) {
        this.y = canvasH - margin;
        this.vy *= -0.5;
      }
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
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.fillStyle = this.color;
      }
      ctx.fill();
      ctx.strokeStyle = this.hitFlash > 0 ? "#ffffff" : this._lighten(this.color, 30);
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
        const angle = i / count * Math.PI * 2 + 0.3;
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
      ctx.fillStyle = "#333";
      ctx.fillRect(-barW / 2, barY, barW, barH);
      const color = pct > 0.5 ? "#50c878" : pct > 0.25 ? "#f0c040" : "#fe5f55";
      ctx.fillStyle = color;
      ctx.fillRect(-barW / 2, barY, barW * pct, barH);
    }
    _lighten(hex, amount) {
      const num = parseInt(hex.replace("#", ""), 16);
      const r = Math.min(255, (num >> 16) + amount);
      const g = Math.min(255, (num >> 8 & 255) + amount);
      const b = Math.min(255, (num & 255) + amount);
      return `rgb(${r},${g},${b})`;
    }
  };
  var AsteroidManager = class {
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
      this.asteroids = this.asteroids.filter((a) => a.alive);
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
  };

  // js/game/Combo.js
  var COMBO_TIMEOUT = 1.5;
  var COMBO_THRESHOLDS = [
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
  var ComboSystem = class {
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
        this.gs.emit("comboMilestone", { level: milestone });
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
  };

  // js/game/Galaxy.js
  var Galaxy = class {
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
    canUnlock(index) {
      if (index < 0 || index >= this.galaxies.length) return false;
      if (this.isUnlocked(index)) return true;
      const highest = this.getHighestUnlocked();
      if (index > highest + 1) return false;
      const unlockCost = this.galaxies[index].unlockCost || {};
      return Object.entries(unlockCost).every(([resourceId, amount]) => (this.gs.resources[resourceId] || 0) >= amount);
    }
    unlock(index) {
      if (!this.canUnlock(index)) return false;
      const isNewUnlock = !this.isUnlocked(index);
      if (isNewUnlock) {
        const cost = this.galaxies[index].unlockCost || {};
        for (const [resourceId, amount] of Object.entries(cost)) {
          if (!this.gs.removeResource(resourceId, amount)) {
            return false;
          }
        }
        this.gs.completeGalaxy(index - 1);
        this.gs.unlockGalaxy(index);
      }
      this.gs.currentGalaxyIndex = index;
      this._updateCurrent();
      this.bossResourcesCollected = 0;
      this.bossActive = false;
      this._syncBossProgress();
      if (isNewUnlock) {
        this.gs.emit("galaxyUnlocked", { index, data: this.currentData });
      } else {
        this.gs.emit("galaxyTraveled", { index, data: this.currentData });
      }
      return true;
    }
    addBossProgress(amount) {
      if (this.bossActive) return;
      this.bossResourcesCollected += amount;
      if (this.bossResourcesCollected >= this.bossResourcesNeeded) {
        this.bossActive = true;
        this._syncBossProgress();
        this.gs.emit("bossSpawn", { data: this.currentData.boss });
        return;
      }
      this._syncBossProgress();
    }
    setBossDefeated() {
      this.bossActive = false;
      this.bossResourcesCollected = 0;
      this._syncBossProgress();
      const reward = this.currentData.boss.reward;
      for (const [resourceId, amount] of Object.entries(reward.resources || {})) {
        this.gs.addResource(resourceId, amount);
      }
      this.gs.recordBossKilled(this.gs.currentGalaxyIndex);
      this.gs.addXP(reward.xp || 50);
      this.gs.emit("bossDefeated", { reward });
    }
    getBossProgress() {
      return {
        current: this.bossResourcesCollected,
        needed: this.bossResourcesNeeded,
        percent: this.bossResourcesCollected / this.bossResourcesNeeded * 100,
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
  };

  // js/game/StatCalculator.js
  function calculateCombatStats({ gs, skillTree }) {
    const baseClick = 15 + (skillTree?.getTotalEffect?.("click_damage_flat") || 0);
    const clickDamageMult = 1 + (skillTree?.getTotalEffect?.("click_damage_mult") || 0);
    const critChance = 0.05 + (skillTree?.getTotalEffect?.("crit_chance") || 0);
    const critMult = 3 + (skillTree?.getTotalEffect?.("crit_mult") || 0);
    const resourceMult = 1 + (skillTree?.getTotalEffect?.("resource_mult") || 0);
    const maxHp = (100 + Math.max(0, gs.level - 1) * 10) * (1 + (skillTree?.getTotalEffect?.("max_hp") || 0));
    const maxShield = maxHp * (skillTree?.getTotalEffect?.("shield") || 0);
    const passiveRegenPerSecond = maxHp * (skillTree?.getTotalEffect?.("passive_regen") || 0);
    const bossProgressMult = 1 + (skillTree?.getTotalEffect?.("boss_progress") || 0);
    const expeditionTimeBonus = skillTree?.getTotalEffect?.("expedition_time") || 0;
    return {
      clickDamage: baseClick * clickDamageMult,
      critChance: Math.min(critChance, 0.8),
      critMult,
      resourceMult,
      damageMult: clickDamageMult,
      maxHp,
      maxShield,
      passiveRegenPerSecond,
      xpMult: 1,
      bossProgressMult,
      bonusResourceChance: 0,
      rareDropMult: 1,
      expeditionTimeBonus
    };
  }

  // js/rendering/Particles.js
  var rng2 = new RNG();
  var Particle = class {
    constructor(x, y, vx, vy, color, life, size, type) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.life = life;
      this.maxLife = life;
      this.size = size;
      this.type = type || "circle";
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
  };
  var ParticleSystem = class {
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
        type = "square",
        angleMin = 0,
        angleMax = Math.PI * 2
      } = opts;
      for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
        const angle = randomRange(angleMin, angleMax);
        const speed = randomRange(speedMin, speedMax);
        this.particles.push(new Particle(
          x,
          y,
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
        type: "square"
      });
      this.emit(x, y, Math.floor(12 * intensity), "#ffffff", {
        speedMin: 40,
        speedMax: 150 * intensity,
        sizeMin: 2,
        sizeMax: 6,
        lifeMin: 0.2,
        lifeMax: 0.5,
        type: "square"
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
        type: "square"
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
        type: "square"
      });
    }
    emitCritical(x, y) {
      this.emit(x, y, 30, "#ff0040", {
        speedMin: 120,
        speedMax: 350,
        sizeMin: 6,
        sizeMax: 16,
        lifeMin: 0.3,
        lifeMax: 0.7,
        type: "square"
      });
      this.emit(x, y, 15, "#ffffff", {
        speedMin: 60,
        speedMax: 200,
        sizeMin: 4,
        sizeMax: 8,
        lifeMin: 0.2,
        lifeMax: 0.5,
        type: "square"
      });
    }
    emitRing(x, y, color, radius = 30) {
      const count = 24;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        this.particles.push(new Particle(
          x + Math.cos(angle) * radius,
          y + Math.sin(angle) * radius,
          Math.cos(angle) * 80,
          Math.sin(angle) * 80,
          color,
          0.5,
          6,
          "square"
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
      this.particles = this.particles.filter((p) => p.update(dt));
      if (this.flashTimer > 0) {
        this.flashTimer -= dt;
        this.flashAlpha = Math.max(0, this.flashTimer / this.flashDuration * 0.5);
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
        if (p.type === "square") {
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
        ctx.fillStyle = this.flashColor || "#ffffff";
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.restore();
      }
    }
    clear() {
      this.particles = [];
    }
  };

  // js/rendering/Effects.js
  var ScreenEffects = class {
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
      if (score > 1e4) this.shake(8, 0.5);
      else if (score > 1e3) this.shake(4, 0.3);
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
  };

  // js/rendering/UI.js
  var FloatingText = class {
    constructor(x, y, text, color, size, duration) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.size = size || 16;
      this.duration = duration || 1;
      this.maxDuration = this.duration;
      this.vy = -40;
      this.alpha = 1;
    }
    update(dt) {
      this.y += this.vy * dt;
      this.duration -= dt;
      this.alpha = Math.max(0, this.duration / this.maxDuration);
      return this.duration > 0;
    }
    render(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.font = `${this.size}px "Press Start 2P", monospace`;
      ctx.fillStyle = this.color;
      ctx.textAlign = "center";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  };
  var UIManager = class {
    constructor(gameState) {
      this.gs = gameState;
      this.floatingTexts = [];
      this.numberRollers = /* @__PURE__ */ new Map();
      this.prevResources = /* @__PURE__ */ new Map();
      this._cacheElements();
    }
    _cacheElements() {
      this.els = {
        resources: document.getElementById("ui-resources"),
        level: document.getElementById("ui-level"),
        xpBar: document.getElementById("ui-xp-fill"),
        galaxy: document.getElementById("ui-galaxy"),
        galaxyName: document.getElementById("ui-galaxy-name"),
        hpBar: document.getElementById("ui-hp-fill"),
        hpText: document.getElementById("ui-hp-text"),
        shieldBar: document.getElementById("ui-shield-fill"),
        comboCount: document.getElementById("ui-combo-count"),
        comboMult: document.getElementById("ui-combo-mult"),
        comboBar: document.getElementById("ui-combo-bar")
      };
    }
    initRollers() {
      return;
    }
    addFloatingText(x, y, text, color, size) {
      this.floatingTexts.push(new FloatingText(x, y, text, color, size));
    }
    update(dt) {
      this.floatingTexts = this.floatingTexts.filter((ft) => ft.update(dt));
    }
    renderFloatingTexts(ctx) {
      for (const ft of this.floatingTexts) {
        ft.render(ctx);
      }
    }
    updateHUD() {
      const gs = this.gs;
      if (this.els.level) this.els.level.textContent = gs.level;
      if (this.els.xpBar) this.els.xpBar.style.width = gs.xpProgress() * 100 + "%";
      if (this.els.galaxy) this.els.galaxy.textContent = `${gs.currentGalaxyIndex + 1}`;
      if (this.els.galaxyName) this.els.galaxyName.textContent = `SEKTOR ${gs.currentGalaxyIndex + 1}`;
      if (this.els.hpBar) {
        const hpPct = gs.hp / gs.maxHp;
        this.els.hpBar.style.width = hpPct * 100 + "%";
        const hpContainer = document.getElementById("hp-bar-container");
        if (hpContainer) {
          if (hpPct < 0.3) {
            hpContainer.classList.add("hp-critical");
          } else {
            hpContainer.classList.remove("hp-critical");
          }
        }
      }
      if (this.els.shieldBar) {
        const shieldPct = gs.maxShield > 0 ? gs.shield / gs.maxShield * 100 : 0;
        this.els.shieldBar.style.width = Math.min(shieldPct, 100) + "%";
      }
      if (this.els.hpText) {
        if (gs.shield > 0) {
          this.els.hpText.textContent = `${Math.floor(gs.hp)}/${gs.maxHp} (+${Math.floor(gs.shield)})`;
        } else {
          this.els.hpText.textContent = `${Math.floor(gs.hp)}/${gs.maxHp}`;
        }
      }
      this._updateResourceList();
    }
    _updateResourceList() {
      if (!this.els.resources) return;
      const gs = this.gs;
      let needsRebuild = false;
      const currentKeys = Object.keys(gs.resources).filter((k) => gs.resources[k] > 0);
      const existingKeys = Array.from(this.els.resources.querySelectorAll(".resource-item")).map((el) => el.dataset.key);
      if (currentKeys.length !== existingKeys.length || !currentKeys.every((k) => existingKeys.includes(k))) {
        needsRebuild = true;
      }
      if (needsRebuild) {
        let html = "";
        for (const key of currentKeys) {
          html += `
          <div class="resource-item" data-key="${key}">
            <span class="res-key-wrap"><img class="res-icon" src="assets/sprites/resources/${key}.svg" alt="${key}"><span class="res-key">${key}</span></span>
            <span class="res-val" data-res="${key}">${formatNumber(gs.resources[key])}</span>
          </div>
        `;
        }
        this.els.resources.innerHTML = html;
      }
      for (const key of currentKeys) {
        const val = gs.resources[key];
        const prevVal = this.prevResources.get(key) || 0;
        if (val !== prevVal) {
          const valEl = this.els.resources.querySelector(`.res-val[data-res="${key}"]`);
          if (valEl) {
            valEl.textContent = formatNumber(val);
            if (val > prevVal) {
              valEl.classList.remove("res-flash");
              void valEl.offsetWidth;
              valEl.classList.add("res-flash");
              if (valEl.flashTimeout) clearTimeout(valEl.flashTimeout);
              valEl.flashTimeout = setTimeout(() => {
                if (valEl) valEl.classList.remove("res-flash");
              }, 600);
            }
          }
          this.prevResources.set(key, val);
        }
      }
    }
    updateCombo(combo) {
      if (this.els.comboCount) {
        const newText = combo.count > 0 ? `x${combo.count}` : "";
        if (this.els.comboCount.textContent !== newText) {
          this.els.comboCount.textContent = newText;
          if (combo.count > 0) {
            this.els.comboCount.classList.remove("number-pop");
            void this.els.comboCount.offsetWidth;
            this.els.comboCount.classList.add("number-pop");
          }
        }
      }
      if (this.els.comboMult) {
        this.els.comboMult.textContent = combo.multiplier > 1 ? `${combo.multiplier.toFixed(1)}x` : "";
      }
      if (this.els.comboBar) {
        const pct = Math.min(combo.count / 50, 1) * 100;
        this.els.comboBar.style.width = pct + "%";
      }
    }
  };

  // js/utils/SaveManager.js
  var SAVE_VERSION = "3.0.0";
  var STORAGE_KEY = "singularity_rush_save";
  var SaveManager = class {
    constructor(gameState) {
      this.gs = gameState;
      this.autoSaveInterval = 3e4;
      this.autoSaveTimer = 0;
    }
    generateSave() {
      const data = {
        version: SAVE_VERSION,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        playtime_seconds: this.gs.statistics.playtime,
        galaxy: this.gs.currentGalaxyIndex,
        prestige_level: this.gs.prestigeLevel,
        level: this.gs.level,
        xp: this.gs.xp,
        resources: { ...this.gs.resources },
        hp: this.gs.hp,
        maxHp: this.gs.maxHp,
        shield: this.gs.shield,
        skillLevels: { ...this.gs.skillLevels },
        unlockedGalaxies: [...this.gs.unlockedGalaxies],
        completedGalaxies: [...this.gs.completedGalaxies],
        bossesKilledInGalaxy: { ...this.gs.bossesKilledInGalaxy },
        bossProgressCollected: this.gs.bossProgressCollected,
        bossProgressNeeded: this.gs.bossProgressNeeded,
        bossProgressActive: this.gs.bossProgressActive,
        bossState: this.gs.bossState,
        baseExpeditionTime: this.gs.baseExpeditionTime,
        expeditionTimeBonus: this.gs.expeditionTimeBonus,
        statistics: { ...this.gs.statistics },
        combo: { count: this.gs.combo.count, bestCombo: this.gs.combo.bestCombo }
      };
      return JSON.stringify(data);
    }
    exportSave() {
      const json = this.generateSave();
      return btoa(unescape(encodeURIComponent(json)));
    }
    importSave(b64) {
      try {
        const json = decodeURIComponent(escape(atob(b64.trim())));
        const data = JSON.parse(json);
        if (!data.version) throw new Error("Invalid save");
        this.loadFromData(data);
        this.autoSave();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    autoSave() {
      const json = this.generateSave();
      const saves = this._getAllSaves();
      saves.auto = json;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    }
    loadAutoSave() {
      const saves = this._getAllSaves();
      if (!saves.auto) return false;
      try {
        const data = JSON.parse(saves.auto);
        this.loadFromData(data);
        return true;
      } catch {
        return false;
      }
    }
    hasAutoSave() {
      const saves = this._getAllSaves();
      return !!saves.auto;
    }
    _migrateV1toV2(data) {
      const migrated = { ...data };
      migrated.version = "2.0.0";
      migrated.baseExpeditionTime = data.baseExpeditionTime ?? 15;
      migrated.expeditionTimeBonus = data.expeditionTimeBonus ?? 0;
      if (migrated.skillLevels) {
        const mapping = {
          "a_mine_drone": "ex_time_1",
          "a_collect_drone": "ex_lucky_start",
          "a_repair_drone": "ex_time_1",
          "a_speed_drone": "ex_time_2",
          "a_swarm": "ex_speed_clicks",
          "a_quantum_link": "ex_boss_rush",
          "a_auto_target": "ex_double_time",
          "a_auto_craft": "ex_crit_surge",
          "a_self_replicate": "ex_marathon"
        };
        const newLevels = {};
        for (const [key, val] of Object.entries(migrated.skillLevels)) {
          const mapped = mapping[key];
          if (mapped) {
            newLevels[mapped] = (newLevels[mapped] || 0) + val;
          } else {
            newLevels[key] = val;
          }
        }
        migrated.skillLevels = newLevels;
      }
      if (migrated.talentCards) {
        migrated.talentCards = migrated.talentCards.filter((t) => t.id !== "automaton");
      }
      return migrated;
    }
    _migrateToV3(data) {
      const migrated = { ...data, version: SAVE_VERSION };
      const mapping = {
        l_power_1: "iron_lattice",
        l_power_2: "neutron_driver",
        l_speed_1: "nickel_focus",
        l_speed_2: "nickel_focus",
        ex_time_1: "crystal_clock",
        ex_time_2: "crystal_clock",
        ex_marathon: "exotic_timefold",
        ex_crit_surge: "fusion_overload",
        ex_boss_rush: "degenerate_radar",
        d_hp_base: "darkmatter_armor",
        d_shield: "particle_barrier",
        d_repair_bot: "neutrino_repair",
        e_scrapper: "antimatter_yield",
        e_market_scan: "plasma_refinery"
      };
      const mergedLevels = {};
      for (const [oldId, level] of Object.entries(migrated.skillLevels || {})) {
        const nextId = mapping[oldId] || oldId;
        mergedLevels[nextId] = (mergedLevels[nextId] || 0) + level;
      }
      migrated.skillLevels = mergedLevels;
      delete migrated.talentPoints;
      delete migrated.skillPoints;
      delete migrated.credits;
      delete migrated.gems;
      delete migrated.laser;
      delete migrated.modules;
      delete migrated.artifacts;
      delete migrated.talentCards;
      delete migrated.shopUpgrades;
      delete migrated.activeShopBuffs;
      delete migrated.shopSessionItems;
      return migrated;
    }
    loadFromData(data) {
      let saveData = data;
      if (data.version && data.version.startsWith("1")) {
        saveData = this._migrateV1toV2(data);
      }
      if (!saveData.version || !saveData.version.startsWith("3")) {
        saveData = this._migrateToV3(saveData);
      }
      const completedGalaxies = saveData.completedGalaxies ?? [];
      const derivedUnlocked = /* @__PURE__ */ new Set([0, saveData.galaxy ?? 0]);
      for (const completedGalaxy of completedGalaxies) {
        derivedUnlocked.add(completedGalaxy);
        derivedUnlocked.add(completedGalaxy + 1);
      }
      const level = saveData.level ?? 1;
      const derivedMaxHp = 100 + Math.max(0, level - 1) * 10;
      this.gs.currentGalaxyIndex = saveData.galaxy ?? 0;
      this.gs.prestigeLevel = saveData.prestige_level ?? 0;
      this.gs.level = level;
      this.gs.xp = saveData.xp ?? 0;
      this.gs.resources = saveData.resources ?? { iron: 0, nickel: 0 };
      this.gs.maxHp = saveData.maxHp ?? derivedMaxHp;
      this.gs.hp = Math.min(saveData.hp ?? this.gs.maxHp, this.gs.maxHp);
      this.gs.shield = saveData.shield ?? 0;
      this.gs.skillLevels = saveData.skillLevels ?? {};
      this.gs.unlockedGalaxies = Array.isArray(saveData.unlockedGalaxies) ? [...new Set(saveData.unlockedGalaxies)].sort((a, b) => a - b) : [...derivedUnlocked].sort((a, b) => a - b);
      this.gs.completedGalaxies = completedGalaxies;
      this.gs.bossesKilledInGalaxy = saveData.bossesKilledInGalaxy ?? {};
      this.gs.bossProgressCollected = saveData.bossProgressCollected ?? 0;
      this.gs.bossProgressNeeded = saveData.bossProgressNeeded ?? 200;
      this.gs.bossProgressActive = saveData.bossProgressActive ?? false;
      this.gs.bossState = saveData.bossState ? structuredClone(saveData.bossState) : null;
      this.gs.baseExpeditionTime = saveData.baseExpeditionTime ?? 15;
      this.gs.expeditionTimeBonus = saveData.expeditionTimeBonus ?? 0;
      this.gs.autoMineTimer = 0;
      this.gs.statistics = { ...this.gs.statistics, ...saveData.statistics };
      if (saveData.combo) {
        this.gs.combo.count = saveData.combo.count ?? 0;
        this.gs.combo.bestCombo = saveData.combo.bestCombo ?? 0;
      }
    }
    _getAllSaves() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { auto: null, slots: {} };
      } catch {
        return { auto: null, slots: {} };
      }
    }
    update(dt) {
      this.autoSaveTimer += dt * 1e3;
      if (this.autoSaveTimer >= this.autoSaveInterval) {
        this.autoSaveTimer = 0;
        this.autoSave();
      }
    }
  };

  // js/systems/SkillTree.js
  var SkillTree = class {
    constructor(gameState) {
      this.gs = gameState;
      this.data = null;
    }
    loadData(skillData) {
      this.data = skillData;
    }
    getNodes() {
      return this.data?.nodes || [];
    }
    getNode(nodeId) {
      return this.getNodes().find((node) => node.id === nodeId) || null;
    }
    getNodeLevel(nodeId) {
      return this.gs.skillLevels[nodeId] || 0;
    }
    getNodeCost(nodeId) {
      const node = this.getNode(nodeId);
      if (!node) return Infinity;
      const level = this.getNodeLevel(nodeId);
      return Math.floor(node.baseCost * Math.pow(node.costScale || 1, level));
    }
    canUnlock(nodeId) {
      const node = this.getNode(nodeId);
      if (!node) return false;
      if (this.getNodeLevel(nodeId) >= node.maxLevel) return false;
      if ((this.gs.resources[node.costResource] || 0) < this.getNodeCost(nodeId)) return false;
      for (const req of node.requires || []) {
        if (this.getNodeLevel(req) <= 0) return false;
      }
      return true;
    }
    unlock(nodeId) {
      if (!this.canUnlock(nodeId)) return false;
      const node = this.getNode(nodeId);
      const cost = this.getNodeCost(nodeId);
      if (!this.gs.removeResource(node.costResource, cost)) return false;
      this.gs.skillLevels[nodeId] = (this.gs.skillLevels[nodeId] || 0) + 1;
      this.gs.emit("skillUpgraded", {
        nodeId,
        level: this.getNodeLevel(nodeId),
        cost,
        resource: node.costResource
      });
      return true;
    }
    getTotalEffect(effectType) {
      let total = 0;
      for (const node of this.getNodes()) {
        const level = this.getNodeLevel(node.id);
        if (level > 0 && node.effect.type === effectType) {
          total += node.effect.value * level;
        }
      }
      return total;
    }
    getNodeState(nodeId) {
      const node = this.getNode(nodeId);
      const level = this.getNodeLevel(nodeId);
      return {
        node,
        level,
        canUnlock: this.canUnlock(nodeId),
        isOwned: level > 0,
        isMaxed: level >= (node?.maxLevel || 0),
        cost: this.getNodeCost(nodeId)
      };
    }
  };

  // js/utils/Audio.js
  var Audio = class {
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
      if (this.ctx && this.ctx.state === "suspended") {
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
      gain.gain.exponentialRampToValueAtTime(1e-3, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
    }
    clickHit(comboLevel) {
      const baseFreq = 440 + Math.min(comboLevel, 20) * 30;
      this._play(baseFreq, "square", 0.05, 0.15);
    }
    asteroidDestroy(size) {
      const freq = 150 + size * 50;
      this._play(freq, "sawtooth", 0.15, 0.2);
      setTimeout(() => this._play(freq * 1.5, "square", 0.08, 0.1), 30);
    }
    criticalHit() {
      this._play(200, "sawtooth", 0.3, 0.3);
      this._play(100, "square", 0.4, 0.2, -50);
      setTimeout(() => this._play(800, "sine", 0.2, 0.15), 50);
    }
    upgrade() {
      this._play(523, "square", 0.08, 0.15);
      setTimeout(() => this._play(659, "square", 0.08, 0.15), 80);
      setTimeout(() => this._play(784, "square", 0.12, 0.15), 160);
    }
    comboMilestone(level) {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => {
        setTimeout(() => this._play(n, "sine", 0.15, 0.2), i * 60);
      });
    }
    bossPhase() {
      this._play(120, "sawtooth", 0.5, 0.25);
      this._play(80, "square", 0.6, 0.2, -100);
    }
    bossKill() {
      const notes = [523, 659, 784, 1047, 1319, 1568];
      notes.forEach((n, i) => {
        setTimeout(() => this._play(n, "sine", 0.3, 0.25), i * 80);
      });
      setTimeout(() => {
        this._play(100, "sawtooth", 0.8, 0.3);
        this._play(200, "square", 0.6, 0.2);
      }, 500);
    }
    newGalaxy() {
      const notes = [392, 523, 659, 784, 1047];
      notes.forEach((n, i) => {
        setTimeout(() => this._play(n, "sine", 0.4, 0.2), i * 120);
      });
      setTimeout(() => this._play(1568, "sine", 0.8, 0.3), 600);
    }
    achievement() {
      this._play(880, "sine", 0.1, 0.15);
      setTimeout(() => this._play(1100, "sine", 0.15, 0.15), 100);
    }
    sell() {
      this._play(600, "square", 0.05, 0.12);
      setTimeout(() => this._play(800, "square", 0.05, 0.12), 50);
    }
    error() {
      this._play(200, "sawtooth", 0.15, 0.15);
    }
    tick() {
      this._play(1200, "sine", 0.02, 0.05);
    }
  };
  var audio = new Audio();

  // js/data/galaxies.js
  var galaxies_default = [
    {
      "id": "asteroid_belt",
      "name": "Pas Asteroid",
      "index": 0,
      "description": "G\u0119ste pole asteroid na obrze\u017Cach Uk\u0142adu S\u0142onecznego. Idealne miejsce na start.",
      "bgColor": "#0a0a1a",
      "asteroidColor": "#8a8a8a",
      "starDensity": 60,
      "resources": ["iron", "nickel"],
      "asteroidHP": { "base": 45, "scale": 1.2 },
      "asteroidSpawnRate": 1.2,
      "unlockCost": {},
      "boss": {
        "name": "Wielka Asteroida",
        "hp": 2200,
        "color": "#a0522d",
        "phases": [
          { "hpPercent": 100, "attackInterval": 4, "attackDamage": 5 },
          { "hpPercent": 40, "attackInterval": 2.5, "attackDamage": 8 }
        ],
        "reward": { "resources": { "iron": 90, "nickel": 35 }, "xp": 20 }
      }
    },
    {
      "id": "orion_nebula",
      "name": "Mg\u0142awica Oriona",
      "index": 1,
      "description": "Kolorowe gazy i \u015Bwiec\u0105ce asteroidy pe\u0142ne cennych surowc\xF3w.",
      "bgColor": "#0d0a1a",
      "asteroidColor": "#6a5acd",
      "starDensity": 80,
      "resources": ["iron", "nickel", "helium3", "star_crystal"],
      "asteroidHP": { "base": 360, "scale": 1.22 },
      "asteroidSpawnRate": 1,
      "unlockCost": { "iron": 180, "nickel": 90 },
      "boss": {
        "name": "Gwiezdny Lewiatan",
        "hp": 22e3,
        "color": "#ff6347",
        "phases": [
          { "hpPercent": 100, "attackInterval": 3, "attackDamage": 15 },
          { "hpPercent": 60, "attackInterval": 2, "attackDamage": 20 },
          { "hpPercent": 20, "attackInterval": 1.2, "attackDamage": 30 }
        ],
        "reward": { "resources": { "helium3": 45, "star_crystal": 18 }, "xp": 35 }
      }
    },
    {
      "id": "binary_system",
      "name": "Uk\u0142ad Podw\xF3jny",
      "index": 2,
      "description": "Dwa s\u0142o\u0144ca tworz\u0105 grawitacyjny chaos pe\u0142en bogatych z\u0142\xF3\u017C.",
      "bgColor": "#1a0a0a",
      "asteroidColor": "#cd853f",
      "starDensity": 100,
      "resources": ["iron", "nickel", "helium3", "star_crystal", "antimatter", "degenerate"],
      "asteroidHP": { "base": 2250, "scale": 1.25 },
      "asteroidSpawnRate": 0.9,
      "unlockCost": { "helium3": 110, "star_crystal": 55 },
      "boss": {
        "name": "Binarna Gwiazda",
        "hp": 22e4,
        "color": "#ffd700",
        "phases": [
          { "hpPercent": 100, "attackInterval": 2.5, "attackDamage": 40 },
          { "hpPercent": 50, "attackInterval": 1.5, "attackDamage": 60 }
        ],
        "reward": { "resources": { "antimatter": 30, "degenerate": 12 }, "xp": 55 }
      }
    },
    {
      "id": "black_hole_proxima",
      "name": "Czarna Dziura Proxima",
      "index": 3,
      "description": "Zakrzywienie czasoprzestrzeni ukrywa najrzadsze materia\u0142y wszech\u015Bwiata.",
      "bgColor": "#050510",
      "asteroidColor": "#4b0082",
      "starDensity": 40,
      "resources": ["antimatter", "degenerate", "dark_matter", "exotic_particle"],
      "asteroidHP": { "base": 15e3, "scale": 1.25 },
      "asteroidSpawnRate": 0.8,
      "unlockCost": { "antimatter": 70, "degenerate": 30 },
      "boss": {
        "name": "Horyzont Zdarze\u0144",
        "hp": 22e5,
        "color": "#1a0033",
        "phases": [
          { "hpPercent": 100, "attackInterval": 2, "attackDamage": 100, "timer": 120 },
          { "hpPercent": 30, "attackInterval": 1, "attackDamage": 200, "timer": 60 }
        ],
        "reward": { "resources": { "dark_matter": 18, "exotic_particle": 8 }, "xp": 85 }
      }
    },
    {
      "id": "dwarf_galaxy",
      "name": "Galaktyka Kar\u0142owata",
      "index": 4,
      "description": "G\u0119ste pole neonowych asteroid w ma\u0142ej galaktyce satelitarnej.",
      "bgColor": "#0a1a0a",
      "asteroidColor": "#00ff7f",
      "starDensity": 120,
      "resources": ["dark_matter", "exotic_particle", "neutrino_quartz", "fusionium"],
      "asteroidHP": { "base": 11e4, "scale": 1.25 },
      "asteroidSpawnRate": 0.7,
      "unlockCost": { "dark_matter": 28, "exotic_particle": 12 },
      "boss": {
        "name": "Gwiezdny \u017Buk",
        "hp": 22e6,
        "color": "#00ff7f",
        "phases": [
          { "hpPercent": 100, "attackInterval": 1.5, "attackDamage": 250, "swarm": true },
          { "hpPercent": 50, "attackInterval": 1, "attackDamage": 400, "swarm": true }
        ],
        "reward": { "resources": { "neutrino_quartz": 10, "fusionium": 5 }, "xp": 120 }
      }
    },
    {
      "id": "supernova_remnant",
      "name": "Supernova Remnant",
      "index": 5,
      "description": "Niestabilne pozosta\u0142o\u015Bci pot\u0119\u017Cnej eksplozji gwiazdy.",
      "bgColor": "#1a0a05",
      "asteroidColor": "#ff4500",
      "starDensity": 90,
      "resources": ["neutrino_quartz", "fusionium", "plasma", "neutron_core"],
      "asteroidHP": { "base": 9e5, "scale": 1.28 },
      "asteroidSpawnRate": 0.6,
      "unlockCost": { "neutrino_quartz": 15, "fusionium": 7 },
      "boss": {
        "name": "Resztki Supernovej",
        "hp": 22e7,
        "color": "#ff4500",
        "phases": [
          { "hpPercent": 100, "attackInterval": 1.2, "attackDamage": 800 },
          { "hpPercent": 60, "attackInterval": 0.8, "attackDamage": 1200, "enrageTimer": 90 },
          { "hpPercent": 20, "attackInterval": 0.5, "attackDamage": 2e3 }
        ],
        "reward": { "resources": { "plasma": 6, "neutron_core": 3 }, "xp": 170 }
      }
    },
    {
      "id": "galactic_center",
      "name": "Centrum Galaktyki",
      "index": 6,
      "description": "Samo serce galaktyki. Kosmiczny horror i niesko\u0144czona moc.",
      "bgColor": "#0a0005",
      "asteroidColor": "#ff00ff",
      "starDensity": 150,
      "resources": ["plasma", "neutron_core", "exotic_matter", "quantum_string"],
      "asteroidHP": { "base": 75e5, "scale": 1.3 },
      "asteroidSpawnRate": 0.5,
      "unlockCost": { "plasma": 8, "neutron_core": 4 },
      "boss": {
        "name": "SINGULARITY",
        "hp": 45e8,
        "color": "#ff00ff",
        "phases": [
          { "hpPercent": 100, "attackInterval": 1, "attackDamage": 3e3 },
          { "hpPercent": 70, "attackInterval": 0.7, "attackDamage": 5e3 },
          { "hpPercent": 40, "attackInterval": 0.4, "attackDamage": 8e3 },
          { "hpPercent": 10, "attackInterval": 0.2, "attackDamage": 15e3 }
        ],
        "reward": { "resources": { "exotic_matter": 2, "quantum_string": 1 }, "xp": 250 }
      }
    }
  ];

  // js/data/skills.js
  var skills_default = {
    nodes: [
      {
        id: "iron_lattice",
        name: "Iron Lattice",
        description: "Grubsza wi\u0105zka zwi\u0119ksza bazowe obra\u017Cenia klikni\u0119cia.",
        costResource: "iron",
        baseCost: 24,
        costScale: 1.55,
        maxLevel: 5,
        effect: { type: "click_damage_flat", value: 4 },
        requires: [],
        position: { x: 750, y: 350 }
      },
      {
        id: "nickel_focus",
        name: "Nickel Focus",
        description: "Stabilizacja rdzenia zwi\u0119ksza mnoznik klikniecia.",
        costResource: "nickel",
        baseCost: 20,
        costScale: 1.6,
        maxLevel: 4,
        effect: { type: "click_damage_mult", value: 0.12 },
        requires: ["iron_lattice"],
        position: { x: 750, y: 210 }
      },
      {
        id: "helium_scope",
        name: "Helium Scope",
        description: "Lepsza kalibracja daje wiecej critow.",
        costResource: "helium3",
        baseCost: 34,
        costScale: 1.65,
        maxLevel: 4,
        effect: { type: "crit_chance", value: 0.03 },
        requires: ["nickel_focus"],
        position: { x: 750, y: 70 }
      },
      {
        id: "degenerate_radar",
        name: "Degenerate Radar",
        description: "Szybciej namierzasz cele bossowe w danej galaktyce.",
        costResource: "degenerate",
        baseCost: 12,
        costScale: 1.9,
        maxLevel: 3,
        effect: { type: "boss_progress", value: 0.18 },
        requires: ["helium_scope"],
        position: { x: 750, y: -70 }
      },
      {
        id: "crystal_clock",
        name: "Crystal Clock",
        description: "Gwiezdne kryszta\u0142y wydluzaja czas wyprawy.",
        costResource: "star_crystal",
        baseCost: 28,
        costScale: 1.7,
        maxLevel: 3,
        effect: { type: "expedition_time", value: 4 },
        requires: ["iron_lattice"],
        position: { x: 890, y: 350 }
      },
      {
        id: "antimatter_yield",
        name: "Antimatter Yield",
        description: "Lepszy recykling daje wiecej surowcow z kazdego runu.",
        costResource: "antimatter",
        baseCost: 16,
        costScale: 1.85,
        maxLevel: 4,
        effect: { type: "resource_mult", value: 0.15 },
        requires: ["crystal_clock"],
        position: { x: 1030, y: 350 }
      },
      {
        id: "darkmatter_armor",
        name: "Darkmatter Armor",
        description: "Pancerz z ciemnej materii daje wiecej zycia.",
        costResource: "dark_matter",
        baseCost: 10,
        costScale: 2,
        maxLevel: 4,
        effect: { type: "max_hp", value: 0.15 },
        requires: ["antimatter_yield"],
        position: { x: 1170, y: 350 }
      },
      {
        id: "particle_barrier",
        name: "Particle Barrier",
        description: "Egzotyczne czastki zamieniaja czesc HP w tarcze.",
        costResource: "exotic_particle",
        baseCost: 8,
        costScale: 2,
        maxLevel: 3,
        effect: { type: "shield", value: 0.08 },
        requires: ["iron_lattice"],
        position: { x: 750, y: 490 }
      },
      {
        id: "neutrino_repair",
        name: "Neutrino Repair",
        description: "Kwarc neutrinowy aktywuje pasywna regeneracje.",
        costResource: "neutrino_quartz",
        baseCost: 6,
        costScale: 2.1,
        maxLevel: 3,
        effect: { type: "passive_regen", value: 0.015 },
        requires: ["particle_barrier"],
        position: { x: 750, y: 630 }
      },
      {
        id: "fusion_overload",
        name: "Fusion Overload",
        description: "Fuzjonium wzmacnia krytyczne trafienia.",
        costResource: "fusionium",
        baseCost: 5,
        costScale: 2.15,
        maxLevel: 3,
        effect: { type: "crit_mult", value: 0.5 },
        requires: ["neutrino_repair"],
        position: { x: 750, y: 770 }
      },
      {
        id: "plasma_refinery",
        name: "Plasma Refinery",
        description: "Plazma podbija wydajnosc kazdego zniszczonego celu.",
        costResource: "plasma",
        baseCost: 4,
        costScale: 2.2,
        maxLevel: 3,
        effect: { type: "resource_mult", value: 0.22 },
        requires: ["iron_lattice"],
        position: { x: 610, y: 350 }
      },
      {
        id: "neutron_driver",
        name: "Neutron Driver",
        description: "Rdzen neutronowy daje brutalny mnoznik klikniecia.",
        costResource: "neutron_core",
        baseCost: 3,
        costScale: 2.25,
        maxLevel: 3,
        effect: { type: "click_damage_mult", value: 0.25 },
        requires: ["plasma_refinery"],
        position: { x: 470, y: 350 }
      },
      {
        id: "exotic_timefold",
        name: "Exotic Timefold",
        description: "Materia egzotyczna rozciaga limit czasu runu.",
        costResource: "exotic_matter",
        baseCost: 2,
        costScale: 2.3,
        maxLevel: 2,
        effect: { type: "expedition_time", value: 8 },
        requires: ["neutron_driver"],
        position: { x: 330, y: 350 }
      },
      {
        id: "quantum_verdict",
        name: "Quantum Verdict",
        description: "Ostatni wezel: ogromny boost obrazen i critow.",
        costResource: "quantum_string",
        baseCost: 1,
        costScale: 2.5,
        maxLevel: 2,
        effect: { type: "click_damage_mult", value: 0.4 },
        requires: ["exotic_timefold"],
        position: { x: 190, y: 350 }
      }
    ]
  };

  // js/data/resources.js
  var resources_default = {
    "resources": {
      "iron": { "name": "\u017Belazo", "color": "#a8a8a8", "value": 1 },
      "nickel": { "name": "Nikiel", "color": "#c0c0c0", "value": 2 },
      "helium3": { "name": "Hel-3", "color": "#87ceeb", "value": 8 },
      "star_crystal": { "name": "Kryszta\u0142 Gwiezdny", "color": "#e0e0ff", "value": 20 },
      "antimatter": { "name": "Antymateria", "color": "#ff69b4", "value": 80 },
      "degenerate": { "name": "Degenerat", "color": "#dda0dd", "value": 150 },
      "dark_matter": { "name": "Ciemna Materia", "color": "#4b0082", "value": 500 },
      "exotic_particle": { "name": "Cz\u0105stka Egzotyczna", "color": "#9400d3", "value": 1200 },
      "neutrino_quartz": { "name": "Kwarc Neutrinowy", "color": "#00ff7f", "value": 4e3 },
      "fusionium": { "name": "Fuzjonium", "color": "#ff6347", "value": 1e4 },
      "plasma": { "name": "Plazma", "color": "#ff4500", "value": 4e4 },
      "neutron_core": { "name": "Rdze\u0144 Neutronowy", "color": "#ffd700", "value": 15e4 },
      "exotic_matter": { "name": "Materia Egzotyczna", "color": "#ff00ff", "value": 6e5 },
      "quantum_string": { "name": "Struna Kwantowa", "color": "#ffffff", "value": 25e5 }
    },
    "rarities": {
      "common": { "name": "Zwyk\u0142y", "color": "#8a8a8a", "weight": 60 },
      "uncommon": { "name": "Niepospolity", "color": "#50c878", "weight": 25 },
      "rare": { "name": "Rzadki", "color": "#009dff", "weight": 10 },
      "epic": { "name": "Epicki", "color": "#9b59b6", "weight": 4 },
      "legendary": { "name": "Legendarny", "color": "#ff6b35", "weight": 1 }
    }
  };

  // js/game/Game.js
  var Game = class {
    constructor() {
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.gs = new GameState();
      this.particles = new ParticleSystem();
      this.effects = new ScreenEffects();
      this.asteroidMgr = new AsteroidManager();
      this.combo = new ComboSystem(this.gs);
      this.galaxy = new Galaxy(this.gs);
      this.skillTree = new SkillTree(this.gs);
      this.ui = new UIManager(this.gs);
      this.save = new SaveManager(this.gs);
      this.lastFrame = 0;
      this.running = false;
      this.stars = [];
      this.clickDamage = 15;
      this.critChance = 0.05;
      this.critMult = 3;
      this.resourceMult = 1;
      this.damageMult = 1;
      this.maxShield = 0;
      this.passiveRegenPerSecond = 0;
      this.xpMult = 1;
      this.bossProgressMult = 1;
      this.bonusResourceChance = 0;
      this.rareDropMult = 1;
      this.expeditionTimeBonus = 0;
      this.boss = null;
      this._pendingClicks = [];
      this._setupEvents();
    }
    async init() {
      this._resizeCanvas();
      window.addEventListener("resize", () => this._resizeCanvas());
      audio.init();
      this.galaxy.loadData(galaxies_default);
      this.skillTree.loadData(skills_default);
      this.resourcesData = resources_default;
      if (this.save.hasAutoSave()) {
        this.save.loadAutoSave();
      }
      this.galaxy.loadData(galaxies_default);
      this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
      this._generateStars();
      this.boss = this.gs.bossState;
      this._recalcStats();
      if (this.boss?.alive) {
        this._showBossBar();
        this._renderBossHP();
      }
      this._updateBossProgress();
      this.ui.initRollers();
      this._setupGameListeners();
      this._updateMenuVisibility();
      this._updateStartButton();
      this.gs.emit("gameReady", {});
      this.running = true;
      requestAnimationFrame((t) => this._loop(t));
    }
    _resizeCanvas() {
      const container = this.canvas.parentElement;
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.ctx.imageSmoothingEnabled = false;
      this._generateStars();
    }
    _generateStars() {
      this.stars = [];
      const count = this.galaxy.getCurrent()?.starDensity || 60;
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          size: Math.random() * 2 + 0.5,
          brightness: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 2 + 1,
          twinkleOffset: Math.random() * Math.PI * 2
        });
      }
    }
    _setupEvents() {
      this.canvas.addEventListener("click", (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this._pendingClicks.push({ x, y });
        audio.resume();
      });
      this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this._togglePause();
        }
      });
    }
    _setupGameListeners() {
      this.gs.on("levelUp", () => {
        audio.upgrade();
        this.effects.shake(5, 0.3);
        this.particles.emitScreenFlash("#f0c040", 0.2);
        this._recalcStats();
        this._updateMenuVisibility();
      });
      this.gs.on("comboMilestone", ({ level }) => {
        audio.comboMilestone(level);
        this.effects.shake(level / 5, 0.3);
      });
      this.gs.on("galaxyUnlocked", ({ index }) => {
        audio.newGalaxy();
        this.effects.shake(10, 0.5);
        this._clearBossEncounter();
        this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
        this._generateStars();
        this._recalcStats();
        this._updateMenuVisibility();
      });
      this.gs.on("galaxyTraveled", ({ index }) => {
        audio.newGalaxy();
        this.effects.shake(5, 0.3);
        this._clearBossEncounter();
        this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
        this._generateStars();
        this._recalcStats();
        this._updateMenuVisibility();
      });
      this.gs.on("bossSpawn", ({ data }) => {
        audio.bossPhase();
        this.effects.shake(8, 0.4);
        this.boss = {
          ...data,
          phases: data.phases.map((phase) => ({
            ...phase,
            remainingTime: phase.timer ?? null,
            remainingEnrage: phase.enrageTimer ?? null
          })),
          currentHp: data.hp,
          maxHp: data.hp,
          phaseIndex: 0,
          attackTimer: data.phases[0].attackInterval,
          alive: true
        };
        this.gs.bossState = this.boss;
        this._showBossBar();
      });
      this.gs.on("bossDefeated", ({ reward }) => {
        audio.bossKill();
        this.effects.shake(12, 0.6);
        this.particles.emitScreenFlash("#ffd700", 0.3);
        this._clearBossEncounter();
        const label = Object.entries(reward.resources || {}).map(([key, value]) => `+${formatNumber(value)} ${this.resourcesData?.resources[key]?.name || key}`).join("  ");
        if (label) {
          this.ui.addFloatingText(this.canvas.width / 2, 90, label, "#ffd700", 20);
        }
      });
      this.gs.on("skillUpgraded", () => {
        audio.upgrade();
        this._recalcStats();
      });
      this.gs.on("playerDied", () => {
        this.effects.shake(10, 0.5);
        this.particles.emitScreenFlash("#ff0000", 0.3);
        this.gs.hp = this.gs.maxHp;
        this.gs.shield = this.gs.maxShield;
        if (this.boss && this.boss.alive) {
          this.galaxy.bossActive = false;
          this.galaxy.bossResourcesCollected = 0;
          this.galaxy._syncBossProgress();
          this._clearBossEncounter();
        }
      });
      this.gs.on("expeditionStart", () => {
        this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
        this._updateMenuVisibility();
        this._updateStartButton();
        const timer = document.getElementById("expedition-timer");
        if (timer) timer.style.display = "block";
      });
      this.gs.on("expeditionEnd", () => {
        this.asteroidMgr.asteroids = [];
        this._updateMenuVisibility();
        this._updateStartButton();
        const timer = document.getElementById("expedition-timer");
        if (timer) timer.style.display = "none";
        this._showRunSummary();
      });
    }
    _recalcStats() {
      const stats = calculateCombatStats({
        gs: this.gs,
        skillTree: this.skillTree
      });
      this.clickDamage = stats.clickDamage;
      this.critChance = stats.critChance;
      this.critMult = stats.critMult;
      this.resourceMult = stats.resourceMult;
      this.damageMult = stats.damageMult;
      this.maxShield = stats.maxShield;
      this.passiveRegenPerSecond = stats.passiveRegenPerSecond;
      this.xpMult = stats.xpMult;
      this.bossProgressMult = stats.bossProgressMult;
      this.bonusResourceChance = stats.bonusResourceChance;
      this.rareDropMult = stats.rareDropMult;
      this.expeditionTimeBonus = stats.expeditionTimeBonus;
      this.gs.expeditionTimeBonus = stats.expeditionTimeBonus;
      const hpRatio = this.gs.maxHp > 0 ? this.gs.hp / this.gs.maxHp : 1;
      this.gs.maxHp = Math.max(100, Math.round(stats.maxHp));
      this.gs.hp = Math.min(this.gs.maxHp, this.gs.maxHp * hpRatio);
      this.gs.maxShield = Math.round(stats.maxShield);
      this.gs.shield = Math.min(this.gs.shield, this.gs.maxShield);
      this._updateEquipmentDisplay();
    }
    _loop(timestamp) {
      if (!this.running) {
        requestAnimationFrame((t) => this._loop(t));
        return;
      }
      const dt = Math.min((timestamp - this.lastFrame) / 1e3, 0.05);
      this.lastFrame = timestamp;
      this._update(dt);
      this._render(dt);
      this.gs.flushNotifications();
      requestAnimationFrame((t) => this._loop(t));
    }
    _update(dt) {
      this.gs.statistics.playtime += dt;
      if (this.gs.isExpeditionActive()) {
        this._processClicks();
        this.combo.update(dt);
        this.asteroidMgr.update(dt, this.canvas.width, this.canvas.height, 6 + this.gs.currentGalaxyIndex * 2);
        this.particles.update(dt);
        this.effects.update(dt);
        if (this.passiveRegenPerSecond > 0) {
          this.gs.heal(this.passiveRegenPerSecond * dt);
        }
        if (this.boss && this.boss.alive) {
          this._updateBoss(dt);
        }
        this._updateExpeditionTimer(dt);
      } else {
        this.particles.update(dt);
        this.effects.update(dt);
      }
      this.ui.update(dt);
      this.save.update(dt);
      this.ui.updateHUD();
      this.ui.updateCombo(this.combo.getComboData());
    }
    _updateExpeditionTimer(dt) {
      const ex = this.gs.expeditionState;
      if (!ex.active) return;
      ex.timeRemaining -= dt;
      if (ex.maxCombo < this.combo.count) {
        ex.maxCombo = this.combo.count;
      }
      const timerEl = document.getElementById("expedition-time");
      if (timerEl) {
        const time = Math.max(0, Math.ceil(ex.timeRemaining));
        timerEl.textContent = `${time}s`;
        if (ex.timeRemaining <= 5) {
          timerEl.style.color = "#ff4444";
        } else if (ex.timeRemaining <= 10) {
          timerEl.style.color = "#f0c040";
        } else {
          timerEl.style.color = "#00ff88";
        }
      }
      if (ex.timeRemaining <= 0) {
        this.gs.endExpedition();
      }
    }
    _processClicks() {
      for (const click of this._pendingClicks) {
        this._handleClick(click.x, click.y);
      }
      this._pendingClicks = [];
    }
    _handleClick(x, y) {
      if (!this.gs.isExpeditionActive()) return;
      this.gs.recordClick();
      this.combo.registerClick();
      audio.clickHit(this.combo.count);
      if (this.boss && this.boss.alive) {
        this._damageBoss(x, y);
        return;
      }
      const asteroid = this.asteroidMgr.getAsteroidAt(x, y);
      if (asteroid) {
        let damage = this.clickDamage * this.combo.multiplier;
        let isCrit = Math.random() < this.critChance;
        if (isCrit) {
          damage *= this.critMult;
          audio.criticalHit();
          this.effects.shake(6, 0.3);
          this.particles.emitCritical(x, y);
          this.ui.addFloatingText(x, y - 30, `CRIT! ${formatNumber(damage)}`, "#ff0040", 36);
        } else {
          this.ui.addFloatingText(x, y - 20, formatNumber(damage), "#009dff", 28);
        }
        const killed = asteroid.takeDamage(damage);
        this.gs.statistics.totalDamage += damage;
        this.particles.emitTrail(x, y, isCrit ? "#ff0040" : "#009dff");
        if (killed) {
          this._onAsteroidKilled(asteroid);
        }
      }
    }
    _onAsteroidKilled(asteroid) {
      this.gs.recordAsteroidDestroyed(1 * this.xpMult);
      audio.asteroidDestroy(asteroid.radius / 20);
      this.effects.shakeByScore(asteroid.maxHp);
      this.particles.emitExplosion(asteroid.x, asteroid.y, asteroid.color, asteroid.radius / 30);
      const galaxyData = this.galaxy.getCurrent();
      if (galaxyData) {
        const res = galaxyData.resources;
        const mainRes = res[0];
        const amount = asteroid.maxHp / 15 * this.resourceMult;
        this.gs.addResource(mainRes, amount);
        this.particles.emitResource(asteroid.x, asteroid.y, this.resourcesData?.resources[mainRes]?.color || "#fff");
        this.ui.addFloatingText(asteroid.x, asteroid.y + 20, `+${formatNumber(amount)} ${mainRes}`, "#50c878", 20);
        if (this.gs.expeditionState.active) {
          if (!this.gs.expeditionState.resourcesGathered[mainRes]) {
            this.gs.expeditionState.resourcesGathered[mainRes] = 0;
          }
          this.gs.expeditionState.resourcesGathered[mainRes] += amount;
        }
        if (res.length > 1 && Math.random() < Math.min(1, 0.25 + this.bonusResourceChance)) {
          const bonusRes = res[Math.floor(Math.random() * res.length)];
          const bonusAmount = amount * 0.15;
          this.gs.addResource(bonusRes, bonusAmount);
        }
        if (this.gs.expeditionState.active) {
          this.gs.expeditionState.score += amount;
        }
        this.galaxy.addBossProgress(amount * this.bossProgressMult);
        this._updateBossProgress();
      }
    }
    _updateBoss(dt) {
      const boss = this.boss;
      const phase = boss.phases[boss.phaseIndex];
      boss.attackTimer -= dt;
      if (phase.timer) {
        phase.remainingTime = (phase.remainingTime ?? phase.timer) - dt;
        if (phase.remainingTime <= 0) {
          this.gs.takeDamage(this.gs.maxHp);
          phase.remainingTime = phase.timer;
        }
      }
      if (phase.enrageTimer) {
        phase.remainingEnrage = (phase.remainingEnrage ?? phase.enrageTimer) - dt;
        if (phase.remainingEnrage <= 0) {
          boss.attackTimer = Math.min(boss.attackTimer, phase.attackInterval * 0.5);
        }
      }
      if (boss.attackTimer <= 0) {
        boss.attackTimer = phase.attackInterval;
        if (phase.enrageTimer && phase.remainingEnrage <= 0) {
          boss.attackTimer *= 0.5;
        }
        this.gs.takeDamage(phase.attackDamage);
        this.effects.shake(3, 0.2);
        this.ui.addFloatingText(
          this.canvas.width / 2,
          60,
          `-${phase.attackDamage}`,
          "#fe5f55",
          32
        );
      }
      if (boss.currentHp <= boss.maxHp * boss.phases[boss.phaseIndex + 1]?.hpPercent / 100) {
        boss.phaseIndex++;
        audio.bossPhase();
        this.effects.shake(5, 0.3);
      }
      this._renderBossHP();
    }
    _damageBoss(x, y) {
      const boss = this.boss;
      let damage = this.clickDamage * this.combo.multiplier;
      let isCrit = Math.random() < this.critChance;
      if (isCrit) {
        damage *= this.critMult;
        audio.criticalHit();
        this.particles.emitCritical(x, y);
      }
      boss.currentHp -= damage;
      this.gs.statistics.totalDamage += damage;
      this.effects.shake(isCrit ? 4 : 2, 0.15);
      this.particles.emitTrail(x, y, isCrit ? "#ff0040" : "#f0c040");
      this.ui.addFloatingText(x, y - 20, formatNumber(damage), isCrit ? "#ff0040" : "#f0c040", isCrit ? 36 : 28);
      audio.clickHit(this.combo.count);
      if (boss.currentHp <= 0) {
        boss.alive = false;
        this.galaxy.setBossDefeated();
      }
    }
    _render(dt) {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      this.effects.applyTransform(ctx);
      this._renderBackground(ctx, w, h);
      if (this.gs.isExpeditionActive()) {
        this.asteroidMgr.render(ctx);
        this.particles.render(ctx, w, h);
        this.ui.renderFloatingTexts(ctx);
        if (this.boss && this.boss.alive) {
          this._renderBoss(ctx, w, h);
        }
      } else {
        this.particles.render(ctx, w, h);
      }
      ctx.restore();
    }
    _renderBackground(ctx, w, h) {
      const bgColor = this.galaxy.getCurrent()?.bgColor || "#0a0a1a";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      const time = performance.now() / 1e3;
      for (const star of this.stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        ctx.globalAlpha = star.brightness * twinkle;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    _renderBoss(ctx, w, h) {
      const boss = this.boss;
      const bx = w / 2;
      const by = 120;
      const radius = 60;
      ctx.save();
      ctx.globalAlpha = 0.8;
      const pulse = 1 + Math.sin(performance.now() / 200) * 0.05;
      ctx.beginPath();
      ctx.arc(bx, by, radius * pulse, 0, Math.PI * 2);
      ctx.fillStyle = boss.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = '24px "Silkscreen", monospace';
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(boss.name, bx, by + 5);
      ctx.restore();
    }
    _showBossBar() {
      const bar = document.getElementById("boss-bar");
      if (bar) bar.style.display = "flex";
    }
    _hideBossBar() {
      const bar = document.getElementById("boss-bar");
      if (bar) bar.style.display = "none";
    }
    _renderBossHP() {
      if (!this.boss) return;
      const fill = document.getElementById("boss-hp-fill");
      const text = document.getElementById("boss-hp-text");
      if (fill) fill.style.width = `${this.boss.currentHp / this.boss.maxHp * 100}%`;
      if (text) text.textContent = `${formatNumber(this.boss.currentHp)} / ${formatNumber(this.boss.maxHp)}`;
    }
    _updateBossProgress() {
      const prog = this.galaxy.getBossProgress();
      const fill = document.getElementById("boss-progress-fill");
      const text = document.getElementById("boss-progress-text");
      if (fill) fill.style.width = `${prog.percent}%`;
      if (text) text.textContent = prog.active ? "BOSS!" : `${Math.floor(prog.percent)}%`;
    }
    _clearBossEncounter() {
      this.boss = null;
      this.gs.bossState = null;
      this._hideBossBar();
      this._updateBossProgress();
    }
    startExpedition() {
      if (this.gs.isExpeditionActive()) return;
      this.gs.startExpedition();
    }
    travelToGalaxy(index) {
      if (index === this.gs.currentGalaxyIndex) {
        return { success: false, reason: "already-there" };
      }
      if (this.gs.isExpeditionActive()) {
        return { success: false, reason: "expedition-active" };
      }
      if (this.boss?.alive) {
        return { success: false, reason: "boss-active" };
      }
      return {
        success: this.galaxy.unlock(index),
        reason: "ok"
      };
    }
    _updateMenuVisibility() {
      const inExpedition = this.gs.isExpeditionActive();
      const btns = ["btn-skills", "btn-map", "btn-stats", "btn-settings"];
      for (const id of btns) {
        const btn = document.getElementById(id);
        if (btn) {
          btn.style.opacity = inExpedition ? "0.3" : "1";
          btn.style.pointerEvents = inExpedition ? "none" : "auto";
        }
      }
      const btnGame = document.getElementById("btn-game");
      if (btnGame) {
        btnGame.style.display = inExpedition ? "block" : "none";
      }
      if (inExpedition && window.gameUI) {
        window.gameUI.switchTab("game");
      } else if (!inExpedition && window.gameUI) {
        const gameTab = document.getElementById("tab-game");
        if (gameTab && gameTab.classList.contains("active")) {
          window.gameUI.showSkills();
        }
      }
    }
    _updateStartButton() {
      const btn = document.getElementById("btn-start-expedition");
      if (btn) {
        btn.style.display = this.gs.isExpeditionActive() ? "none" : "block";
      }
    }
    _showRunSummary() {
      const summary = this.gs.expeditionState;
      const panel = document.getElementById("run-summary");
      const content = document.getElementById("run-summary-content");
      if (!panel || !content) return;
      const resEntries = Object.entries(summary.resourcesGathered || {});
      const resHTML = resEntries.length > 0 ? resEntries.map(([key, val], i) => {
        const resInfo = this.resourcesData?.resources[key];
        return `<div class="summary-res summary-row" style="animation-delay: ${0.5 + i * 0.1}s"><span style="color:${resInfo?.color || "#aaa"}">${resInfo?.name || key}</span><span class="summary-val">${formatNumber(val)}</span></div>`;
      }).join("") : '<div style="color:var(--text-dim)" class="summary-row" style="animation-delay: 0.5s">No resources</div>';
      content.innerHTML = `
      <div class="summary-row" style="animation-delay: 0.1s"><span>Destroyed</span><span class="summary-val">${summary.asteroidsDestroyed}</span></div>
      <div class="summary-row" style="animation-delay: 0.2s"><span>Max Combo</span><span class="summary-val gold">x${summary.maxCombo}</span></div>
      <div class="summary-row" style="animation-delay: 0.3s"><span>XP</span><span class="summary-val blue">${formatNumber(Math.floor(summary.xpGained))}</span></div>
      <div class="summary-row" style="animation-delay: 0.4s"><span>Run Score</span><span class="summary-val gold">${formatNumber(Math.floor(summary.score))}</span></div>
      <div class="summary-title" style="margin-top:16px;">Resources</div>
      ${resHTML}
    `;
      panel.style.display = "flex";
    }
    _updateEquipmentDisplay() {
      const equipment = document.getElementById("ui-equipment");
      if (equipment) {
        const currentGalaxy = this.galaxy.getCurrent();
        equipment.textContent = `${currentGalaxy?.name || "Unknown Sector"} // RUN ${this.gs.baseExpeditionTime + this.gs.expeditionTimeBonus}s`;
      }
      const clickDmg = document.getElementById("ui-click-dmg");
      if (clickDmg) clickDmg.textContent = formatNumber(Math.floor(this.clickDamage));
    }
    _togglePause() {
      this.running = !this.running;
      const overlay = document.getElementById("pause-overlay");
      if (overlay) overlay.style.display = this.running ? "none" : "flex";
    }
  };

  // js/app.js
  var game = new Game();
  var resourceInfo = resources_default.resources;
  function resourceChip(resourceId, amount) {
    return `
    <span class="resource-chip">
      <img class="res-icon" src="assets/sprites/resources/${resourceId}.svg" alt="${resourceId}">
      <span>${resourceInfo[resourceId]?.name || resourceId}</span>
      <strong>${Math.ceil(amount)}</strong>
    </span>
  `;
  }
  function renderSkillTree() {
    const shell = document.getElementById("skill-tree-shell");
    const nodes = game.skillTree.getNodes();
    const links = [];
    for (const node of nodes) {
      for (const req of node.requires || []) {
        const parent = game.skillTree.getNode(req);
        if (parent) {
          links.push({
            fromX: parent.position.x + 32,
            fromY: parent.position.y + 32,
            toX: node.position.x + 32,
            toY: node.position.y + 32,
            active: game.skillTree.getNodeLevel(req) > 0
          });
        }
      }
    }
    shell.innerHTML = `
    <div class="skill-tree-shell">
      <div class="skill-tree-board">
        <svg class="skill-tree-connections" viewBox="0 0 1560 700" preserveAspectRatio="none">
          ${links.map((link) => `
            <line
              x1="${link.fromX}"
              y1="${link.fromY}"
              x2="${link.toX}"
              y2="${link.toY}"
              class="${link.active ? "active" : ""}"
            />
          `).join("")}
        </svg>
        ${nodes.map((node) => {
      const state = game.skillTree.getNodeState(node.id);
      const cls = state.isMaxed ? "maxed" : state.isOwned ? "owned" : state.canUnlock ? "available" : "locked";
      return `
            <div
              class="skill-graph-node-wrap"
              style="left:${node.position.x}px; top:${node.position.y}px;"
            >
              <button
                class="skill-graph-node ${cls}"
                onclick="window.gameUI.unlockNode('${node.id}')"
              >
                <img class="skill-node-icon" src="assets/sprites/resources/${node.costResource}.svg" alt="${node.costResource}">
              </button>
              <div class="skill-node-tooltip">
                <div class="skill-node-head">
                  <span>${node.name}</span>
                </div>
                <div class="skill-node-desc">${node.description}</div>
                <div class="skill-node-meta">LV ${state.level}/${node.maxLevel}</div>
                <div class="skill-node-cost">${resourceChip(node.costResource, state.cost)}</div>
              </div>
            </div>
          `;
    }).join("")}
      </div>
    </div>
  `;
    if (window.gameUI && window.gameUI.treeTransform) {
      const board = shell.querySelector(".skill-tree-board");
      if (board) {
        const t = window.gameUI.treeTransform;
        board.style.transformOrigin = "0 0";
        board.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
      }
    }
  }
  window.gameUI = {
    startExpedition() {
      game.startExpedition();
    },
    closeRunSummary() {
      document.getElementById("run-summary").style.display = "none";
    },
    showSkills() {
      if (game.gs.isExpeditionActive()) return;
      renderSkillTree();
      this.switchTab("skills");
    },
    unlockNode(nodeId) {
      if (game.gs.isExpeditionActive()) return;
      game.skillTree.unlock(nodeId);
      renderSkillTree();
    },
    showMap() {
      if (game.gs.isExpeditionActive()) return;
      const container = document.getElementById("map-galaxies");
      const galaxies = game.galaxy.getAllGalaxies();
      container.innerHTML = galaxies.map((g, i) => {
        const isCurrent = i === game.gs.currentGalaxyIndex;
        const cls = isCurrent ? "current" : g.completed ? "completed" : g.unlocked ? "" : "locked";
        const costEntries = Object.entries(g.unlockCost || {});
        const costHtml = costEntries.length > 0 ? `<div class="map-costs">${costEntries.map(([resourceId, amount]) => resourceChip(resourceId, amount)).join("")}</div>` : '<div class="map-free">START ZONE</div>';
        return `
        <div class="map-galaxy ${cls}">
          <div>
            <div class="map-galaxy-name" style="color: ${g.unlocked ? "#e0e0e0" : "#666"}">${i + 1}. ${g.name}</div>
            <div class="map-galaxy-desc">${g.description}</div>
            ${costHtml}
            ${g.bossKilled ? '<div class="map-boss-clear">BOSS CLEARED</div>' : ""}
          </div>
          ${g.canUnlock && !isCurrent ? `<button class="map-galaxy-btn" onclick="window.gameUI.travelTo(${i})">${g.unlocked ? "TRAVEL" : "UNLOCK"}</button>` : ""}
          ${isCurrent ? '<span style="color:var(--blue); font-size:10px;">CURRENT</span>' : ""}
        </div>
      `;
      }).join("");
      this.switchTab("map");
    },
    travelTo(index) {
      const result = game.travelToGalaxy(index);
      if (!result.success && result.reason === "boss-active") {
        alert("Finish the current boss encounter before changing galaxies.");
        return;
      }
      if (!result.success && result.reason === "expedition-active") {
        alert("Return to the station before changing galaxies.");
        return;
      }
      this.showMap();
    },
    showStats() {
      const stats = game.gs.getStatSummary();
      const extendedStats = {
        ...stats,
        "Expedition Time": `${game.gs.baseExpeditionTime + game.gs.expeditionTimeBonus}s`,
        "Click Damage": Math.floor(game.clickDamage),
        "Resource Mult": `${Math.round(game.resourceMult * 100)}%`
      };
      document.getElementById("stats-content").innerHTML = Object.entries(extendedStats).map(
        ([k, v]) => `<div class="settings-row"><span class="settings-label">${k}</span><span class="stat-value">${v}</span></div>`
      ).join("");
      this.switchTab("stats");
    },
    showSettings() {
      this.switchTab("settings");
    },
    closePanel(id) {
      this.switchTab("game");
    },
    switchTab(tabId) {
      if (game.gs.isExpeditionActive() && tabId !== "game") return;
      document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
      const targetTab = document.getElementById(`tab-${tabId}`);
      if (targetTab) targetTab.classList.add("active");
      document.querySelectorAll(".menu-btn").forEach((el) => el.classList.remove("active"));
      const btn = document.getElementById(`btn-${tabId}`);
      if (btn) btn.classList.add("active");
      const crt = document.getElementById("crt-overlay");
      if (crt) {
        crt.style.animation = "none";
        void crt.offsetWidth;
        crt.style.animation = "crtFlicker 0.15s steps(2)";
      }
      const mainArea = document.getElementById("main-area");
      if (mainArea) {
        mainArea.classList.remove("scanline-wipe");
        void mainArea.offsetWidth;
        mainArea.classList.add("scanline-wipe");
      }
    },
    exportSave() {
      const data = game.save.exportSave();
      const textarea = document.getElementById("export-textarea");
      textarea.value = data;
      textarea.style.display = "block";
      navigator.clipboard?.writeText(data);
    },
    showImport() {
      const textarea = document.getElementById("import-textarea");
      textarea.style.display = "block";
      textarea.value = "";
      document.getElementById("import-confirm-row").style.display = "flex";
    },
    importSave() {
      const textarea = document.getElementById("import-textarea");
      const result = game.save.importSave(textarea.value);
      if (result.success) {
        game._recalcStats();
        game._generateStars();
        game.asteroidMgr.setGalaxy(game.galaxy.getCurrent());
        game._updateMenuVisibility();
        game._updateStartButton();
        this.closePanel("panel-settings");
        location.reload();
      } else {
        alert("Invalid save data: " + result.error);
      }
    },
    resetGame() {
      if (confirm("Are you sure? This will delete all progress!")) {
        localStorage.removeItem("singularity_rush_save");
        location.reload();
      }
    }
  };
  game.init();
  window.gameUI.showSkills();
  window.gameUI.treeTransform = { x: 0, y: 0, scale: 1, initialized: false };
  (function initSkillTreePanning() {
    const shell = document.getElementById("skill-tree-shell");
    let isDragging = false;
    let startX, startY;
    function updateTransform() {
      const board = document.querySelector(".skill-tree-board");
      if (board) {
        const t = window.gameUI.treeTransform;
        board.style.transformOrigin = "0 0";
        board.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
      }
    }
    setTimeout(() => {
      if (!window.gameUI.treeTransform.initialized) {
        window.gameUI.treeTransform.x = (shell.clientWidth - 1560) / 2;
        window.gameUI.treeTransform.y = (shell.clientHeight - 700) / 2;
        window.gameUI.treeTransform.initialized = true;
        updateTransform();
      }
    }, 10);
    shell.addEventListener("mousedown", (e) => {
      if (e.target.closest(".skill-graph-node")) return;
      isDragging = true;
      shell.classList.add("dragging");
      startX = e.clientX - window.gameUI.treeTransform.x;
      startY = e.clientY - window.gameUI.treeTransform.y;
    });
    shell.addEventListener("mouseleave", () => {
      isDragging = false;
      shell.classList.remove("dragging");
    });
    shell.addEventListener("mouseup", () => {
      isDragging = false;
      shell.classList.remove("dragging");
    });
    shell.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      window.gameUI.treeTransform.x = e.clientX - startX;
      window.gameUI.treeTransform.y = e.clientY - startY;
      updateTransform();
    });
    shell.addEventListener("wheel", (e) => {
      e.preventDefault();
      const board = document.querySelector(".skill-tree-board");
      if (!board) return;
      const zoomIntensity = 0.1;
      const wheel = e.deltaY < 0 ? 1 : -1;
      const zoom = Math.exp(wheel * zoomIntensity);
      const t = window.gameUI.treeTransform;
      const newScale = Math.min(Math.max(0.3, t.scale * zoom), 3);
      const rect = shell.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const boardX = (mouseX - t.x) / t.scale;
      const boardY = (mouseY - t.y) / t.scale;
      t.x = mouseX - boardX * newScale;
      t.y = mouseY - boardY * newScale;
      t.scale = newScale;
      updateTransform();
    });
  })();
})();
