import { beforeEach, describe, expect, it } from 'vitest';

import { GameState } from '../js/game/GameState.js';
import { SaveManager } from '../js/utils/SaveManager.js';

function createStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

describe('SaveManager', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
      writable: true
    });
  });

  it('round-trips exported saves into a fresh game state', () => {
    const source = new GameState();
    source.currentGalaxyIndex = 2;
    source.level = 7;
    source.xp = 11;
    source.resources.antimatter = 5;
    source.hp = 88;
    source.maxHp = 140;
    source.shield = 35;
    source.skillLevels.iron_lattice = 2;
    source.unlockedGalaxies = [0, 1, 2];
    source.completedGalaxies = [0, 1];
    source.bossesKilledInGalaxy = { 1: 2 };
    source.bossProgressCollected = 55;
    source.bossProgressNeeded = 100;
    source.bossProgressActive = true;
    source.bossState = { name: 'Iron Tyrant', currentHp: 80, maxHp: 120, alive: true, phases: [] };
    source.autoMineTimer = 24;
    source.statistics.totalClicks = 321;
    source.statistics.playtime = 123;
    source.combo.bestCombo = 42;

    const save = new SaveManager(source).exportSave();

    const target = new GameState();
    const manager = new SaveManager(target);
    expect(manager.importSave(save)).toEqual({ success: true });

    expect(target.currentGalaxyIndex).toBe(2);
    expect(target.level).toBe(7);
    expect(target.resources.antimatter).toBe(5);
    expect(target.skillLevels).toEqual({ iron_lattice: 2 });
    expect(target.unlockedGalaxies).toEqual([0, 1, 2]);
    expect(target.completedGalaxies).toEqual([0, 1]);
    expect(target.bossesKilledInGalaxy).toEqual({ 1: 2 });
    expect(target.bossProgressCollected).toBe(55);
    expect(target.bossProgressActive).toBe(true);
    expect(target.bossState).toEqual({ name: 'Iron Tyrant', currentHp: 80, maxHp: 120, alive: true, phases: [] });
    expect(target.autoMineTimer).toBe(0);
    expect(target.statistics.totalClicks).toBe(321);
    expect(target.combo.bestCombo).toBe(42);
  });

  it('stores and loads autosaves from localStorage', () => {
    const gs = new GameState();
    gs.level = 3;
    const save = new SaveManager(gs);

    save.autoSave();

    const target = new GameState();
    const manager = new SaveManager(target);
    expect(manager.hasAutoSave()).toBe(true);
    expect(manager.loadAutoSave()).toBe(true);
    expect(target.level).toBe(3);
  });

  it('persists imported saves into the autosave slot', () => {
    const source = new GameState();
    source.level = 5;
    source.skillLevels.nickel_focus = 1;
    const exported = new SaveManager(source).exportSave();

    const target = new GameState();
    const manager = new SaveManager(target);

    expect(manager.importSave(exported)).toEqual({ success: true });
    expect(manager.hasAutoSave()).toBe(true);

    const reloaded = new GameState();
    const reloadManager = new SaveManager(reloaded);
    expect(reloadManager.loadAutoSave()).toBe(true);
    expect(reloaded.level).toBe(5);
    expect(reloaded.skillLevels).toEqual({ nickel_focus: 1 });
  });

  it('derives unlocked galaxies from old saves that do not store them explicitly', () => {
    const target = new GameState();
    const manager = new SaveManager(target);

    manager.loadFromData({
      version: '1.0.0',
      galaxy: 1,
      completedGalaxies: [0],
      resources: { iron: 0, nickel: 0 }
    });

    expect(target.unlockedGalaxies).toEqual([0, 1]);
  });

  it('migrates old skill ids into unified resource nodes', () => {
    const target = new GameState();
    const manager = new SaveManager(target);

    manager.loadFromData({
      version: '2.0.0',
      galaxy: 0,
      skillLevels: { l_power_1: 2, ex_boss_rush: 1 },
      resources: { iron: 0, nickel: 0 }
    });

    expect(target.skillLevels).toEqual({ iron_lattice: 2, degenerate_radar: 1 });
  });

  it('derives legacy max hp from level when saves do not include it', () => {
    const target = new GameState();
    const manager = new SaveManager(target);

    manager.loadFromData({
      version: '1.0.0',
      level: 4,
      hp: 120,
      resources: { iron: 0, nickel: 0 }
    });

    expect(target.maxHp).toBe(130);
    expect(target.hp).toBe(120);
  });
});
