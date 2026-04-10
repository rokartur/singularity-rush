import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Game } from '../js/game/Game.js';

function mountGameDom() {
  document.body.innerHTML = `
    <div id="canvas-container"><canvas id="game-canvas"></canvas></div>
    <div id="boss-bar"></div>
    <div id="boss-hp-fill"></div>
    <div id="boss-hp-text"></div>
    <div id="ui-equipment"></div>
    <div id="boss-progress-fill"></div>
    <div id="boss-progress-text"></div>
    <div id="pause-overlay"></div>
    <button id="btn-skills"></button>
    <button id="btn-map"></button>
    <button id="btn-start-expedition"></button>
    <div id="run-summary"></div>
    <div id="run-summary-content"></div>
    <div id="expedition-timer"></div>
    <span id="expedition-time"></span>
    <div id="ui-click-dmg"></div>
  `;

  const canvas = document.getElementById('game-canvas');
  canvas.getContext = vi.fn(() => ({
    clearRect() {},
    save() {},
    restore() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    translate() {},
    rotate() {},
    scale() {},
    fillText() {}
  }));
}

describe('Game boss runtime', () => {
  beforeEach(() => {
    mountGameDom();
  });

  it('applies enraged attack cadence after the enrage timer expires', () => {
    const game = new Game();
    game.ui.addFloatingText = vi.fn();
    game.effects.shake = vi.fn();
    game.gs.maxHp = 100;
    game.gs.hp = 100;
    game.boss = {
      maxHp: 100,
      currentHp: 100,
      phaseIndex: 0,
      attackTimer: 0.1,
      alive: true,
      phases: [
        {
          hpPercent: 100,
          attackInterval: 4,
          attackDamage: 5,
          enrageTimer: 0.5,
          remainingEnrage: 0.5,
          remainingTime: null
        }
      ]
    };

    game._updateBoss(0.6);

    expect(game.gs.hp).toBe(95);
    expect(game.boss.attackTimer).toBe(2);
  });

  it('fails the player when a timed boss phase expires', () => {
    const game = new Game();
    game.ui.addFloatingText = vi.fn();
    game.effects.shake = vi.fn();
    game.gs.maxHp = 100;
    game.gs.hp = 100;
    game.boss = {
      maxHp: 100,
      currentHp: 100,
      phaseIndex: 0,
      attackTimer: 10,
      alive: true,
      phases: [
        {
          hpPercent: 100,
          attackInterval: 4,
          attackDamage: 5,
          timer: 1,
          remainingTime: 1,
          remainingEnrage: null
        }
      ]
    };

    game._updateBoss(1.1);

    expect(game.gs.hp).toBe(0);
    expect(game.boss.phases[0].remainingTime).toBe(1);
  });

  it('blocks galaxy travel while a boss encounter is active', () => {
    const game = new Game();
    game.galaxy.loadData([
      { name: 'Sol', unlockCost: {}, resources: ['iron'], boss: { reward: { resources: { iron: 10 }, xp: 5 } } },
      { name: 'Cygnus', unlockCost: { iron: 1 }, resources: ['nickel'], boss: { reward: { resources: { nickel: 2 }, xp: 10 } } }
    ]);
    game.gs.resources.iron = 10;
    game.boss = {
      maxHp: 100,
      currentHp: 100,
      phaseIndex: 0,
      attackTimer: 1,
      alive: true,
      phases: [{ hpPercent: 100, attackInterval: 4, attackDamage: 5 }]
    };

    const result = game.travelToGalaxy(1);

    expect(result).toEqual({ success: false, reason: 'boss-active' });
    expect(game.gs.currentGalaxyIndex).toBe(0);
    expect(game.gs.resources.iron).toBe(10);
  });
});
