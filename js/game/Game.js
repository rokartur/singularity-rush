import { GameState } from './GameState.js';
import { Asteroid, AsteroidManager } from './Asteroid.js';
import { ComboSystem } from './Combo.js';
import { Galaxy } from './Galaxy.js';
import { calculateCombatStats } from './StatCalculator.js';
import { ParticleSystem } from '../rendering/Particles.js';
import { ScreenEffects } from '../rendering/Effects.js';
import { UIManager } from '../rendering/UI.js';
import { SaveManager } from '../utils/SaveManager.js';
import { SkillTree } from '../systems/SkillTree.js';
import { audio } from '../utils/Audio.js';
import { formatNumber, randomRange } from '../utils/Math.js';
import galaxiesData from '../data/galaxies.js';
import skillsData from '../data/skills.js';
import resourcesData from '../data/resources.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

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
    window.addEventListener('resize', () => this._resizeCanvas());

    audio.init();

    this.galaxy.loadData(galaxiesData);
    this.skillTree.loadData(skillsData);
    this.resourcesData = resourcesData;

    if (this.save.hasAutoSave()) {
      this.save.loadAutoSave();
    }

    this.galaxy.loadData(galaxiesData);
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

    this.gs.emit('gameReady', {});
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
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this._pendingClicks.push({ x, y });
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
      this._updateMenuVisibility();
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
      this._updateMenuVisibility();
    });

    this.gs.on('galaxyTraveled', ({ index }) => {
      audio.newGalaxy();
      this.effects.shake(5, 0.3);
      this._clearBossEncounter();
      this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
      this._generateStars();
      this._recalcStats();
      this._updateMenuVisibility();
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
      const label = Object.entries(reward.resources || {})
        .map(([key, value]) => `+${formatNumber(value)} ${this.resourcesData?.resources[key]?.name || key}`)
        .join('  ');
      if (label) {
        this.ui.addFloatingText(this.canvas.width / 2, 90, label, '#ffd700', 20);
      }
    });

    this.gs.on('skillUpgraded', () => {
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
    });

    this.gs.on('expeditionStart', () => {
      this.asteroidMgr.setGalaxy(this.galaxy.getCurrent());
      this._updateMenuVisibility();
      this._updateStartButton();
      const timer = document.getElementById('expedition-timer');
      if (timer) timer.style.display = 'block';
    });

    this.gs.on('expeditionEnd', () => {
      this.asteroidMgr.asteroids = [];
      this._updateMenuVisibility();
      this._updateStartButton();
      const timer = document.getElementById('expedition-timer');
      if (timer) timer.style.display = 'none';
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

    const dt = Math.min((timestamp - this.lastFrame) / 1000, 0.05);
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

    const timerEl = document.getElementById('expedition-time');
    if (timerEl) {
      const time = Math.max(0, Math.ceil(ex.timeRemaining));
      timerEl.textContent = `${time}s`;
      if (ex.timeRemaining <= 5) {
        timerEl.style.color = '#ff4444';
      } else if (ex.timeRemaining <= 10) {
        timerEl.style.color = '#f0c040';
      } else {
        timerEl.style.color = '#00ff88';
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
        this.ui.addFloatingText(x, y - 30, `CRIT! ${formatNumber(damage)}`, '#ff0040', 36);
      } else {
        this.ui.addFloatingText(x, y - 20, formatNumber(damage), '#009dff', 28);
      }

      const killed = asteroid.takeDamage(damage);
      this.gs.statistics.totalDamage += damage;
      this.particles.emitTrail(x, y, isCrit ? '#ff0040' : '#009dff');

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
      const amount = (asteroid.maxHp / 15) * this.resourceMult;
      this.gs.addResource(mainRes, amount);
      this.particles.emitResource(asteroid.x, asteroid.y, this.resourcesData?.resources[mainRes]?.color || '#fff');
      this.ui.addFloatingText(asteroid.x, asteroid.y + 20, `+${formatNumber(amount)} ${mainRes}`, '#50c878', 20);

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
    this.particles.emitTrail(x, y, isCrit ? '#ff0040' : '#f0c040');
    this.ui.addFloatingText(x, y - 20, formatNumber(damage), isCrit ? '#ff0040' : '#f0c040', isCrit ? 36 : 28);
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
    this.gs.startExpedition();
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
      success: this.galaxy.unlock(index),
      reason: 'ok'
    };
  }

  _updateMenuVisibility() {
    const inExpedition = this.gs.isExpeditionActive();
    const btns = ['btn-skills', 'btn-map', 'btn-stats', 'btn-settings'];
    for (const id of btns) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.style.opacity = inExpedition ? '0.3' : '1';
        btn.style.pointerEvents = inExpedition ? 'none' : 'auto';
      }
    }
    const btnGame = document.getElementById('btn-game');
    if (btnGame) {
      btnGame.style.display = inExpedition ? 'block' : 'none';
    }
    if (inExpedition && window.gameUI) {
      window.gameUI.switchTab('game');
    } else if (!inExpedition && window.gameUI) {
      const gameTab = document.getElementById('tab-game');
      if (gameTab && gameTab.classList.contains('active')) {
        window.gameUI.showSkills();
      }
    }
  }

  _updateStartButton() {
    const btn = document.getElementById('btn-start-expedition');
    if (btn) {
      btn.style.display = this.gs.isExpeditionActive() ? 'none' : 'block';
    }
  }

  _showRunSummary() {
    const summary = this.gs.expeditionState;
    const panel = document.getElementById('run-summary');
    const content = document.getElementById('run-summary-content');
    if (!panel || !content) return;

    const resEntries = Object.entries(summary.resourcesGathered || {});
    const resHTML = resEntries.length > 0
      ? resEntries.map(([key, val], i) => {
          const resInfo = this.resourcesData?.resources[key];
          return `<div class="summary-res summary-row" style="animation-delay: ${0.5 + i * 0.1}s"><span style="color:${resInfo?.color || '#aaa'}">${resInfo?.name || key}</span><span class="summary-val">${formatNumber(val)}</span></div>`;
        }).join('')
      : '<div style="color:var(--text-dim)" class="summary-row" style="animation-delay: 0.5s">No resources</div>';

    content.innerHTML = `
      <div class="summary-row" style="animation-delay: 0.1s"><span>Destroyed</span><span class="summary-val">${summary.asteroidsDestroyed}</span></div>
      <div class="summary-row" style="animation-delay: 0.2s"><span>Max Combo</span><span class="summary-val gold">x${summary.maxCombo}</span></div>
      <div class="summary-row" style="animation-delay: 0.3s"><span>XP</span><span class="summary-val blue">${formatNumber(Math.floor(summary.xpGained))}</span></div>
      <div class="summary-row" style="animation-delay: 0.4s"><span>Run Score</span><span class="summary-val gold">${formatNumber(Math.floor(summary.score))}</span></div>
      <div class="summary-title" style="margin-top:16px;">Resources</div>
      ${resHTML}
    `;
    panel.style.display = 'flex';
  }

  _updateEquipmentDisplay() {
    const equipment = document.getElementById('ui-equipment');
    if (equipment) {
      const currentGalaxy = this.galaxy.getCurrent();
      equipment.textContent = `${currentGalaxy?.name || 'Unknown Sector'} // RUN ${this.gs.baseExpeditionTime + this.gs.expeditionTimeBonus}s`;
    }

    const clickDmg = document.getElementById('ui-click-dmg');
    if (clickDmg) clickDmg.textContent = formatNumber(Math.floor(this.clickDamage));
  }

  _togglePause() {
    this.running = !this.running;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = this.running ? 'none' : 'flex';
  }
}
