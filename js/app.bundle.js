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
      this.resources = { resources: 0 };
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
        success: false,
        bossDefeated: false,
        zoneIndex: 0,
        zoneName: "Asteroid Belt",
        resourcesFromAsteroids: 0,
        resourcesFromEnemies: 0,
        resourcesFromBoss: 0,
        resourcesCollected: 0,
        resourcesRetained: 0,
        asteroidsDestroyed: 0,
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
      this.resources[type] += Math.max(0, Math.floor(amount));
      this.statistics.resourcesCollected += Math.max(0, Math.floor(amount));
      this.emit("resourceGained", { type, amount });
    }
    addRunResources(source, amount) {
      const normalizedAmount = Math.max(0, Math.floor(amount));
      if (normalizedAmount <= 0) return 0;
      this.addResource("resources", normalizedAmount);
      if (!this.expeditionState.active) return normalizedAmount;
      if (source === "asteroid") {
        this.expeditionState.resourcesFromAsteroids += normalizedAmount;
      } else if (source === "enemy") {
        this.expeditionState.resourcesFromEnemies += normalizedAmount;
      } else if (source === "boss") {
        this.expeditionState.resourcesFromBoss += normalizedAmount;
      }
      this.expeditionState.resourcesCollected += normalizedAmount;
      return normalizedAmount;
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
    startExpedition(config = {}) {
      const maxTime = this.baseExpeditionTime + this.expeditionTimeBonus;
      this.resources = { resources: 0 };
      this.expeditionState = {
        active: true,
        timeRemaining: maxTime,
        maxTime,
        success: false,
        bossDefeated: false,
        zoneIndex: config.zoneIndex ?? this.currentGalaxyIndex,
        zoneName: config.zoneName ?? `Zone ${this.currentGalaxyIndex + 1}`,
        resourcesFromAsteroids: 0,
        resourcesFromEnemies: 0,
        resourcesFromBoss: 0,
        resourcesCollected: 0,
        resourcesRetained: 0,
        asteroidsDestroyed: 0,
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

  // js/game/Ship.js
  var SHIP_SPRITE = [
    // 16x16 pixel art ship - top-down view, nose pointing right
    // 0=empty, 1=dark hull, 2=main hull, 3=cockpit, 4=engine glow
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 2, 2, 3, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 4, 1, 2, 2, 2, 3, 3, 2, 2, 2, 1, 0, 0, 0],
    [0, 4, 4, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0],
    [0, 4, 4, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0],
    [0, 0, 4, 1, 2, 2, 2, 3, 3, 2, 2, 2, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 2, 2, 3, 2, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];
  var COLORS = {
    1: "#1a3a4a",
    // dark hull outline
    2: "#00aacc",
    // main hull
    3: "#00ffdd",
    // cockpit highlight
    4: "#ff6600"
    // engine glow
  };
  var Ship = class {
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
      const dx = this.mouseX - this.x;
      const dy = this.mouseY - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 3) {
        const speed = Math.min(shipSpeed, d * 8);
        this.x += dx / d * speed * dt;
        this.y += dy / d * speed * dt;
      }
      const margin = this.size * this.pixelScale / 2 + 5;
      this.x = Math.max(margin, Math.min(canvasW - margin, this.x));
      this.y = Math.max(margin, Math.min(canvasH - margin, this.y));
      if (enemies && enemies.length > 0) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const e of enemies) {
          const ed = dist(this.x, this.y, e.x, e.y);
          if (ed < nearestDist) {
            nearestDist = ed;
            nearest = e;
          }
        }
        if (nearest) {
          this.targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
        }
      } else {
        if (d > 10) {
          this.targetAngle = Math.atan2(dy, dx);
        }
      }
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
      const halfW = this.size * s / 2;
      const halfH = this.size * s / 2;
      if (this.invulnTimer > 0 && this.hitFlash <= 0) {
        ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 40) * 0.4;
      }
      for (let row = 0; row < SHIP_SPRITE.length; row++) {
        for (let col = 0; col < SHIP_SPRITE[row].length; col++) {
          const val = SHIP_SPRITE[row][col];
          if (val === 0) continue;
          let color;
          if (val === 4) {
            const flicker = 0.6 + this.engineFlicker * 0.4;
            ctx.globalAlpha = (ctx.globalAlpha || 1) * flicker;
            color = this.hitFlash > 0 ? "#ffffff" : COLORS[val];
          } else {
            color = this.hitFlash > 0 ? "#ffffff" : COLORS[val];
          }
          ctx.fillStyle = color;
          ctx.fillRect(
            col * s - halfW,
            row * s - halfH,
            s,
            s
          );
          if (val === 4) {
            ctx.globalAlpha = this.invulnTimer > 0 && this.hitFlash <= 0 ? 0.4 + Math.sin(performance.now() / 40) * 0.4 : 1;
          }
        }
      }
      ctx.restore();
    }
  };

  // js/game/Projectile.js
  var Projectile = class {
    constructor(x, y, vx, vy, baseDamage, rotation) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.baseDamage = baseDamage;
      this.rotation = rotation || 0;
      this.alive = true;
      this.life = 2;
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
      return this.x < -m || this.x > canvasW + m || this.y < -m || this.y > canvasH + m;
    }
    render(ctx) {
      for (const t of this.trail) {
        if (t.alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = t.alpha * 0.35;
        ctx.fillStyle = "#0088cc";
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = "#00eeff";
      ctx.shadowColor = "#00aaff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
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
    travel(index) {
      if (index < 0 || index >= this.galaxies.length) return false;
      if (!this.isUnlocked(index)) return false;
      this.gs.currentGalaxyIndex = index;
      this._updateCurrent();
      this.bossResourcesCollected = 0;
      this.bossActive = false;
      this._syncBossProgress();
      this.gs.emit("galaxyTraveled", { index, data: this.currentData });
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
      const legacyBossResources = Object.values(this.currentData.boss.reward?.resources || {}).reduce((total, amount) => total + Math.max(0, Math.floor(amount || 0)), 0);
      const reward = {
        ...this.currentData.boss.reward || {},
        resources: Math.max(0, Math.floor(this.currentData.resourceReward ?? legacyBossResources ?? 0))
      };
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

  // js/data/weapons.js
  var weapons_default = [
    {
      id: "basic_laser",
      name: "Basic Laser",
      description: "Standard mining laser. Reliable but weak.",
      tier: "common",
      slot: "primary",
      stats: { damage: 1, fireRate: 1 },
      price: null
    },
    {
      id: "pulse_cannon",
      name: "Pulse Cannon",
      description: "Fires concentrated energy pulses. Higher burst damage.",
      tier: "uncommon",
      slot: "primary",
      stats: { damage: 1.4, fireRate: 0.85 },
      price: { resource: "nickel", amount: 60 }
    },
    {
      id: "spread_shot",
      name: "Spread Shot",
      description: "Wide beam that hits multiple targets.",
      tier: "uncommon",
      slot: "primary",
      stats: { damage: 0.8, fireRate: 1.2, targets: 3 },
      price: { resource: "iron", amount: 120 }
    },
    {
      id: "plasma_rifle",
      name: "Plasma Rifle",
      description: "Superheated plasma rounds melt through armor.",
      tier: "rare",
      slot: "primary",
      stats: { damage: 2, fireRate: 0.9 },
      price: { resource: "helium3", amount: 50 }
    },
    {
      id: "void_beam",
      name: "Void Beam",
      description: "Continuous beam that grows stronger over time.",
      tier: "rare",
      slot: "primary",
      stats: { damage: 1.2, fireRate: 2, rampUp: 0.5 },
      price: { resource: "star_crystal", amount: 25 }
    },
    {
      id: "quantum_driver",
      name: "Quantum Driver",
      description: "Quantum-entangled projectiles that ignore defenses.",
      tier: "epic",
      slot: "primary",
      stats: { damage: 3, fireRate: 0.75, armorPen: 0.4 },
      price: { resource: "antimatter", amount: 25 }
    },
    {
      id: "singularity_cannon",
      name: "Singularity Cannon",
      description: "Creates micro black holes on impact.",
      tier: "legendary",
      slot: "primary",
      stats: { damage: 5, fireRate: 0.5, aoeRadius: 40 },
      price: { resource: "dark_matter", amount: 10 }
    },
    {
      id: "shield_booster",
      name: "Shield Booster",
      description: "Auxiliary module that reinforces energy shields.",
      tier: "common",
      slot: "utility",
      stats: { shieldBonus: 0.1 },
      price: { resource: "iron", amount: 50 }
    },
    {
      id: "repair_drone",
      name: "Repair Drone",
      description: "Passive hull regeneration between engagements.",
      tier: "uncommon",
      slot: "utility",
      stats: { regenBonus: 8e-3 },
      price: { resource: "nickel", amount: 80 }
    },
    {
      id: "cargo_expander",
      name: "Cargo Expander",
      description: "Increased resource yield from each run.",
      tier: "uncommon",
      slot: "utility",
      stats: { resourceMultBonus: 0.1 },
      price: { resource: "helium3", amount: 30 }
    }
  ];

  // js/game/StatCalculator.js
  function getEquippedUtilityBonuses(metaState2) {
    return (metaState2?.utilitySlots || []).reduce((totals, moduleId) => {
      if (!moduleId) return totals;
      const module = weapons_default.find((item) => item.id === moduleId && item.slot === "utility");
      if (!module?.stats) return totals;
      totals.shield += module.stats.shieldBonus || 0;
      totals.passiveRegen += module.stats.regenBonus || 0;
      totals.resourceMult += module.stats.resourceMultBonus || 0;
      return totals;
    }, {
      shield: 0,
      passiveRegen: 0,
      resourceMult: 0
    });
  }
  function calculateCombatStats({ gs, skillTree, metaState: metaState2 }) {
    const utilityBonuses = getEquippedUtilityBonuses(metaState2);
    const baseClick = 15 + (skillTree?.getTotalEffect?.("click_damage_flat") || 0);
    const clickDamageMult = 1 + (skillTree?.getTotalEffect?.("click_damage_mult") || 0);
    const critChance = 0.05 + (skillTree?.getTotalEffect?.("crit_chance") || 0);
    const critMult = 3 + (skillTree?.getTotalEffect?.("crit_mult") || 0);
    const resourceMult = 1 + (skillTree?.getTotalEffect?.("resource_mult") || 0) + utilityBonuses.resourceMult;
    const maxHpBase = (100 + Math.max(0, gs.level - 1) * 10) * (1 + (skillTree?.getTotalEffect?.("max_hp") || 0));
    const maxShield = maxHpBase * ((skillTree?.getTotalEffect?.("shield") || 0) + utilityBonuses.shield);
    const passiveRegenPerSecond = maxHpBase * ((skillTree?.getTotalEffect?.("passive_regen") || 0) + utilityBonuses.passiveRegen);
    const bossProgressMult = 1 + (skillTree?.getTotalEffect?.("boss_progress") || 0);
    const expeditionTimeBonus = skillTree?.getTotalEffect?.("expedition_time") || 0;
    const fireRate = 3 + (skillTree?.getTotalEffect?.("fire_rate") || 0);
    const shipSpeed = 220 + (skillTree?.getTotalEffect?.("ship_speed") || 0);
    return {
      clickDamage: baseClick * clickDamageMult,
      critChance: Math.min(critChance, 0.8),
      critMult,
      resourceMult,
      damageMult: clickDamageMult,
      maxHp: maxHpBase,
      maxShield,
      passiveRegenPerSecond,
      xpMult: 1,
      bossProgressMult,
      bonusResourceChance: 0,
      rareDropMult: 1,
      expeditionTimeBonus,
      fireRate,
      shipSpeed
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
  var SAVE_VERSION = "6.0.0";
  var STORAGE_KEY = "singularity_rush_save";
  var SaveManager = class {
    constructor(gameState, metaState2) {
      this.gs = gameState;
      this.ms = metaState2;
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
        combo: { count: this.gs.combo.count, bestCombo: this.gs.combo.bestCombo },
        meta: this.ms ? this.ms.serialize() : null
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
      const migrated = { ...data, version: "3.0.0" };
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
    _migrateToV4(data) {
      const migrated = { ...data, version: "4.0.0" };
      migrated.meta = {
        day: 1 + (data.statistics?.expeditionRuns ?? 0),
        runCount: data.statistics?.expeditionRuns ?? 0,
        selectedSectorIndex: data.galaxy ?? 0,
        unlockedSectors: data.unlockedGalaxies ?? [0],
        completedSectors: data.completedGalaxies ?? [],
        ownedWeapons: ["basic_laser"],
        equippedWeapons: ["basic_laser", null],
        utilitySlots: [null],
        activeTasks: [],
        completedTaskCount: 0,
        shopOffers: [],
        shopRerollsFree: 1,
        shopRerollsPaid: 0,
        shopSeed: Math.floor(Math.random() * 2147483647),
        ownedBuffs: []
      };
      return migrated;
    }
    _migrateToV5(data) {
      const legacyMeta = data.meta || {};
      return {
        ...data,
        version: SAVE_VERSION,
        meta: {
          day: legacyMeta.day ?? 1 + (data.statistics?.expeditionRuns ?? 0),
          runCount: legacyMeta.runCount ?? data.statistics?.expeditionRuns ?? 0,
          metaCurrency: legacyMeta.metaCurrency ?? 0,
          selectedZone: legacyMeta.selectedZone ?? legacyMeta.selectedSectorIndex ?? data.galaxy ?? 0,
          unlockedZones: legacyMeta.unlockedZones ?? legacyMeta.unlockedSectors ?? data.unlockedGalaxies ?? [0],
          clearedZones: legacyMeta.clearedZones ?? legacyMeta.completedSectors ?? data.completedGalaxies ?? [],
          purchasedSkillNodes: legacyMeta.purchasedSkillNodes ?? [],
          unlockedWeapons: legacyMeta.unlockedWeapons ?? legacyMeta.ownedWeapons ?? ["basic_laser"],
          unlockedModules: legacyMeta.unlockedModules ?? [],
          unlockedSystems: legacyMeta.unlockedSystems ?? [],
          equippedWeapons: legacyMeta.equippedWeapons ?? ["basic_laser", null],
          utilitySlots: legacyMeta.utilitySlots ?? [null]
        }
      };
    }
    _migrateToV6(data) {
      const legacyMeta = data.meta || {};
      return {
        ...data,
        version: SAVE_VERSION,
        resources: {
          resources: Math.max(0, Math.floor(data.resources?.resources ?? 0))
        },
        meta: {
          ...legacyMeta,
          resources: Math.max(0, Math.floor(legacyMeta.resources ?? legacyMeta.metaCurrency ?? 0))
        }
      };
    }
    loadFromData(data) {
      let saveData = data;
      const versionMajor = Number.parseInt(String(saveData.version || "0").split(".")[0], 10) || 0;
      if (versionMajor === 1) {
        saveData = this._migrateV1toV2(data);
      }
      const normalizedMajor = Number.parseInt(String(saveData.version || "0").split(".")[0], 10) || 0;
      if (normalizedMajor < 3) {
        saveData = this._migrateToV3(saveData);
      }
      const afterV3Major = Number.parseInt(String(saveData.version || "0").split(".")[0], 10) || 0;
      if (afterV3Major < 4) {
        saveData = this._migrateToV4(saveData);
      }
      const afterV4Major = Number.parseInt(String(saveData.version || "0").split(".")[0], 10) || 0;
      if (afterV4Major < 5) {
        saveData = this._migrateToV5(saveData);
      }
      const afterV5Major = Number.parseInt(String(saveData.version || "0").split(".")[0], 10) || 0;
      if (afterV5Major < 6) {
        saveData = this._migrateToV6(saveData);
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
      this.gs.resources = {
        resources: Math.max(0, Math.floor(saveData.resources?.resources ?? 0))
      };
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
      if (this.ms && saveData.meta) {
        this.ms.deserialize(saveData.meta);
      } else if (this.ms) {
        this.ms.deserialize(this._migrateToV5(saveData).meta);
      }
      if (this.ms) {
        this.gs.currentGalaxyIndex = this.ms.selectedSectorIndex;
        this.gs.unlockedGalaxies = [...this.ms.unlockedSectors];
        this.gs.completedGalaxies = [...this.ms.completedSectors];
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
    constructor(metaState2 = null) {
      this.meta = metaState2;
      this.data = null;
    }
    bindMetaState(metaState2) {
      this.meta = metaState2;
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
    isPurchased(nodeId) {
      return this.meta?.isSkillNodePurchased?.(nodeId) || false;
    }
    getPurchasedNodes() {
      return this.getNodes().filter((node) => this.isPurchased(node.id));
    }
    getNodeCost(nodeId) {
      return this.getNode(nodeId)?.cost ?? Infinity;
    }
    getMissingPrerequisites(nodeId) {
      const node = this.getNode(nodeId);
      if (!node) return [];
      return (node.prerequisites || []).filter((prerequisiteId) => !this.isPurchased(prerequisiteId));
    }
    canPurchase(nodeId) {
      const node = this.getNode(nodeId);
      if (!node || !this.meta) return false;
      if (this.isPurchased(nodeId)) return false;
      if (!this.meta.canAffordResources(node.cost)) return false;
      if (this.getMissingPrerequisites(nodeId).length > 0) return false;
      const requiredZones = node.requiredZonesCleared || [];
      if (requiredZones.some((zoneIndex) => !this.meta.isSectorCompleted(zoneIndex))) {
        return false;
      }
      return true;
    }
    purchase(nodeId) {
      if (!this.canPurchase(nodeId)) return false;
      const node = this.getNode(nodeId);
      if (!node || !this.meta?.spendResources(node.cost)) return false;
      this.meta.addPurchasedSkillNode(nodeId);
      if (node.effectType === "unlock_weapon") {
        this.meta.unlockWeapon(node.effectValue);
      }
      if (node.effectType === "unlock_module") {
        this.meta.unlockModule(node.effectValue);
      }
      if (node.effectType === "unlock_system") {
        this.meta.unlockSystem(node.effectValue);
      }
      this.meta.emit("skillTreeChanged", { nodeId, node });
      return true;
    }
    getTotalEffect(statKey) {
      return this.getPurchasedNodes().reduce((total, node) => {
        if (node.effectType !== "stat" || node.effectKey !== statKey) {
          return total;
        }
        return total + (node.effectValue || 0);
      }, 0);
    }
    getUnlockedContentIds(effectType) {
      return this.getPurchasedNodes().filter((node) => node.effectType === effectType).map((node) => node.effectValue);
    }
    getNodeState(nodeId) {
      const node = this.getNode(nodeId);
      return {
        node,
        isPurchased: this.isPurchased(nodeId),
        canPurchase: this.canPurchase(nodeId),
        cost: node?.cost ?? Infinity,
        missingPrerequisites: this.getMissingPrerequisites(nodeId)
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

  // js/data/sectors.js
  var sectors_default = [
    {
      id: "asteroid_belt",
      name: "Asteroid Belt",
      index: 0,
      description: "Dense asteroid field on the outskirts of the Solar System. A perfect training ground.",
      difficulty: 1,
      bgColor: "#0a0a1a",
      asteroidColor: "#8a8a8a",
      starDensity: 60,
      resources: ["resources"],
      resourceReward: 12,
      bossId: "great_asteroid",
      unlockRule: "start",
      recommendedPower: "Starter loadout",
      asteroidHP: { base: 45, scale: 1.2 },
      asteroidSpawnRate: 1.2,
      unlockCost: {},
      boss: {
        name: "Great Asteroid",
        hp: 2200,
        color: "#a0522d",
        phases: [
          { hpPercent: 100, attackInterval: 4, attackDamage: 5 },
          { hpPercent: 40, attackInterval: 2.5, attackDamage: 8 }
        ],
        reward: { xp: 20 }
      }
    },
    {
      id: "orion_nebula",
      name: "Orion Nebula",
      index: 1,
      description: "Colorful gases and glowing asteroids rich in valuable minerals.",
      difficulty: 2,
      bgColor: "#0d0a1a",
      asteroidColor: "#6a5acd",
      starDensity: 80,
      resources: ["resources"],
      resourceReward: 18,
      bossId: "star_leviathan",
      unlockRule: "defeat_previous_boss",
      recommendedPower: "Early offense branch + one utility unlock",
      asteroidHP: { base: 360, scale: 1.22 },
      asteroidSpawnRate: 1,
      unlockCost: { iron: 180, nickel: 90 },
      boss: {
        name: "Star Leviathan",
        hp: 22e3,
        color: "#ff6347",
        phases: [
          { hpPercent: 100, attackInterval: 3, attackDamage: 15 },
          { hpPercent: 60, attackInterval: 2, attackDamage: 20 },
          { hpPercent: 20, attackInterval: 1.2, attackDamage: 30 }
        ],
        reward: { xp: 35 }
      }
    },
    {
      id: "binary_system",
      name: "Binary System",
      index: 2,
      description: "Two suns create gravitational chaos full of rich deposits.",
      difficulty: 3,
      bgColor: "#1a0a0a",
      asteroidColor: "#cd853f",
      starDensity: 100,
      resources: ["resources"],
      resourceReward: 25,
      bossId: "binary_star",
      unlockRule: "defeat_previous_boss",
      recommendedPower: "Two branch specialization and an unlocked weapon",
      asteroidHP: { base: 2250, scale: 1.25 },
      asteroidSpawnRate: 0.9,
      unlockCost: { helium3: 110, star_crystal: 55 },
      boss: {
        name: "Binary Star",
        hp: 22e4,
        color: "#ffd700",
        phases: [
          { hpPercent: 100, attackInterval: 2.5, attackDamage: 40 },
          { hpPercent: 50, attackInterval: 1.5, attackDamage: 60 }
        ],
        reward: { xp: 55 }
      }
    },
    {
      id: "black_hole_proxima",
      name: "Black Hole Proxima",
      index: 3,
      description: "Spacetime curvature hides the rarest materials in the universe.",
      difficulty: 4,
      bgColor: "#050510",
      asteroidColor: "#4b0082",
      starDensity: 40,
      resources: ["resources"],
      resourceReward: 35,
      bossId: "event_horizon",
      unlockRule: "defeat_previous_boss",
      recommendedPower: "Defensive branch online with boss tempo nodes",
      asteroidHP: { base: 15e3, scale: 1.25 },
      asteroidSpawnRate: 0.8,
      unlockCost: { antimatter: 70, degenerate: 30 },
      boss: {
        name: "Event Horizon",
        hp: 22e5,
        color: "#1a0033",
        phases: [
          { hpPercent: 100, attackInterval: 2, attackDamage: 100, timer: 120 },
          { hpPercent: 30, attackInterval: 1, attackDamage: 200, timer: 60 }
        ],
        reward: { xp: 85 }
      }
    },
    {
      id: "dwarf_galaxy",
      name: "Dwarf Galaxy",
      index: 4,
      description: "Dense field of neon asteroids in a small satellite galaxy.",
      difficulty: 5,
      bgColor: "#0a1a0a",
      asteroidColor: "#00ff7f",
      starDensity: 120,
      resources: ["resources"],
      resourceReward: 50,
      bossId: "star_beetle",
      unlockRule: "defeat_previous_boss",
      recommendedPower: "Broad survival plus mining efficiency stack",
      asteroidHP: { base: 11e4, scale: 1.25 },
      asteroidSpawnRate: 0.7,
      unlockCost: { dark_matter: 28, exotic_particle: 12 },
      boss: {
        name: "Star Beetle",
        hp: 22e6,
        color: "#00ff7f",
        phases: [
          { hpPercent: 100, attackInterval: 1.5, attackDamage: 250, swarm: true },
          { hpPercent: 50, attackInterval: 1, attackDamage: 400, swarm: true }
        ],
        reward: { xp: 120 }
      }
    },
    {
      id: "supernova_remnant",
      name: "Supernova Remnant",
      index: 5,
      description: "Unstable remains of a massive stellar explosion.",
      difficulty: 6,
      bgColor: "#1a0a05",
      asteroidColor: "#ff4500",
      starDensity: 90,
      resources: ["resources"],
      resourceReward: 65,
      bossId: "supernova_core",
      unlockRule: "defeat_previous_boss",
      recommendedPower: "Mid-late tree with stronger crit or shield build",
      asteroidHP: { base: 9e5, scale: 1.28 },
      asteroidSpawnRate: 0.6,
      unlockCost: { neutrino_quartz: 15, fusionium: 7 },
      boss: {
        name: "Supernova Core",
        hp: 22e7,
        color: "#ff4500",
        phases: [
          { hpPercent: 100, attackInterval: 1.2, attackDamage: 800 },
          { hpPercent: 60, attackInterval: 0.8, attackDamage: 1200, enrageTimer: 90 },
          { hpPercent: 20, attackInterval: 0.5, attackDamage: 2e3 }
        ],
        reward: { xp: 170 }
      }
    },
    {
      id: "galactic_center",
      name: "Galactic Core",
      index: 6,
      description: "The heart of the galaxy. Cosmic horror and infinite power.",
      difficulty: 7,
      bgColor: "#0a0005",
      asteroidColor: "#ff00ff",
      starDensity: 150,
      resources: ["resources"],
      resourceReward: 80,
      bossId: "singularity",
      unlockRule: "defeat_previous_boss",
      recommendedPower: "Late tree capstones and multiple content unlocks",
      asteroidHP: { base: 75e5, scale: 1.3 },
      asteroidSpawnRate: 0.5,
      unlockCost: { plasma: 8, neutron_core: 4 },
      boss: {
        name: "SINGULARITY",
        hp: 45e8,
        color: "#ff00ff",
        phases: [
          { hpPercent: 100, attackInterval: 1, attackDamage: 3e3 },
          { hpPercent: 70, attackInterval: 0.7, attackDamage: 5e3 },
          { hpPercent: 40, attackInterval: 0.4, attackDamage: 8e3 },
          { hpPercent: 10, attackInterval: 0.2, attackDamage: 15e3 }
        ],
        reward: { xp: 250 }
      }
    }
  ];

  // js/data/skills.js
  var skills_default = {
    nodes: [
      {
        id: "core_targeting",
        branch: "shared",
        title: "Core Targeting",
        description: "Stabilizes the starter rig and raises baseline damage.",
        cost: 6,
        prerequisites: [],
        effectType: "stat",
        effectKey: "click_damage_flat",
        effectValue: 8,
        tier: 0
      },
      {
        id: "combat_throttle",
        branch: "shared",
        title: "Combat Throttle",
        description: "Improves weapon cycle timing for every future run.",
        cost: 8,
        prerequisites: ["core_targeting"],
        effectType: "stat",
        effectKey: "fire_rate",
        effectValue: 0.45,
        tier: 0
      },
      {
        id: "hull_rivets",
        branch: "shared",
        title: "Hull Rivets",
        description: "Adds a broad survivability bump before specialization.",
        cost: 8,
        prerequisites: ["core_targeting"],
        effectType: "stat",
        effectKey: "max_hp",
        effectValue: 0.12,
        tier: 0
      },
      {
        id: "salvage_routines",
        branch: "shared",
        title: "Salvage Routines",
        description: "Improves mining output to speed up run tempo.",
        cost: 8,
        prerequisites: ["core_targeting"],
        effectType: "stat",
        effectKey: "resource_mult",
        effectValue: 0.15,
        tier: 0
      },
      {
        id: "crit_matrix",
        branch: "offense",
        title: "Crit Matrix",
        description: "Upgrades the attack core with higher critical rate.",
        cost: 12,
        prerequisites: ["combat_throttle"],
        effectType: "stat",
        effectKey: "crit_chance",
        effectValue: 0.08,
        tier: 1
      },
      {
        id: "pulse_cannon_license",
        branch: "offense",
        title: "Pulse Cannon License",
        description: "Unlocks the Pulse Cannon for the station armory.",
        cost: 14,
        prerequisites: ["combat_throttle"],
        effectType: "unlock_weapon",
        effectValue: "pulse_cannon",
        tier: 1
      },
      {
        id: "plasma_rifle_license",
        branch: "offense",
        title: "Plasma Rifle License",
        description: "Unlocks a stronger high-pressure plasma platform.",
        cost: 28,
        prerequisites: ["crit_matrix", "pulse_cannon_license"],
        effectType: "unlock_weapon",
        effectValue: "plasma_rifle",
        tier: 2
      },
      {
        id: "overcharge_chamber",
        branch: "offense",
        title: "Overcharge Chamber",
        description: "Boosts critical damage for late-story burst windows.",
        cost: 42,
        prerequisites: ["plasma_rifle_license"],
        effectType: "stat",
        effectKey: "crit_mult",
        effectValue: 0.75,
        tier: 3
      },
      {
        id: "quantum_driver_license",
        branch: "offense",
        title: "Quantum Driver License",
        description: "Unlocks the Quantum Driver as a premium story reward.",
        cost: 62,
        prerequisites: ["overcharge_chamber"],
        requiredZonesCleared: [2],
        effectType: "unlock_weapon",
        effectValue: "quantum_driver",
        tier: 4
      },
      {
        id: "reinforced_bulkheads",
        branch: "defense",
        title: "Reinforced Bulkheads",
        description: "Raises hull capacity for tougher campaign zones.",
        cost: 12,
        prerequisites: ["hull_rivets"],
        effectType: "stat",
        effectKey: "max_hp",
        effectValue: 0.18,
        tier: 1
      },
      {
        id: "shield_booster_license",
        branch: "defense",
        title: "Shield Booster License",
        description: "Unlocks a utility module that strengthens energy shields.",
        cost: 14,
        prerequisites: ["hull_rivets"],
        effectType: "unlock_module",
        effectValue: "shield_booster",
        tier: 1
      },
      {
        id: "particle_screening",
        branch: "defense",
        title: "Particle Screening",
        description: "Converts a portion of hull gains into shields.",
        cost: 26,
        prerequisites: ["reinforced_bulkheads", "shield_booster_license"],
        effectType: "stat",
        effectKey: "shield",
        effectValue: 0.16,
        tier: 2
      },
      {
        id: "repair_drone_license",
        branch: "defense",
        title: "Repair Drone License",
        description: "Unlocks passive between-hit sustain through a utility slot.",
        cost: 38,
        prerequisites: ["particle_screening"],
        effectType: "unlock_module",
        effectValue: "repair_drone",
        tier: 3
      },
      {
        id: "emergency_regen",
        branch: "defense",
        title: "Emergency Regen",
        description: "Adds passive hull regeneration each second.",
        cost: 48,
        prerequisites: ["repair_drone_license"],
        effectType: "stat",
        effectKey: "passive_regen",
        effectValue: 0.02,
        tier: 4
      },
      {
        id: "ore_crushers",
        branch: "mining",
        title: "Ore Crushers",
        description: "Raises base yield from destroyed asteroids.",
        cost: 10,
        prerequisites: ["salvage_routines"],
        effectType: "stat",
        effectKey: "resource_mult",
        effectValue: 0.18,
        tier: 1
      },
      {
        id: "spread_shot_license",
        branch: "mining",
        title: "Spread Shot License",
        description: "Unlocks a wider weapon for clearing dense fields.",
        cost: 14,
        prerequisites: ["salvage_routines"],
        effectType: "unlock_weapon",
        effectValue: "spread_shot",
        tier: 1
      },
      {
        id: "precision_extractors",
        branch: "mining",
        title: "Precision Extractors",
        description: "Improves critical consistency while mining under pressure.",
        cost: 24,
        prerequisites: ["ore_crushers"],
        effectType: "stat",
        effectKey: "crit_chance",
        effectValue: 0.05,
        tier: 2
      },
      {
        id: "cargo_expander_license",
        branch: "mining",
        title: "Cargo Expander License",
        description: "Unlocks a utility module focused on resource output.",
        cost: 30,
        prerequisites: ["ore_crushers", "spread_shot_license"],
        effectType: "unlock_module",
        effectValue: "cargo_expander",
        tier: 2
      },
      {
        id: "deep_core_reprocessing",
        branch: "mining",
        title: "Deep Core Reprocessing",
        description: "Large end-branch salvage multiplier for later zones.",
        cost: 46,
        prerequisites: ["precision_extractors", "cargo_expander_license"],
        requiredZonesCleared: [1],
        effectType: "stat",
        effectKey: "resource_mult",
        effectValue: 0.3,
        tier: 4
      },
      {
        id: "vector_thrusters",
        branch: "utility",
        title: "Vector Thrusters",
        description: "Adds baseline movement speed to all runs.",
        cost: 10,
        prerequisites: ["combat_throttle"],
        effectType: "stat",
        effectKey: "ship_speed",
        effectValue: 28,
        tier: 1
      },
      {
        id: "time_dilation",
        branch: "utility",
        title: "Time Dilation",
        description: "Extends the run clock to give boss pushes more room.",
        cost: 16,
        prerequisites: ["vector_thrusters"],
        effectType: "stat",
        effectKey: "expedition_time",
        effectValue: 5,
        tier: 1
      },
      {
        id: "boss_scanner",
        branch: "utility",
        title: "Boss Scanner",
        description: "Increases progress toward the zone boss encounter.",
        cost: 24,
        prerequisites: ["time_dilation"],
        effectType: "stat",
        effectKey: "boss_progress",
        effectValue: 0.22,
        tier: 2
      },
      {
        id: "cooldown_mesh",
        branch: "utility",
        title: "Cooldown Mesh",
        description: "Further accelerates weapon cadence in longer runs.",
        cost: 34,
        prerequisites: ["boss_scanner"],
        effectType: "stat",
        effectKey: "fire_rate",
        effectValue: 0.7,
        tier: 3
      },
      {
        id: "void_beam_license",
        branch: "utility",
        title: "Void Beam License",
        description: "Unlocks the Void Beam after proving campaign mastery.",
        cost: 52,
        prerequisites: ["cooldown_mesh"],
        requiredZonesCleared: [3],
        effectType: "unlock_weapon",
        effectValue: "void_beam",
        tier: 4
      }
    ]
  };

  // js/data/resources.js
  var resources_default = {
    "resources": {
      "resources": { "name": "Resources", "color": "#50c878", "value": 1 },
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
  var PROJ_SPEED = 600;
  var BASE_FIRE_RATE = 3;
  var BASE_SHIP_SPEED = 220;
  var BASE_ASTEROID_RESOURCE_REWARD = 1;
  var BASE_ENEMY_RESOURCE_REWARD = 2;
  var Game = class {
    constructor(metaState2) {
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.gs = new GameState();
      this.particles = new ParticleSystem();
      this.effects = new ScreenEffects();
      this.asteroidMgr = new AsteroidManager();
      this.combo = new ComboSystem(this.gs);
      this.galaxy = new Galaxy(this.gs);
      this.skillTree = new SkillTree(metaState2 || null);
      this.ui = new UIManager(this.gs);
      this._metaState = metaState2 || null;
      this.save = new SaveManager(this.gs, this._metaState);
      this._ship = null;
      this._projectiles = [];
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
      this.fireRate = BASE_FIRE_RATE;
      this.shipSpeed = BASE_SHIP_SPEED;
      this.boss = null;
      this._setupEvents();
    }
    async init() {
      this._resizeCanvas();
      window.addEventListener("resize", () => this._resizeCanvas());
      audio.init();
      this.galaxy.loadData(sectors_default);
      this.skillTree.loadData(skills_default);
      this.skillTree.bindMetaState(this._metaState);
      this.resourcesData = resources_default;
      if (this.save.hasAutoSave()) {
        this.save.loadAutoSave();
      }
      this._syncMetaProgression();
      this.galaxy.loadData(sectors_default);
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
      this.gs.emit("gameReady", {});
      this._showStation();
      this.running = true;
      requestAnimationFrame((t) => this._loop(t));
    }
    _syncMetaProgression() {
      if (!this._metaState) return;
      this.gs.currentGalaxyIndex = this._metaState.selectedSectorIndex;
      this.gs.unlockedGalaxies = [...this._metaState.unlockedSectors];
      this.gs.completedGalaxies = [...this._metaState.completedSectors];
      this.galaxy._updateCurrent();
    }
    _showStation() {
      const station2 = document.getElementById("station-wrapper");
      const gameArea = document.getElementById("game-area");
      if (station2) station2.classList.remove("hidden");
      if (gameArea) gameArea.classList.remove("active");
      if (this._stationInit) {
        this._stationInit();
      }
    }
    _showGameArea() {
      const station2 = document.getElementById("station-wrapper");
      const gameArea = document.getElementById("game-area");
      if (station2) station2.classList.add("hidden");
      if (gameArea) gameArea.classList.add("active");
      this._resizeCanvas();
    }
    _resizeCanvas() {
      const container = this.canvas?.parentElement;
      if (!container) return;
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
          x: Math.random() * (this.canvas?.width || 800),
          y: Math.random() * (this.canvas?.height || 600),
          size: Math.random() * 2 + 0.5,
          brightness: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 2 + 1,
          twinkleOffset: Math.random() * Math.PI * 2
        });
      }
    }
    _setupEvents() {
      this.canvas.addEventListener("mousemove", (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (this._ship) {
          this._ship.setMouseTarget(e.clientX - rect.left, e.clientY - rect.top);
        }
      });
      this.canvas.addEventListener("click", () => {
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
      });
      this.gs.on("galaxyTraveled", ({ index }) => {
        audio.newGalaxy();
        this.effects.shake(5, 0.3);
        this._clearBossEncounter();
        this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
        this._generateStars();
        this._recalcStats();
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
        const bossResources = Math.max(0, Math.floor(reward.resources ?? this.galaxy.getCurrent()?.resourceReward ?? 0));
        const gained = this.gs.addRunResources("boss", bossResources);
        const label = gained > 0 ? `+${formatNumber(gained)} ${this.resourcesData?.resources.resources?.name || "resources"}` : "";
        if (label) {
          this.ui.addFloatingText(this.canvas.width / 2, 90, label, "#ffd700", 20);
        }
        if (this.gs.expeditionState.active) {
          this.gs.expeditionState.success = true;
          this.gs.expeditionState.bossDefeated = true;
          this.gs.endExpedition();
        }
      });
      this._metaState?.on("skillTreeChanged", () => {
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
        if (this.gs.expeditionState.active) {
          this.gs.expeditionState.success = false;
          this.gs.expeditionState.bossDefeated = false;
          this.gs.endExpedition();
        }
      });
      this.gs.on("expeditionStart", () => {
        this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
        this._showGameArea();
        this._ship = new Ship(this.canvas.width / 2, this.canvas.height / 2);
        this._projectiles = [];
        const timer = document.getElementById("expedition-timer");
        if (timer) timer.style.display = "block";
      });
      this.gs.on("expeditionEnd", () => {
        this.asteroidMgr.asteroids = [];
        this._ship = null;
        this._projectiles = [];
        const timer = document.getElementById("expedition-timer");
        if (timer) timer.style.display = "none";
        if (this._metaState) {
          this._metaState.completeRun(this.gs.expeditionState, sectors_default);
          this._syncMetaProgression();
        }
        this._showRunSummary();
      });
    }
    _recalcStats() {
      const stats = calculateCombatStats({
        gs: this.gs,
        skillTree: this.skillTree,
        metaState: this._metaState
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
      this.fireRate = stats.fireRate;
      this.shipSpeed = stats.shipSpeed;
      this.gs.expeditionTimeBonus = stats.expeditionTimeBonus;
      const hpRatio = this.gs.maxHp > 0 ? this.gs.hp / this.gs.maxHp : 1;
      this.gs.maxHp = Math.max(100, Math.round(stats.maxHp));
      this.gs.hp = Math.min(this.gs.maxHp, this.gs.maxHp * hpRatio);
      this.gs.maxShield = Math.round(stats.maxShield);
      this.gs.shield = Math.min(this.gs.shield, this.gs.maxShield);
    }
    // --- Weapon stats ---
    _getWeaponStats() {
      const weaponId = this._metaState?.equippedWeapons?.[0] || "basic_laser";
      const weapon = weapons_default.find((w) => w.id === weaponId);
      return weapon?.stats || { damage: 1, fireRate: 1 };
    }
    _getEnemies() {
      const enemies = this.asteroidMgr.asteroids.filter((a) => a.alive);
      if (this.boss && this.boss.alive) {
        enemies.push({ x: this.canvas.width / 2, y: 120 });
      }
      return enemies;
    }
    // --- Combat ---
    _fireProjectile() {
      const weaponStats = this._getWeaponStats();
      const baseDamage = this.clickDamage * (weaponStats.damage || 1);
      const actualFireRate = this.fireRate * (weaponStats.fireRate || 1);
      this._ship.setFireCooldown(1 / actualFireRate);
      const spawn = this._ship.getProjectileSpawn();
      const proj = new Projectile(
        spawn.x,
        spawn.y,
        Math.cos(spawn.angle) * PROJ_SPEED,
        Math.sin(spawn.angle) * PROJ_SPEED,
        baseDamage,
        spawn.angle
      );
      this._projectiles.push(proj);
    }
    _updateProjectiles(dt) {
      for (const proj of this._projectiles) {
        proj.update(dt);
        if (proj.isOffScreen(this.canvas.width, this.canvas.height)) {
          proj.alive = false;
          continue;
        }
        let hit = false;
        for (const asteroid of this.asteroidMgr.asteroids) {
          if (!asteroid.alive) continue;
          const d = dist(proj.x, proj.y, asteroid.x, asteroid.y);
          if (d < proj.radius + asteroid.radius) {
            this.combo.registerClick();
            let damage = proj.baseDamage * this.combo.multiplier;
            let isCrit = Math.random() < this.critChance;
            if (isCrit) {
              damage *= this.critMult;
              audio.criticalHit();
              this.effects.shake(6, 0.3);
              this.particles.emitCritical(proj.x, proj.y);
              this.ui.addFloatingText(proj.x, proj.y - 30, `CRIT! ${formatNumber(damage)}`, "#ff0040", 36);
            } else {
              this.ui.addFloatingText(proj.x, proj.y - 20, formatNumber(damage), "#009dff", 28);
            }
            const killed = asteroid.takeDamage(damage);
            this.gs.statistics.totalDamage += damage;
            this.particles.emitTrail(proj.x, proj.y, isCrit ? "#ff0040" : "#009dff");
            audio.clickHit(this.combo.count);
            if (killed) {
              this._onAsteroidKilled(asteroid);
            }
            proj.alive = false;
            hit = true;
            break;
          }
        }
        if (!hit && this.boss && this.boss.alive) {
          const bx = this.canvas.width / 2;
          const by = 120;
          const bossRadius = 60;
          const d = dist(proj.x, proj.y, bx, by);
          if (d < proj.radius + bossRadius) {
            this.combo.registerClick();
            let damage = proj.baseDamage * this.combo.multiplier;
            let isCrit = Math.random() < this.critChance;
            if (isCrit) damage *= this.critMult;
            this._damageBoss(damage, proj.x, proj.y, isCrit);
            proj.alive = false;
          }
        }
      }
      this._projectiles = this._projectiles.filter((p) => p.alive);
    }
    _checkShipCollisions() {
      if (!this._ship || !this._ship.alive) return;
      for (const asteroid of this.asteroidMgr.asteroids) {
        if (!asteroid.alive) continue;
        const d = dist(this._ship.x, this._ship.y, asteroid.x, asteroid.y);
        if (d < this._ship.size + asteroid.radius) {
          if (this._ship.takeDamage()) {
            const damage = Math.max(1, Math.ceil(asteroid.maxHp * 0.05));
            this.gs.takeDamage(damage);
            this.effects.shake(4, 0.2);
            const angle = Math.atan2(this._ship.y - asteroid.y, this._ship.x - asteroid.x);
            this._ship.x += Math.cos(angle) * 15;
            this._ship.y += Math.sin(angle) * 15;
          }
        }
      }
    }
    // --- Game loop ---
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
      if (this._metaState) this._metaState.flushNotifications();
      requestAnimationFrame((t) => this._loop(t));
    }
    _update(dt) {
      this.gs.statistics.playtime += dt;
      this.save.update(dt);
      if (this.gs.isExpeditionActive()) {
        const enemies = this._getEnemies();
        if (this._ship) {
          this._ship.update(dt, this.canvas.width, this.canvas.height, enemies, this.shipSpeed);
          if (this._ship.canFire() && enemies.length > 0) {
            this._fireProjectile();
          }
        }
        this._updateProjectiles(dt);
        this._checkShipCollisions();
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
          timerEl.style.color = "#c0392b";
        } else if (ex.timeRemaining <= 10) {
          timerEl.style.color = "#d4a843";
        } else {
          timerEl.style.color = "#50c878";
        }
      }
      if (ex.timeRemaining <= 0) {
        this.gs.endExpedition();
      }
    }
    _onAsteroidKilled(asteroid) {
      this.gs.recordAsteroidDestroyed(1 * this.xpMult);
      audio.asteroidDestroy(asteroid.radius / 20);
      this.effects.shakeByScore(asteroid.maxHp);
      this.particles.emitExplosion(asteroid.x, asteroid.y, asteroid.color, asteroid.radius / 30);
      const galaxyData = this.galaxy.getCurrent();
      if (galaxyData) {
        const amount = Math.max(1, Math.round(BASE_ASTEROID_RESOURCE_REWARD * this.resourceMult));
        const gained = this.gs.addRunResources("asteroid", amount);
        this.particles.emitResource(asteroid.x, asteroid.y, this.resourcesData?.resources.resources?.color || "#50c878");
        this.ui.addFloatingText(asteroid.x, asteroid.y + 20, `+${formatNumber(gained)} resources`, "#50c878", 20);
        if (this.gs.expeditionState.active) {
          this.gs.expeditionState.score += gained;
        }
        this.galaxy.addBossProgress(asteroid.maxHp / 15 * this.bossProgressMult);
        this._updateBossProgress();
      }
    }
    _getEnemyResourceReward(baseReward = BASE_ENEMY_RESOURCE_REWARD) {
      return Math.max(1, Math.round(baseReward * this.resourceMult));
    }
    // --- Boss ---
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
    _damageBoss(damage, x, y, isCrit = false) {
      const boss = this.boss;
      if (isCrit) {
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
    // --- Rendering ---
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
        for (const proj of this._projectiles) {
          proj.render(ctx);
        }
        if (this._ship) this._ship.render(ctx);
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
      const currentZone = this.galaxy.getCurrent();
      this.gs.startExpedition({
        zoneIndex: this.gs.currentGalaxyIndex,
        zoneName: currentZone?.name
      });
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
        success: this.galaxy.travel(index),
        reason: "ok"
      };
    }
    _showRunSummary() {
      const summary = this.gs.expeditionState;
      const panel = document.getElementById("run-summary");
      const content = document.getElementById("run-summary-content");
      const title = panel?.querySelector(".panel-title");
      if (!panel || !content) return;
      const successful = Boolean(summary.success && summary.bossDefeated);
      if (title) {
        title.textContent = successful ? "ZONE CLEARED" : "RUN FAILED";
      }
      const asteroidResources = Math.max(0, Math.floor(summary.resourcesFromAsteroids || 0));
      const enemyResources = Math.max(0, Math.floor(summary.resourcesFromEnemies || 0));
      const bossResources = Math.max(0, Math.floor(summary.resourcesFromBoss || 0));
      const totalResources = Math.max(0, Math.floor(summary.resourcesCollected || 0));
      const retainedResources = successful ? totalResources : Math.floor(totalResources * 0.25);
      content.innerHTML = `
      <div class="summary-row"><span>Zone</span><span class="summary-val">${summary.zoneName || `Zone ${summary.zoneIndex + 1}`}</span></div>
      <div class="summary-row"><span>Status</span><span class="summary-val ${successful ? "green" : "red"}">${successful ? "Boss defeated" : "Retained 25% on fail"}</span></div>
      <div class="summary-row"><span>Asteroids</span><span class="summary-val">${formatNumber(asteroidResources)}</span></div>
      <div class="summary-row"><span>Enemies</span><span class="summary-val">${formatNumber(enemyResources)}</span></div>
      <div class="summary-row"><span>Boss</span><span class="summary-val gold">${formatNumber(bossResources)}</span></div>
      <div class="summary-row"><span>Total Resources</span><span class="summary-val">${formatNumber(totalResources)}</span></div>
      <div class="summary-row"><span>Retained</span><span class="summary-val gold">+${formatNumber(retainedResources)} ${this.resourcesData?.resources.resources?.name || "resources"}</span></div>
      <div class="summary-row"><span>Destroyed</span><span class="summary-val">${summary.asteroidsDestroyed}</span></div>
      <div class="summary-row"><span>Max Combo</span><span class="summary-val gold">x${summary.maxCombo}</span></div>
      <div class="summary-row"><span>XP</span><span class="summary-val blue">${formatNumber(Math.floor(summary.xpGained))}</span></div>
      <div class="summary-row"><span>Run Score</span><span class="summary-val gold">${formatNumber(Math.floor(summary.score))}</span></div>
    `;
      panel.classList.add("active");
    }
    _togglePause() {
      this.running = !this.running;
      const overlay = document.getElementById("pause-overlay");
      if (overlay) overlay.classList.toggle("active", !this.running);
    }
  };

  // js/game/MetaState.js
  var META_CURRENCY_LABEL = "RESOURCES";
  var DEFAULT_WEAPON_SLOTS = 2;
  var DEFAULT_UTILITY_SLOTS = 1;
  function withUniqueNumbers(values, fallback = [0]) {
    const normalized = Array.isArray(values) ? [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))].sort((a, b) => a - b) : [];
    return normalized.length > 0 ? normalized : [...fallback];
  }
  function withUniqueStrings(values, fallback = []) {
    const normalized = Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))] : [];
    return normalized.length > 0 ? normalized : [...fallback];
  }
  var MetaState = class {
    constructor() {
      this.day = 1;
      this.runCount = 0;
      this.resources = 0;
      this.selectedZone = 0;
      this.unlockedZones = [0];
      this.clearedZones = [];
      this.purchasedSkillNodes = [];
      this.unlockedWeapons = ["basic_laser"];
      this.unlockedModules = [];
      this.unlockedSystems = [];
      this.equippedWeapons = ["basic_laser", null];
      this.utilitySlots = [null];
      this._listeners = /* @__PURE__ */ new Map();
      this._pendingNotifications = [];
    }
    get selectedSectorIndex() {
      return this.selectedZone;
    }
    set selectedSectorIndex(value) {
      this.selectedZone = value;
    }
    get unlockedSectors() {
      return this.unlockedZones;
    }
    set unlockedSectors(value) {
      this.unlockedZones = value;
    }
    get completedSectors() {
      return this.clearedZones;
    }
    set completedSectors(value) {
      this.clearedZones = value;
    }
    get ownedWeapons() {
      return this.unlockedWeapons;
    }
    set ownedWeapons(value) {
      this.unlockedWeapons = value;
    }
    get metaCurrency() {
      return this.resources;
    }
    set metaCurrency(value) {
      this.resources = Math.max(0, Math.floor(value ?? 0));
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
        if (!listeners) continue;
        for (const cb of listeners) cb(data);
      }
    }
    isSectorUnlocked(index) {
      return this.unlockedZones.includes(index);
    }
    isSectorCompleted(index) {
      return this.clearedZones.includes(index);
    }
    isSkillNodePurchased(nodeId) {
      return this.purchasedSkillNodes.includes(nodeId);
    }
    canAffordResources(amount) {
      return this.resources >= amount;
    }
    canAffordMeta(amount) {
      return this.canAffordResources(amount);
    }
    addResources(amount) {
      if (!Number.isFinite(amount) || amount <= 0) return 0;
      this.resources += Math.floor(amount);
      this.emit("metaCurrencyChanged", { value: this.resources, delta: Math.floor(amount) });
      return Math.floor(amount);
    }
    addMetaCurrency(amount) {
      return this.addResources(amount);
    }
    spendResources(amount) {
      const normalizedAmount = Math.floor(amount);
      if (!this.canAffordResources(normalizedAmount)) return false;
      this.resources -= normalizedAmount;
      this.emit("metaCurrencyChanged", { value: this.resources, delta: -normalizedAmount });
      return true;
    }
    spendMetaCurrency(amount) {
      return this.spendResources(amount);
    }
    completeRun(summary = {}, zonesData = []) {
      this.runCount += 1;
      this.day = 1 + this.runCount;
      const zoneIndex = summary.zoneIndex ?? this.selectedZone;
      const successful = Boolean(summary.success && summary.bossDefeated);
      const collected = Math.max(0, Math.floor(
        summary.resourcesCollected ?? summary.resourcesFromAsteroids ?? 0
      ));
      const retained = successful ? collected : Math.floor(collected * 0.25);
      if (retained > 0) {
        this.addResources(retained);
      }
      if (successful) {
        this.markZoneCleared(zoneIndex);
        this.unlockNextZone(zoneIndex, zonesData);
      }
      this.emit("runCompleted", {
        day: this.day,
        summary,
        successful,
        reward: retained,
        retained,
        collected,
        zoneIndex
      });
      return { successful, reward: retained, retained, collected, zoneIndex };
    }
    unlockZone(index) {
      if (!Number.isInteger(index) || index < 0 || this.unlockedZones.includes(index)) {
        return false;
      }
      this.unlockedZones.push(index);
      this.unlockedZones.sort((a, b) => a - b);
      this.emit("zoneUnlocked", { index });
      return true;
    }
    markZoneCleared(index) {
      if (!Number.isInteger(index) || index < 0 || this.clearedZones.includes(index)) {
        return false;
      }
      this.clearedZones.push(index);
      this.clearedZones.sort((a, b) => a - b);
      this.emit("zoneCleared", { index });
      return true;
    }
    unlockNextZone(index, zonesData = []) {
      const nextIndex = index + 1;
      if (nextIndex >= zonesData.length) return false;
      return this.unlockZone(nextIndex);
    }
    selectSector(index) {
      if (!this.isSectorUnlocked(index)) return false;
      this.selectedZone = index;
      this.emit("sectorSelected", { index });
      return true;
    }
    addPurchasedSkillNode(nodeId) {
      if (this.purchasedSkillNodes.includes(nodeId)) return false;
      this.purchasedSkillNodes.push(nodeId);
      this.emit("skillNodePurchased", { nodeId });
      return true;
    }
    unlockWeapon(weaponId) {
      if (!weaponId || this.unlockedWeapons.includes(weaponId)) return false;
      this.unlockedWeapons.push(weaponId);
      this.emit("weaponUnlocked", { weaponId });
      return true;
    }
    unlockModule(moduleId) {
      if (!moduleId || this.unlockedModules.includes(moduleId)) return false;
      this.unlockedModules.push(moduleId);
      this.emit("moduleUnlocked", { moduleId });
      return true;
    }
    unlockSystem(systemId) {
      if (!systemId || this.unlockedSystems.includes(systemId)) return false;
      this.unlockedSystems.push(systemId);
      this.emit("systemUnlocked", { systemId });
      return true;
    }
    equipWeapon(slotIndex, weaponId) {
      if (slotIndex < 0 || slotIndex >= this.equippedWeapons.length) return false;
      if (weaponId !== null && !this.unlockedWeapons.includes(weaponId)) return false;
      this.equippedWeapons[slotIndex] = weaponId;
      this.emit("loadoutChanged", { type: "weapon", slotIndex, weaponId });
      return true;
    }
    equipUtility(slotIndex, moduleId) {
      if (slotIndex < 0 || slotIndex >= this.utilitySlots.length) return false;
      if (moduleId !== null && !this.unlockedModules.includes(moduleId)) return false;
      this.utilitySlots[slotIndex] = moduleId;
      this.emit("loadoutChanged", { type: "utility", slotIndex, moduleId });
      return true;
    }
    serialize() {
      return {
        day: this.day,
        runCount: this.runCount,
        resources: this.resources,
        selectedZone: this.selectedZone,
        selectedSectorIndex: this.selectedZone,
        unlockedZones: [...this.unlockedZones],
        unlockedSectors: [...this.unlockedZones],
        clearedZones: [...this.clearedZones],
        completedSectors: [...this.clearedZones],
        purchasedSkillNodes: [...this.purchasedSkillNodes],
        unlockedWeapons: [...this.unlockedWeapons],
        ownedWeapons: [...this.unlockedWeapons],
        unlockedModules: [...this.unlockedModules],
        unlockedSystems: [...this.unlockedSystems],
        equippedWeapons: [...this.equippedWeapons],
        utilitySlots: [...this.utilitySlots]
      };
    }
    deserialize(data) {
      if (!data) return;
      this.day = data.day ?? 1;
      this.runCount = data.runCount ?? 0;
      this.resources = Math.max(0, Math.floor(data.resources ?? data.metaCurrency ?? 0));
      this.selectedZone = data.selectedZone ?? data.selectedSectorIndex ?? 0;
      this.unlockedZones = withUniqueNumbers(data.unlockedZones ?? data.unlockedSectors, [0]);
      this.clearedZones = withUniqueNumbers(data.clearedZones ?? data.completedSectors, []);
      this.purchasedSkillNodes = withUniqueStrings(data.purchasedSkillNodes, []);
      this.unlockedWeapons = withUniqueStrings(data.unlockedWeapons ?? data.ownedWeapons, ["basic_laser"]);
      this.unlockedModules = withUniqueStrings(data.unlockedModules, []);
      this.unlockedSystems = withUniqueStrings(data.unlockedSystems, []);
      this.equippedWeapons = Array.isArray(data.equippedWeapons) ? [...data.equippedWeapons] : ["basic_laser", null];
      while (this.equippedWeapons.length < DEFAULT_WEAPON_SLOTS) {
        this.equippedWeapons.push(null);
      }
      if (!this.equippedWeapons.some((weaponId) => weaponId === "basic_laser") && this.unlockedWeapons.includes("basic_laser")) {
        this.equippedWeapons[0] = this.equippedWeapons[0] || "basic_laser";
      }
      this.utilitySlots = Array.isArray(data.utilitySlots) ? [...data.utilitySlots] : [null];
      while (this.utilitySlots.length < DEFAULT_UTILITY_SLOTS) {
        this.utilitySlots.push(null);
      }
      if (!this.isSectorUnlocked(this.selectedZone)) {
        this.selectedZone = this.unlockedZones[0] ?? 0;
      }
    }
  };

  // js/ui/StatsPanel.js
  function renderStatsPanel(game2, metaState2) {
    const gs = game2.gs;
    const selectedZone = game2.galaxy.getAllGalaxies?.()[metaState2.selectedSectorIndex];
    const stats = {
      "Day": metaState2.day,
      [META_CURRENCY_LABEL]: metaState2.resources,
      "Selected Zone": selectedZone?.name || `Zone ${metaState2.selectedSectorIndex + 1}`,
      "Zones Cleared": metaState2.clearedZones.length,
      "Level": gs.level,
      "Hull": `${Math.floor(gs.hp)}/${gs.maxHp}`,
      "Shield": gs.maxShield > 0 ? Math.floor(gs.maxShield) : "\u2014",
      "Click DMG": formatNumber(Math.floor(game2.clickDamage)),
      "Crit %": `${Math.round(game2.critChance * 100)}%`,
      "Crit Mult": `${game2.critMult.toFixed(1)}x`,
      "Resource Mult": `${Math.round(game2.resourceMult * 100)}%`,
      "Run Time": `${gs.baseExpeditionTime + game2.expeditionTimeBonus}s`,
      "Boss Progress": `${Math.round(game2.bossProgressMult * 100)}%`,
      "Runs": metaState2.runCount,
      "Fail Retention": "25%"
    };
    const currentResources = Object.entries(gs.resources).filter(([, v]) => v > 0).map(([key, val]) => {
      const info = resources_default.resources[key];
      return `<div class="bank-row"><span class="bank-name" style="color:${info?.color || "#aaa"}">${info?.name || key}</span><span class="bank-val">${formatNumber(Math.floor(val))}</span></div>`;
    }).join("");
    return `
    <div class="stats-section">
      <div class="stats-title">CAMPAIGN STATUS</div>
      ${Object.entries(stats).map(
      ([k, v]) => `<div class="stat-row"><span class="stat-key">${k}</span><span class="stat-val">${v}</span></div>`
    ).join("")}
    </div>
    <div class="stats-section bank-section">
      <div class="stats-title">RUN RESOURCES</div>
      ${currentResources || '<div class="bank-empty">Empty</div>'}
    </div>
  `;
  }

  // js/ui/SectorsPanel.js
  function renderSectorsPanel(metaState2, gameState, sectorsData) {
    const sectors = sectorsData.map((sector, i) => {
      const unlocked = metaState2.isSectorUnlocked(i);
      const completed = metaState2.isSectorCompleted(i);
      const selected = metaState2.selectedSectorIndex === i;
      const previousSector = i > 0 ? sectorsData[i - 1] : null;
      const unlockHtml = unlocked ? `<span class="sector-cost free">AVAILABLE</span>` : `<span class="sector-cost">Beat ${previousSector?.bossName || previousSector?.name || "previous boss"} to unlock</span>`;
      return `
      <div class="sector-card ${unlocked ? "unlocked" : "locked"} ${selected ? "selected" : ""} ${completed ? "completed" : ""}">
        <div class="sector-header">
          <span class="sector-difficulty">${"\u2605".repeat(sector.difficulty)}</span>
          <span class="sector-name">${sector.name}</span>
        </div>
        <div class="sector-desc">${sector.description}</div>
        <div class="sector-costs">${unlockHtml}</div>
        <div class="sector-costs">
          <span class="sector-cost">Boss: ${sector.bossName || sector.bossId}</span>
          <span class="sector-cost">Boss payout: ${sector.resourceReward ?? 0} resources</span>
        </div>
        ${sector.recommendedPower ? `<div class="sector-desc">Recommended: ${sector.recommendedPower}</div>` : ""}
        ${completed ? '<div class="sector-badge completed-badge">CLEARED</div>' : ""}
        ${!unlocked ? '<div class="sector-badge locked-badge">LOCKED</div>' : ""}
        ${selected ? '<div class="sector-badge selected-badge">SELECTED</div>' : ""}
        <div class="sector-actions">
          ${unlocked && !selected ? `<button class="sector-btn select-btn" onclick="window.station.selectSector(${i})">SELECT</button>` : ""}
        </div>
      </div>
    `;
    }).join("");
    return `
    <div class="sectors-header">
      <span class="sectors-title">CAMPAIGN MAP</span>
    </div>
    <div class="sectors-grid">${sectors}</div>
  `;
  }

  // js/ui/LoadoutTray.js
  function renderLoadoutTray(metaState2) {
    const equipped = metaState2.equippedWeapons;
    const utility = metaState2.utilitySlots;
    const weaponSlots = equipped.map((weaponId, i) => {
      const weapon = weaponId ? weapons_default.find((w) => w.id === weaponId) : null;
      return `
      <div class="loadout-slot ${weapon ? "filled" : "empty"}" data-slot="${i}" data-type="weapon">
        <div class="slot-label">${i === 0 ? "PRIMARY" : "SECONDARY"}</div>
        ${weapon ? `<div class="slot-weapon-name">${weapon.name}</div>
             <div class="slot-weapon-desc">${weapon.description}</div>` : '<div class="slot-empty-text">Empty</div>'}
      </div>
    `;
    }).join("");
    const utilitySlots = utility.map((moduleId, i) => {
      const mod = moduleId ? weapons_default.find((w) => w.id === moduleId) : null;
      return `
      <div class="loadout-slot utility ${mod ? "filled" : "empty"}" data-slot="${i}" data-type="utility">
        <div class="slot-label">UTILITY</div>
        ${mod ? `<div class="slot-weapon-name">${mod.name}</div>` : '<div class="slot-empty-text">Empty</div>'}
      </div>
    `;
    }).join("");
    const ownedWeapons = metaState2.unlockedWeapons.filter((id) => !equipped.includes(id)).map((id) => weapons_default.find((w) => w.id === id)).filter(Boolean);
    const ownedModules = metaState2.unlockedModules.filter((id) => !utility.includes(id)).map((id) => weapons_default.find((w) => w.id === id)).filter(Boolean);
    const armoryHtml = ownedWeapons.length > 0 ? ownedWeapons.map((w) => `
        <div class="armory-item" onclick="window.station.equipWeaponFromArmory('${w.id}')">
          <span class="armory-name">${w.name}</span>
          <span class="armory-tier ${w.tier}">${w.tier.toUpperCase()}</span>
        </div>
      `).join("") : '<div class="armory-empty">No extra weapons unlocked</div>';
    const utilityArmoryHtml = ownedModules.length > 0 ? ownedModules.map((mod) => `
        <div class="armory-item" onclick="window.station.equipUtilityFromArmory('${mod.id}')">
          <span class="armory-name">${mod.name}</span>
          <span class="armory-tier ${mod.tier}">${mod.tier.toUpperCase()}</span>
        </div>
      `).join("") : '<div class="armory-empty">No utility modules unlocked</div>';
    return `
    <div class="loadout-tray">
      <div class="loadout-section">
        <span class="loadout-title">WEAPONS</span>
        <div class="loadout-slots">${weaponSlots}</div>
      </div>
      <div class="loadout-section">
        <span class="loadout-title">UTILITY</span>
        <div class="loadout-slots">${utilitySlots}</div>
      </div>
      <div class="loadout-section armory">
        <span class="loadout-title">WEAPON ARMORY</span>
        <div class="armory-list">${armoryHtml}</div>
      </div>
      <div class="loadout-section armory">
        <span class="loadout-title">UTILITY ARMORY</span>
        <div class="armory-list">${utilityArmoryHtml}</div>
      </div>
    </div>
  `;
  }

  // js/ui/SkillTreePanel.js
  var GRAPH_WIDTH = 960;
  var GRAPH_HEIGHT = 760;
  var NODE_LAYOUT = {
    core_targeting: { x: 438, y: 338, size: 84 },
    combat_throttle: { x: 448, y: 246, size: 64 },
    crit_matrix: { x: 448, y: 164, size: 60 },
    pulse_cannon_license: { x: 374, y: 164, size: 60 },
    plasma_rifle_license: { x: 374, y: 86, size: 60 },
    overcharge_chamber: { x: 448, y: 86, size: 60 },
    quantum_driver_license: { x: 522, y: 86, size: 60 },
    hull_rivets: { x: 346, y: 348, size: 64 },
    reinforced_bulkheads: { x: 258, y: 348, size: 60 },
    shield_booster_license: { x: 258, y: 274, size: 60 },
    particle_screening: { x: 170, y: 311, size: 60 },
    repair_drone_license: { x: 96, y: 311, size: 60 },
    emergency_regen: { x: 96, y: 237, size: 60 },
    salvage_routines: { x: 448, y: 430, size: 64 },
    ore_crushers: { x: 448, y: 514, size: 60 },
    spread_shot_license: { x: 374, y: 514, size: 60 },
    precision_extractors: { x: 448, y: 598, size: 60 },
    cargo_expander_license: { x: 374, y: 598, size: 60 },
    deep_core_reprocessing: { x: 448, y: 682, size: 60 },
    vector_thrusters: { x: 550, y: 348, size: 64 },
    time_dilation: { x: 640, y: 348, size: 60 },
    boss_scanner: { x: 728, y: 348, size: 60 },
    cooldown_mesh: { x: 728, y: 422, size: 60 },
    void_beam_license: { x: 816, y: 422, size: 60 }
  };
  var GLYPHS = {
    core_targeting: "\u2699",
    combat_throttle: "ROF",
    crit_matrix: "CRT",
    pulse_cannon_license: "WPN",
    plasma_rifle_license: "PLS",
    overcharge_chamber: "AMP",
    quantum_driver_license: "QNT",
    hull_rivets: "HP",
    reinforced_bulkheads: "HUL",
    shield_booster_license: "SHD",
    particle_screening: "SCR",
    repair_drone_license: "DRN",
    emergency_regen: "REG",
    salvage_routines: "ORE",
    ore_crushers: "MIN",
    spread_shot_license: "SPR",
    precision_extractors: "PRC",
    cargo_expander_license: "CRG",
    deep_core_reprocessing: "DCR",
    vector_thrusters: "SPD",
    time_dilation: "TIME",
    boss_scanner: "BOSS",
    cooldown_mesh: "CDR",
    void_beam_license: "VOID"
  };
  var BRANCH_LABELS = {
    shared: "Core",
    offense: "Offense",
    defense: "Defense",
    mining: "Mining",
    utility: "Utility"
  };
  var EFFECT_LABELS = {
    click_damage_flat: "flat damage",
    click_damage_mult: "damage multiplier",
    crit_chance: "crit chance",
    crit_mult: "crit damage",
    max_hp: "max hull",
    shield: "shield conversion",
    passive_regen: "passive regen",
    resource_mult: "resource yield",
    boss_progress: "boss progress",
    expedition_time: "run time",
    fire_rate: "fire rate",
    ship_speed: "ship speed"
  };
  function centerOf(layout) {
    return {
      x: layout.x + layout.size / 2,
      y: layout.y + layout.size / 2
    };
  }
  function formatEffect(node) {
    if (node.effectType === "unlock_weapon") return `Unlock weapon: ${node.effectValue}`;
    if (node.effectType === "unlock_module") return `Unlock module: ${node.effectValue}`;
    if (node.effectType === "unlock_system") return `Unlock system: ${node.effectValue}`;
    const label = EFFECT_LABELS[node.effectKey] || node.effectKey;
    const numericValue = Number(node.effectValue);
    const isPercent = ["crit_chance", "click_damage_mult", "max_hp", "shield", "passive_regen", "resource_mult", "boss_progress"].includes(node.effectKey);
    if (isPercent) {
      return `+${Math.round(numericValue * 100)}% ${label}`;
    }
    return `+${numericValue} ${label}`;
  }
  function getNodeStateClass(state) {
    return state.isPurchased ? "purchased" : state.canPurchase ? "available" : "locked";
  }
  function getNodeGlyph(node, state) {
    if (node.id === "core_targeting") return GLYPHS[node.id] || "\u2699";
    if (!state.isPurchased && !state.canPurchase) return "?";
    return GLYPHS[node.id] || node.title.slice(0, 3).toUpperCase();
  }
  function formatRequirementNotes(node, state, skillTree) {
    const notes = [];
    if (state.missingPrerequisites.length > 0) {
      const missingTitles = state.missingPrerequisites.map((prerequisiteId) => {
        return skillTree.getNode(prerequisiteId)?.title || prerequisiteId;
      });
      notes.push(`Requires: ${missingTitles.join(", ")}`);
    }
    if ((node.requiredZonesCleared || []).length > 0) {
      notes.push(`Zone clears: ${(node.requiredZonesCleared || []).map((zone) => zone + 1).join(", ")}`);
    }
    return notes;
  }
  function getTooltipStatus(node, state) {
    if (state.isPurchased) {
      return {
        label: "PURCHASED",
        cost: "OWNED"
      };
    }
    if (state.canPurchase) {
      return {
        label: "CLICK TO BUY",
        cost: `${node.cost} ${META_CURRENCY_LABEL}`
      };
    }
    return {
      label: "LOCKED",
      cost: `${node.cost} ${META_CURRENCY_LABEL}`
    };
  }
  function renderConnections(skillTree) {
    const paths = [];
    for (const node of skillTree.getNodes()) {
      const endLayout = NODE_LAYOUT[node.id];
      if (!endLayout) continue;
      for (const prerequisiteId of node.prerequisites || []) {
        const startLayout = NODE_LAYOUT[prerequisiteId];
        if (!startLayout) continue;
        const from = centerOf(startLayout);
        const to = centerOf(endLayout);
        const elbowX = Math.abs(from.x - to.x) > Math.abs(from.y - to.y) ? (from.x + to.x) / 2 : from.x;
        const elbowY = Math.abs(from.y - to.y) >= Math.abs(from.x - to.x) ? (from.y + to.y) / 2 : to.y;
        const purchased = skillTree.isPurchased(prerequisiteId) && skillTree.isPurchased(node.id);
        const reachable = skillTree.isPurchased(prerequisiteId) && !skillTree.isPurchased(node.id);
        paths.push(`
        <path
          class="skill-link ${purchased ? "purchased" : reachable ? "reachable" : "locked"}"
          d="M ${from.x} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${elbowY} L ${to.x} ${elbowY} L ${to.x} ${to.y}"
        />
      `);
      }
    }
    return `
    <svg class="skill-graph-lines" viewBox="0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}" aria-hidden="true">
      ${paths.join("")}
    </svg>
  `;
  }
  function renderTooltip(node, state, skillTree) {
    const status = getTooltipStatus(node, state);
    const notes = formatRequirementNotes(node, state, skillTree);
    return `
    <div class="skill-node-tooltip" role="tooltip">
      <div class="skill-node-tooltip-top">
        <div>
          <div class="skill-node-tooltip-branch">${BRANCH_LABELS[node.branch] || node.branch} \xB7 T${node.tier + 1}</div>
          <div class="skill-node-tooltip-title">${node.title}</div>
        </div>
        <div class="skill-node-tooltip-cost">${status.cost}</div>
      </div>
      <div class="skill-node-tooltip-status ${state.isPurchased ? "purchased" : state.canPurchase ? "available" : "locked"}">${status.label}</div>
      <div class="skill-node-tooltip-desc">${node.description}</div>
      <div class="skill-node-tooltip-effect">${formatEffect(node)}</div>
      ${notes.map((note) => `<div class="skill-node-tooltip-note">${note}</div>`).join("")}
    </div>
  `;
  }
  function renderNodeButton(node, skillTree) {
    const layout = NODE_LAYOUT[node.id];
    if (!layout) return "";
    const state = skillTree.getNodeState(node.id);
    const className = getNodeStateClass(state);
    return `
    <div
      class="skill-graph-node-wrap"
      style="left:${layout.x}px;top:${layout.y}px;width:${layout.size}px;height:${layout.size}px"
    >
      <button
        type="button"
        class="skill-graph-node ${className} ${node.id === "core_targeting" ? "core" : ""}"
        style="width:${layout.size}px;height:${layout.size}px"
        onclick="window.station.purchaseSkillNode('${node.id}')"
        aria-label="${node.title}"
        aria-disabled="${state.canPurchase ? "false" : "true"}"
      >
        <span class="skill-graph-glyph">${getNodeGlyph(node, state)}</span>
      </button>
      ${renderTooltip(node, state, skillTree)}
    </div>
  `;
  }
  function renderSkillTreePanel(skillTree, pan = { x: 0, y: 0 }) {
    const nodes = skillTree.getNodes();
    const zoomPercent = Math.round((pan.zoom ?? 1) * 100);
    return `
    <div class="skill-tree-toolbar">
      <div class="skill-tree-zoom-controls" aria-label="Skill tree zoom controls">
        <button type="button" class="skill-tree-zoom-btn" onclick="window.station.zoomSkillTree(-1)" aria-label="Zoom out">\u2212</button>
        <button type="button" class="skill-tree-zoom-level" onclick="window.station.fitSkillTree()" aria-label="Fit skill tree to viewport">${zoomPercent}%</button>
        <button type="button" class="skill-tree-zoom-btn" onclick="window.station.zoomSkillTree(1)" aria-label="Zoom in">+</button>
      </div>
    </div>

    <div class="skill-tree-graph-shell">
      <div class="skill-tree-viewport" data-skill-tree-viewport>
        <div
          class="skill-tree-graph ${pan.dragging ? "dragging" : ""}"
          data-skill-tree-graph
          style="--graph-width:${GRAPH_WIDTH}px;--graph-height:${GRAPH_HEIGHT}px;transform:translate3d(${pan.x ?? 0}px, ${pan.y ?? 0}px, 0) scale(${pan.zoom ?? 1})"
        >
          <div class="skill-tree-backdrop"></div>
          <div class="skill-tree-core-ring"></div>
          ${renderConnections(skillTree)}
          ${nodes.map((node) => renderNodeButton(node, skillTree)).join("")}
        </div>
      </div>
      <div class="skill-tree-legend">
        <div class="legend-item"><span class="legend-swatch available"></span> Available</div>
        <div class="legend-item"><span class="legend-swatch purchased"></span> Purchased</div>
        <div class="legend-item"><span class="legend-swatch locked"></span> Hidden / locked</div>
      </div>
    </div>
  `;
  }

  // js/ui/StationScreen.js
  var SKILL_TREE_MIN_ZOOM = 0.65;
  var SKILL_TREE_MAX_ZOOM = 1.8;
  var SKILL_TREE_ZOOM_STEP = 0.14;
  var SKILL_TREE_FIT_PADDING = 32;
  var StationScreen = class {
    constructor(game2, metaState2, sectorsData) {
      this.game = game2;
      this.meta = metaState2;
      this.sectorsData = sectorsData;
      this.currentView = "campaign";
      this.skillTreePan = { x: null, y: null, zoom: null, dragging: false };
      this._skillTreeDrag = null;
      this._suppressSkillTreeClickUntil = 0;
    }
    init() {
      this.render();
      this._bindEvents();
    }
    render() {
      const wrapper = document.getElementById("station-wrapper");
      if (!wrapper) return;
      wrapper.innerHTML = this._buildShell();
      this._bindEvents();
    }
    _buildShell() {
      return `
      <div class="station-layout">
        <div class="station-nav">
          <button class="nav-btn ${this.currentView === "campaign" ? "active" : ""}" data-view="campaign">CAMPAIGN</button>
          <button class="nav-btn ${this.currentView === "skills" ? "active" : ""}" data-view="skills">SKILL TREE</button>
          <div class="nav-meta">
            <span class="nav-meta-label">${META_CURRENCY_LABEL}</span>
            <span class="nav-meta-value">${this.meta.resources}</span>
          </div>
          <div class="nav-day">RUN ${this.meta.runCount}</div>
          <button class="nav-btn settings-btn" onclick="window.station.showSettings()">SETTINGS</button>
        </div>
        <div class="station-body">
          <div class="station-center ${this.currentView === "skills" ? "skills-view" : ""}">
            ${this.currentView === "campaign" ? this._renderCampaignView() : ""}
            ${this.currentView === "skills" ? this._renderSkillTreeView() : ""}
          </div>
          <div class="station-right">
            ${renderStatsPanel(this.game, this.meta)}
            <div class="launch-section">
              <div class="launch-sector">${this._getSelectedSectorName()}</div>
              <div class="launch-meta">Boss payout: ${this._getSelectedSectorReward()} ${META_CURRENCY_LABEL}</div>
              <div class="launch-meta">Failure keeps 25% of gathered ${META_CURRENCY_LABEL.toLowerCase()}</div>
              <button class="launch-btn" onclick="window.station.launch()">
                \u25B6 LAUNCH
              </button>
              <div class="launch-time">RUN ${this.game.gs.baseExpeditionTime + this.game.expeditionTimeBonus}s</div>
            </div>
          </div>
        </div>
        <div class="station-bottom">
          ${renderLoadoutTray(this.meta)}
        </div>
      </div>
    `;
    }
    _renderCampaignView() {
      return `
      <div class="campaign-panel">
        ${renderSectorsPanel(this.meta, this.game.gs, this.sectorsData)}
      </div>
    `;
    }
    _renderSkillTreeView() {
      return `
      <div class="skill-tree-panel">
        ${renderSkillTreePanel(this.game.skillTree, this.skillTreePan)}
      </div>
    `;
    }
    _getSelectedSectorName() {
      const sector = this.sectorsData[this.meta.selectedSectorIndex];
      return sector ? sector.name : "Unknown";
    }
    _getSelectedSectorReward() {
      const sector = this.sectorsData[this.meta.selectedSectorIndex];
      return sector?.resourceReward ?? 0;
    }
    _bindEvents() {
      const wrapper = document.getElementById("station-wrapper");
      if (!wrapper) return;
      wrapper.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.currentView = btn.dataset.view;
          this.render();
        });
      });
      this._bindSkillTreePan(wrapper);
    }
    _bindSkillTreePan(wrapper) {
      const viewport = wrapper.querySelector("[data-skill-tree-viewport]");
      const graph = wrapper.querySelector("[data-skill-tree-graph]");
      if (!viewport || !graph) return;
      this._ensureSkillTreePan(viewport, graph);
      this._applySkillTreeTransform(graph);
      this._updateSkillTreeZoomDisplay(wrapper);
      viewport.addEventListener("click", (event) => {
        if (Date.now() < this._suppressSkillTreeClickUntil) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
      viewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        this._skillTreeDrag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: this.skillTreePan.x,
          originY: this.skillTreePan.y,
          moved: false
        };
        this.skillTreePan.dragging = false;
        viewport.setPointerCapture(event.pointerId);
      });
      viewport.addEventListener("pointermove", (event) => {
        if (!this._skillTreeDrag || this._skillTreeDrag.pointerId !== event.pointerId) return;
        const dx = event.clientX - this._skillTreeDrag.startX;
        const dy = event.clientY - this._skillTreeDrag.startY;
        if (!this._skillTreeDrag.moved && Math.hypot(dx, dy) > 6) {
          this._skillTreeDrag.moved = true;
          this.skillTreePan.dragging = true;
          graph.classList.add("dragging");
        }
        if (!this._skillTreeDrag.moved) return;
        const nextPan = this._clampSkillTreePan(
          viewport,
          graph,
          this._skillTreeDrag.originX + dx,
          this._skillTreeDrag.originY + dy
        );
        this.skillTreePan.x = nextPan.x;
        this.skillTreePan.y = nextPan.y;
        this._applySkillTreeTransform(graph);
      });
      viewport.addEventListener("wheel", (event) => {
        event.preventDefault();
        const zoomFactor = event.deltaY < 0 ? 1 + SKILL_TREE_ZOOM_STEP : 1 / (1 + SKILL_TREE_ZOOM_STEP);
        const nextZoom = this._clampSkillTreeZoom((this.skillTreePan.zoom ?? 1) * zoomFactor);
        this._setSkillTreeZoom(viewport, graph, nextZoom, event.clientX, event.clientY);
      }, { passive: false });
      const finishDrag = (event) => {
        if (!this._skillTreeDrag || this._skillTreeDrag.pointerId !== event.pointerId) return;
        if (this._skillTreeDrag.moved) {
          this._suppressSkillTreeClickUntil = Date.now() + 50;
        }
        this.skillTreePan.dragging = false;
        graph.classList.remove("dragging");
        this._skillTreeDrag = null;
        try {
          viewport.releasePointerCapture(event.pointerId);
        } catch {
        }
      };
      viewport.addEventListener("pointerup", finishDrag);
      viewport.addEventListener("pointercancel", finishDrag);
    }
    _ensureSkillTreePan(viewport, graph) {
      if (this.skillTreePan.zoom === null) {
        this.skillTreePan.zoom = this._getFitSkillTreeZoom(viewport, graph);
      }
      const centered = this._getCenteredSkillTreePan(viewport, graph, this.skillTreePan.zoom);
      if (this.skillTreePan.x === null || this.skillTreePan.y === null) {
        this.skillTreePan.x = centered.x;
        this.skillTreePan.y = centered.y;
        return;
      }
      const clamped = this._clampSkillTreePan(viewport, graph, this.skillTreePan.x, this.skillTreePan.y);
      this.skillTreePan.x = clamped.x;
      this.skillTreePan.y = clamped.y;
    }
    _getCenteredSkillTreePan(viewport, graph, zoom = this.skillTreePan.zoom ?? 1) {
      const viewportRect = viewport.getBoundingClientRect();
      const graphWidth = graph.offsetWidth * zoom;
      const graphHeight = graph.offsetHeight * zoom;
      return {
        x: (viewportRect.width - graphWidth) / 2,
        y: (viewportRect.height - graphHeight) / 2
      };
    }
    _clampSkillTreePan(viewport, graph, x, y) {
      const viewportRect = viewport.getBoundingClientRect();
      const zoom = this.skillTreePan.zoom ?? 1;
      const graphWidth = graph.offsetWidth * zoom;
      const graphHeight = graph.offsetHeight * zoom;
      const centered = this._getCenteredSkillTreePan(viewport, graph, zoom);
      const minX = graphWidth <= viewportRect.width ? centered.x : viewportRect.width - graphWidth;
      const maxX = graphWidth <= viewportRect.width ? centered.x : 0;
      const minY = graphHeight <= viewportRect.height ? centered.y : viewportRect.height - graphHeight;
      const maxY = graphHeight <= viewportRect.height ? centered.y : 0;
      return {
        x: Math.min(maxX, Math.max(minX, x)),
        y: Math.min(maxY, Math.max(minY, y))
      };
    }
    _applySkillTreeTransform(graph) {
      graph.style.transform = `translate3d(${this.skillTreePan.x ?? 0}px, ${this.skillTreePan.y ?? 0}px, 0) scale(${this.skillTreePan.zoom ?? 1})`;
    }
    _clampSkillTreeZoom(zoom) {
      return Math.min(SKILL_TREE_MAX_ZOOM, Math.max(SKILL_TREE_MIN_ZOOM, zoom));
    }
    _getFitSkillTreeZoom(viewport, graph) {
      const viewportRect = viewport.getBoundingClientRect();
      const fitWidth = Math.max(0.1, (viewportRect.width - SKILL_TREE_FIT_PADDING * 2) / graph.offsetWidth);
      const fitHeight = Math.max(0.1, (viewportRect.height - SKILL_TREE_FIT_PADDING * 2) / graph.offsetHeight);
      return this._clampSkillTreeZoom(Math.min(fitWidth, fitHeight));
    }
    _setSkillTreeZoom(viewport, graph, zoom, clientX, clientY) {
      const nextZoom = this._clampSkillTreeZoom(zoom);
      const previousZoom = this.skillTreePan.zoom ?? 1;
      if (Math.abs(nextZoom - previousZoom) < 1e-3) return;
      const viewportRect = viewport.getBoundingClientRect();
      const anchorX = clientX !== void 0 ? clientX - viewportRect.left : viewportRect.width / 2;
      const anchorY = clientY !== void 0 ? clientY - viewportRect.top : viewportRect.height / 2;
      const worldX = (anchorX - (this.skillTreePan.x ?? 0)) / previousZoom;
      const worldY = (anchorY - (this.skillTreePan.y ?? 0)) / previousZoom;
      this.skillTreePan.zoom = nextZoom;
      const nextPan = this._clampSkillTreePan(
        viewport,
        graph,
        anchorX - worldX * nextZoom,
        anchorY - worldY * nextZoom
      );
      this.skillTreePan.x = nextPan.x;
      this.skillTreePan.y = nextPan.y;
      this._applySkillTreeTransform(graph);
      this._updateSkillTreeZoomDisplay();
    }
    zoomSkillTree(direction) {
      const wrapper = document.getElementById("station-wrapper");
      const viewport = wrapper?.querySelector("[data-skill-tree-viewport]");
      const graph = wrapper?.querySelector("[data-skill-tree-graph]");
      if (!viewport || !graph) return;
      this._ensureSkillTreePan(viewport, graph);
      const factor = direction > 0 ? 1 + SKILL_TREE_ZOOM_STEP : 1 / (1 + SKILL_TREE_ZOOM_STEP);
      this._setSkillTreeZoom(viewport, graph, (this.skillTreePan.zoom ?? 1) * factor);
    }
    fitSkillTree() {
      const wrapper = document.getElementById("station-wrapper");
      const viewport = wrapper?.querySelector("[data-skill-tree-viewport]");
      const graph = wrapper?.querySelector("[data-skill-tree-graph]");
      if (!viewport || !graph) return;
      this.skillTreePan.zoom = this._getFitSkillTreeZoom(viewport, graph);
      const centered = this._getCenteredSkillTreePan(viewport, graph, this.skillTreePan.zoom);
      this.skillTreePan.x = centered.x;
      this.skillTreePan.y = centered.y;
      this._applySkillTreeTransform(graph);
      this._updateSkillTreeZoomDisplay(wrapper);
    }
    _updateSkillTreeZoomDisplay(wrapper = document.getElementById("station-wrapper")) {
      const zoomLabel = wrapper?.querySelector(".skill-tree-zoom-level");
      if (zoomLabel) {
        zoomLabel.textContent = `${Math.round((this.skillTreePan.zoom ?? 1) * 100)}%`;
      }
    }
    switchView(view) {
      this.currentView = view;
      this.render();
    }
    selectSector(index) {
      if (!this.meta.selectSector(index)) return;
      this.game.travelToGalaxy(index);
      this.game._recalcStats();
      this.render();
    }
    purchaseSkillNode(nodeId) {
      if (!this.game.skillTree.purchase(nodeId)) return;
      this.game._recalcStats();
      this.render();
    }
    equipWeaponFromArmory(weaponId) {
      const equipped = this.meta.equippedWeapons;
      const emptySlot = equipped.indexOf(null);
      if (emptySlot >= 0) {
        this.meta.equipWeapon(emptySlot, weaponId);
      } else {
        this.meta.equipWeapon(0, weaponId);
      }
      this.game._recalcStats();
      this.render();
    }
    equipUtilityFromArmory(moduleId) {
      const emptySlot = this.meta.utilitySlots.indexOf(null);
      if (emptySlot >= 0) {
        this.meta.equipUtility(emptySlot, moduleId);
      } else {
        this.meta.equipUtility(0, moduleId);
      }
      this.game._recalcStats();
      this.render();
    }
    launch() {
      if (this.game.gs.isExpeditionActive()) return;
      this.game.gs.currentGalaxyIndex = this.meta.selectedSectorIndex;
      this.game.galaxy.loadData(this.sectorsData);
      this.game._generateStars();
      this.game._recalcStats();
      this.game.startExpedition();
    }
    showSettings() {
      const el = document.getElementById("settings-panel");
      if (el) el.style.display = "flex";
    }
    hideSettings() {
      const el = document.getElementById("settings-panel");
      if (el) el.style.display = "none";
    }
    exportSave() {
      const data = this.game.save.exportSave();
      const textarea = document.getElementById("export-textarea");
      if (textarea) {
        textarea.value = data;
        textarea.style.display = "block";
      }
      navigator.clipboard?.writeText(data);
    }
    showImport() {
      const textarea = document.getElementById("import-textarea");
      if (textarea) {
        textarea.style.display = "block";
        textarea.value = "";
      }
      const row = document.getElementById("import-confirm-row");
      if (row) row.style.display = "flex";
    }
    importSave() {
      const textarea = document.getElementById("import-textarea");
      if (!textarea) return;
      const result = this.game.save.importSave(textarea.value);
      if (result.success) {
        this.game._recalcStats();
        location.reload();
      } else {
        alert("Invalid save data: " + result.error);
      }
    }
    resetGame() {
      if (confirm("Are you sure? This will delete all progress!")) {
        localStorage.removeItem("singularity_rush_save");
        location.reload();
      }
    }
    returnToStation() {
      const panel = document.getElementById("run-summary");
      if (panel) panel.classList.remove("active");
      this.render();
      this.game._showStation();
    }
  };

  // js/app.js
  var metaState = new MetaState();
  var game = new Game(metaState);
  var station = new StationScreen(game, metaState, sectors_default);
  window.station = station;
  window.gameUI = {
    startExpedition() {
      station.launch();
    },
    closeRunSummary() {
      station.returnToStation();
    },
    switchTab() {
    }
  };
  game.resourcesData = resources_default;
  function initStation() {
    station.init();
  }
  game._stationInit = initStation;
  game._metaState = metaState;
  game.init();
})();
