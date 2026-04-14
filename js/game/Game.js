import { GameState } from './GameState.js';
import { Asteroid, AsteroidManager } from './Asteroid.js';
import { Ship } from './Ship.js';
import { Projectile } from './Projectile.js';
import { ComboSystem } from './Combo.js';
import { Galaxy } from './Galaxy.js';
import { calculateCombatStats } from './StatCalculator.js';
import { ParticleSystem } from '../rendering/Particles.js';
import { ScreenEffects } from '../rendering/Effects.js';
import { UIManager } from '../rendering/UI.js';
import { SaveManager } from '../utils/SaveManager.js';
import { SkillTree } from '../systems/SkillTree.js';
import { audio } from '../utils/Audio.js';
import { formatNumber, randomRange, dist } from '../utils/Math.js';
import galaxiesData from '../data/galaxies.js';
import sectorsData from '../data/sectors.js';
import skillsData from '../data/skills.js';
import resourcesData from '../data/resources.js';
import weaponsData from '../data/weapons.js';

const PROJ_SPEED = 600;
const BASE_FIRE_RATE = 3.0;
const BASE_SHIP_SPEED = 220;
const BASE_ASTEROID_RESOURCE_REWARD = 1;
const BASE_ENEMY_RESOURCE_REWARD = 2;

export class Game {
  constructor(metaState) {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.gs = new GameState();
    this.particles = new ParticleSystem();
    this.effects = new ScreenEffects();
    this.asteroidMgr = new AsteroidManager();
    this.combo = new ComboSystem(this.gs);
    this.galaxy = new Galaxy(this.gs);
    this.skillTree = new SkillTree(metaState || null);
    this.ui = new UIManager(this.gs);

    this._metaState = metaState || null;
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
    window.addEventListener('resize', () => this._resizeCanvas());

    audio.init();

    this.galaxy.loadData(sectorsData);
    this.skillTree.loadData(skillsData);
    this.skillTree.bindMetaState(this._metaState);
    this.resourcesData = resourcesData;

    if (this.save.hasAutoSave()) {
      this.save.loadAutoSave();
    }

    this._syncMetaProgression();
    this.galaxy.loadData(sectorsData);
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

    this.gs.emit('gameReady', {});

    // Show station, hide game area
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
    const station = document.getElementById('station-wrapper');
    const gameArea = document.getElementById('game-area');
    if (station) station.classList.remove('hidden');
    if (gameArea) gameArea.classList.remove('active');

    if (this._stationInit) {
      this._stationInit();
    }
  }

