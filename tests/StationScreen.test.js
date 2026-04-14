import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import sectorsData from '../js/data/sectors.js';
import skillsData from '../js/data/skills.js';
import { GameState } from '../js/game/GameState.js';
import { MetaState } from '../js/game/MetaState.js';
import { SkillTree } from '../js/systems/SkillTree.js';
import { StationScreen } from '../js/ui/StationScreen.js';

function createGameStub(metaState) {
  const skillTree = new SkillTree(metaState);
  skillTree.loadData(skillsData);

  return {
    gs: new GameState(),
    skillTree,
    galaxy: {
      getAllGalaxies() {
        return sectorsData.map((sector, index) => ({
          ...sector,
          unlocked: metaState.isSectorUnlocked(index),
          completed: metaState.isSectorCompleted(index)
        }));
      }
    },
    save: {
      autoSave: vi.fn()
    },
    travelToGalaxy: vi.fn(),
    _recalcStats: vi.fn(),
    _showStation: vi.fn(),
    clickDamage: 15,
    critChance: 0.05,
    critMult: 3,
    resourceMult: 1,
    expeditionTimeBonus: 0,
    bossProgressMult: 1
  };
}

describe('StationScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="station-wrapper"></div><div id="run-summary"></div>';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('auto-equips new utility unlocks and saves immediately after purchase', () => {
    const meta = new MetaState();
    const game = createGameStub(meta);
    const station = new StationScreen(game, meta, sectorsData);
    station.currentView = 'skills';
    station.init();

    meta.addResources(100);

    station.purchaseSkillNode('core_targeting');
    station.purchaseSkillNode('hull_rivets');
    station.purchaseSkillNode('shield_booster_license');

    expect(meta.unlockedModules).toContain('shield_booster');
    expect(meta.utilitySlots[0]).toBe('shield_booster');
    expect(game.save.autoSave).toHaveBeenCalledTimes(3);
    expect(station.stationStatus?.message).toContain('auto-equipped');
  });

  it('shows a warning instead of silently failing blocked purchases', () => {
    const meta = new MetaState();
    const game = createGameStub(meta);
    const station = new StationScreen(game, meta, sectorsData);
    station.currentView = 'skills';
    station.init();

    station.purchaseSkillNode('plasma_rifle_license');

    expect(game.save.autoSave).not.toHaveBeenCalled();
    expect(station.stationStatus).toMatchObject({ tone: 'warning' });
    expect(station.stationStatus?.message).toContain('Requires');
  });
});
