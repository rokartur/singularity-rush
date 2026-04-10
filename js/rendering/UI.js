import { formatNumber } from '../utils/Math.js';

export class FloatingText {
  constructor(x, y, text, color, size, duration) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size || 16;
    this.duration = duration || 1.0;
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
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

export class NumberRoller {
  constructor(element) {
    this.el = element;
    this.current = 0;
    this.target = 0;
    this.speed = 0;
    this.rolling = false;
  }

  setTarget(val) {
    this.target = val;
    if (!this.rolling) {
      this.rolling = true;
      this._tick();
    }
  }

  _tick() {
    const diff = this.target - this.current;
    if (Math.abs(diff) < 1) {
      this.current = this.target;
      this.rolling = false;
      this._render();
      return;
    }
    this.current += diff * 0.15;
    this._render();
    requestAnimationFrame(() => this._tick());
  }

  _render() {
    if (this.el) {
      this.el.textContent = formatNumber(Math.floor(this.current));
    }
  }

  setImmediate(val) {
    this.current = val;
    this.target = val;
    this.rolling = false;
    this._render();
  }
}

export class UIManager {
  constructor(gameState) {
    this.gs = gameState;
    this.floatingTexts = [];
    this.numberRollers = new Map();
    this.prevResources = new Map();
    this._cacheElements();
  }

  _cacheElements() {
    this.els = {
      resources: document.getElementById('ui-resources'),
      level: document.getElementById('ui-level'),
      xpBar: document.getElementById('ui-xp-fill'),
      galaxy: document.getElementById('ui-galaxy'),
      galaxyName: document.getElementById('ui-galaxy-name'),
      hpBar: document.getElementById('ui-hp-fill'),
      hpText: document.getElementById('ui-hp-text'),
      shieldBar: document.getElementById('ui-shield-fill'),
      comboCount: document.getElementById('ui-combo-count'),
      comboMult: document.getElementById('ui-combo-mult'),
      comboBar: document.getElementById('ui-combo-bar'),
    };
  }

  initRollers() {
    return;
  }

  addFloatingText(x, y, text, color, size) {
    this.floatingTexts.push(new FloatingText(x, y, text, color, size));
  }

  update(dt) {
    this.floatingTexts = this.floatingTexts.filter(ft => ft.update(dt));
  }

  renderFloatingTexts(ctx) {
    for (const ft of this.floatingTexts) {
      ft.render(ctx);
    }
  }

  updateHUD() {
    const gs = this.gs;

    if (this.els.level) this.els.level.textContent = gs.level;
    if (this.els.xpBar) this.els.xpBar.style.width = (gs.xpProgress() * 100) + '%';
    if (this.els.galaxy) this.els.galaxy.textContent = `${gs.currentGalaxyIndex + 1}`;
    if (this.els.galaxyName) this.els.galaxyName.textContent = `SEKTOR ${gs.currentGalaxyIndex + 1}`;
    if (this.els.hpBar) {
      const hpPct = gs.hp / gs.maxHp;
      this.els.hpBar.style.width = (hpPct * 100) + '%';
      
      const hpContainer = document.getElementById('hp-bar-container');
      if (hpContainer) {
        if (hpPct < 0.3) {
          hpContainer.classList.add('hp-critical');
        } else {
          hpContainer.classList.remove('hp-critical');
        }
      }
    }
    if (this.els.shieldBar) {
      const shieldPct = gs.maxShield > 0 ? (gs.shield / gs.maxShield * 100) : 0;
      this.els.shieldBar.style.width = Math.min(shieldPct, 100) + '%';
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
    const currentKeys = Object.keys(gs.resources).filter(k => gs.resources[k] > 0);
    const existingKeys = Array.from(this.els.resources.querySelectorAll('.resource-item')).map(el => el.dataset.key);
    
    if (currentKeys.length !== existingKeys.length || !currentKeys.every(k => existingKeys.includes(k))) {
      needsRebuild = true;
    }

    if (needsRebuild) {
      let html = '';
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
            valEl.classList.remove('res-flash');
            void valEl.offsetWidth;
            valEl.classList.add('res-flash');
            
            if (valEl.flashTimeout) clearTimeout(valEl.flashTimeout);
            valEl.flashTimeout = setTimeout(() => {
              if (valEl) valEl.classList.remove('res-flash');
            }, 600);
          }
        }
        this.prevResources.set(key, val);
      }
    }
  }

  updateCombo(combo) {
    if (this.els.comboCount) {
      const newText = combo.count > 0 ? `x${combo.count}` : '';
      if (this.els.comboCount.textContent !== newText) {
        this.els.comboCount.textContent = newText;
        if (combo.count > 0) {
          this.els.comboCount.classList.remove('number-pop');
          void this.els.comboCount.offsetWidth;
          this.els.comboCount.classList.add('number-pop');
        }
      }
    }
    if (this.els.comboMult) {
      this.els.comboMult.textContent = combo.multiplier > 1 ? `${combo.multiplier.toFixed(1)}x` : '';
    }
    if (this.els.comboBar) {
      const pct = Math.min(combo.count / 50, 1) * 100;
      this.els.comboBar.style.width = pct + '%';
    }
  }
}