  _showGameArea() {
    const station = document.getElementById('station-wrapper');
    const gameArea = document.getElementById('game-area');
    if (station) station.classList.add('hidden');
    if (gameArea) gameArea.classList.add('active');
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
    // Mouse tracking for ship follow
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (this._ship) {
        this._ship.setMouseTarget(e.clientX - rect.left, e.clientY - rect.top);
      }
    });

    this.canvas.addEventListener('click', () => {
      audio.resume();
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._togglePause();
      }
    });
  }

  _setupGameListeners() {
    this.gs.on('levelUp', () => {
      audio.upgrade();
      this.effects.shake(5, 0.3);
      this.particles.emitScreenFlash('#f0c040', 0.2);
      this._recalcStats();
    });

    this.gs.on('comboMilestone', ({ level }) => {
      audio.comboMilestone(level);
      this.effects.shake(level / 5, 0.3);
    });

    this.gs.on('galaxyUnlocked', ({ index }) => {
      audio.newGalaxy();
      this.effects.shake(10, 0.5);
      this._clearBossEncounter();
      this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
      this._generateStars();
      this._recalcStats();
    });

    this.gs.on('galaxyTraveled', ({ index }) => {
      audio.newGalaxy();
      this.effects.shake(5, 0.3);
      this._clearBossEncounter();
      this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
      this._generateStars();
      this._recalcStats();
    });

    this.gs.on('bossSpawn', ({ data }) => {
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

    this.gs.on('bossDefeated', ({ reward }) => {
      audio.bossKill();
      this.effects.shake(12, 0.6);
      this.particles.emitScreenFlash('#ffd700', 0.3);
      this._clearBossEncounter();
      const bossResources = Math.max(0, Math.floor(reward.resources ?? this.galaxy.getCurrent()?.resourceReward ?? 0));
      const gained = this.gs.addRunResources('boss', bossResources);
      const label = gained > 0
        ? `+${formatNumber(gained)} ${this.resourcesData?.resources.resources?.name || 'resources'}`
        : '';
      if (label) {
        this.ui.addFloatingText(this.canvas.width / 2, 90, label, '#ffd700', 20);
      }

      if (this.gs.expeditionState.active) {
        this.gs.expeditionState.success = true;
        this.gs.expeditionState.bossDefeated = true;
        this.gs.endExpedition();
      }
    });

    this._metaState?.on('skillTreeChanged', () => {
      audio.upgrade();
      this._recalcStats();
    });

    this.gs.on('playerDied', () => {
      this.effects.shake(10, 0.5);
      this.particles.emitScreenFlash('#ff0000', 0.3);
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

    this.gs.on('expeditionStart', () => {
      this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
      this._showGameArea();

      // Create ship at canvas center
      this._ship = new Ship(this.canvas.width / 2, this.canvas.height / 2);
      this._projectiles = [];

      const timer = document.getElementById('expedition-timer');
      if (timer) timer.style.display = 'block';
    });

    this.gs.on('expeditionEnd', () => {
      this.asteroidMgr.asteroids = [];
      this._ship = null;
      this._projectiles = [];

      const timer = document.getElementById('expedition-timer');
      if (timer) timer.style.display = 'none';

      if (this._metaState) {
        this._metaState.completeRun(this.gs.expeditionState, sectorsData);
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
    const weaponId = this._metaState?.equippedWeapons?.[0] || 'basic_laser';
    const weapon = weaponsData.find(w => w.id === weaponId);
    return weapon?.stats || { damage: 1.0, fireRate: 1.0 };
  }

  _getEnemies() {
    const enemies = this.asteroidMgr.asteroids.filter(a => a.alive);
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
      spawn.x, spawn.y,
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

      // Check collision with asteroids
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
            this.ui.addFloatingText(proj.x, proj.y - 30, `CRIT! ${formatNumber(damage)}`, '#ff0040', 36);
          } else {
            this.ui.addFloatingText(proj.x, proj.y - 20, formatNumber(damage), '#009dff', 28);
          }

          const killed = asteroid.takeDamage(damage);
          this.gs.statistics.totalDamage += damage;
          this.particles.emitTrail(proj.x, proj.y, isCrit ? '#ff0040' : '#009dff');
          audio.clickHit(this.combo.count);

          if (killed) {
            this._onAsteroidKilled(asteroid);
          }

          proj.alive = false;
          hit = true;
          break;
        }
      }

      // Check collision with boss
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

    this._projectiles = this._projectiles.filter(p => p.alive);
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

    const dt = Math.min((timestamp - this.lastFrame) / 1000, 0.05);
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
      // Ship follows mouse + auto-aim
      const enemies = this._getEnemies();
      if (this._ship) {
        this._ship.update(dt, this.canvas.width, this.canvas.height, enemies, this.shipSpeed);

        // Auto-fire when enemies present
        if (this._ship.canFire() && enemies.length > 0) {
          this._fireProjectile();
        }
      }

      // Update projectiles + collision
      this._updateProjectiles(dt);

      // Ship-asteroid collision
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

    const timerEl = document.getElementById('expedition-time');
    if (timerEl) {
      const time = Math.max(0, Math.ceil(ex.timeRemaining));
      timerEl.textContent = `${time}s`;
      if (ex.timeRemaining <= 5) {
        timerEl.style.color = '#c0392b';
      } else if (ex.timeRemaining <= 10) {
        timerEl.style.color = '#d4a843';
      } else {
        timerEl.style.color = '#50c878';
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
      const gained = this.gs.addRunResources('asteroid', amount);
      this.particles.emitResource(asteroid.x, asteroid.y, this.resourcesData?.resources.resources?.color || '#50c878');
      this.ui.addFloatingText(asteroid.x, asteroid.y + 20, `+${formatNumber(gained)} resources`, '#50c878', 20);

      if (this.gs.expeditionState.active) {
        this.gs.expeditionState.score += gained;
      }

      this.galaxy.addBossProgress((asteroid.maxHp / 15) * this.bossProgressMult);
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
        this.canvas.width / 2, 60,
        `-${phase.attackDamage}`, '#fe5f55', 32
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
    this.particles.emitTrail(x, y, isCrit ? '#ff0040' : '#f0c040');
    this.ui.addFloatingText(x, y - 20, formatNumber(damage), isCrit ? '#ff0040' : '#f0c040', isCrit ? 36 : 28);
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
    const bgColor = this.galaxy.getCurrent()?.bgColor || '#0a0a1a';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const time = performance.now() / 1000;
    for (const star of this.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
      ctx.globalAlpha = star.brightness * twinkle;
      ctx.fillStyle = '#ffffff';
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
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = '24px "Silkscreen", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(boss.name, bx, by + 5);
    ctx.restore();
  }

  _showBossBar() {
    const bar = document.getElementById('boss-bar');
    if (bar) bar.style.display = 'flex';
  }

  _hideBossBar() {
    const bar = document.getElementById('boss-bar');
    if (bar) bar.style.display = 'none';
  }

  _renderBossHP() {
    if (!this.boss) return;
    const fill = document.getElementById('boss-hp-fill');
    const text = document.getElementById('boss-hp-text');
    if (fill) fill.style.width = `${(this.boss.currentHp / this.boss.maxHp) * 100}%`;
    if (text) text.textContent = `${formatNumber(this.boss.currentHp)} / ${formatNumber(this.boss.maxHp)}`;
  }

  _updateBossProgress() {
    const prog = this.galaxy.getBossProgress();
    const fill = document.getElementById('boss-progress-fill');
    const text = document.getElementById('boss-progress-text');
    if (fill) fill.style.width = `${prog.percent}%`;
    if (text) text.textContent = prog.active ? 'BOSS!' : `${Math.floor(prog.percent)}%`;
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
      return { success: false, reason: 'already-there' };
    }

    if (this.gs.isExpeditionActive()) {
      return { success: false, reason: 'expedition-active' };
    }

    if (this.boss?.alive) {
      return { success: false, reason: 'boss-active' };
    }

    return {
      success: this.galaxy.travel(index),
      reason: 'ok'
    };
  }

  _showRunSummary() {
    const summary = this.gs.expeditionState;
    const panel = document.getElementById('run-summary');
    const content = document.getElementById('run-summary-content');
    const title = panel?.querySelector('.panel-title');
    if (!panel || !content) return;

    const successful = Boolean(summary.success && summary.bossDefeated);
    if (title) {
      title.textContent = successful ? 'ZONE CLEARED' : 'RUN FAILED';
    }

    const asteroidResources = Math.max(0, Math.floor(summary.resourcesFromAsteroids || 0));
    const enemyResources = Math.max(0, Math.floor(summary.resourcesFromEnemies || 0));
    const bossResources = Math.max(0, Math.floor(summary.resourcesFromBoss || 0));
    const totalResources = Math.max(0, Math.floor(summary.resourcesCollected || 0));
    const retainedResources = successful
      ? totalResources
      : Math.floor(totalResources * 0.25);

    content.innerHTML = `
      <div class="summary-row"><span>Zone</span><span class="summary-val">${summary.zoneName || `Zone ${summary.zoneIndex + 1}`}</span></div>
      <div class="summary-row"><span>Status</span><span class="summary-val ${successful ? 'green' : 'red'}">${successful ? 'Boss defeated' : 'Retained 25% on fail'}</span></div>
      <div class="summary-row"><span>Asteroids</span><span class="summary-val">${formatNumber(asteroidResources)}</span></div>
      <div class="summary-row"><span>Enemies</span><span class="summary-val">${formatNumber(enemyResources)}</span></div>
      <div class="summary-row"><span>Boss</span><span class="summary-val gold">${formatNumber(bossResources)}</span></div>
      <div class="summary-row"><span>Total Resources</span><span class="summary-val">${formatNumber(totalResources)}</span></div>
      <div class="summary-row"><span>Retained</span><span class="summary-val gold">+${formatNumber(retainedResources)} ${this.resourcesData?.resources.resources?.name || 'resources'}</span></div>
      <div class="summary-row"><span>Destroyed</span><span class="summary-val">${summary.asteroidsDestroyed}</span></div>
      <div class="summary-row"><span>Max Combo</span><span class="summary-val gold">x${summary.maxCombo}</span></div>
      <div class="summary-row"><span>XP</span><span class="summary-val blue">${formatNumber(Math.floor(summary.xpGained))}</span></div>
      <div class="summary-row"><span>Run Score</span><span class="summary-val gold">${formatNumber(Math.floor(summary.score))}</span></div>
    `;
    panel.classList.add('active');
  }

  _togglePause() {
    this.running = !this.running;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.toggle('active', !this.running);
  }
}
