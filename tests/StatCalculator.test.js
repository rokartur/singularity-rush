import { describe, expect, it } from 'vitest';

import { calculateCombatStats } from '../js/game/StatCalculator.js';
import { GameState } from '../js/game/GameState.js';

function createSkillTree(effects = {}) {
  return {
    getTotalEffect(type) {
      return effects[type] || 0;
    }
  };
}

describe('calculateCombatStats', () => {
  it('returns baseline combat stats from the unified resource tree', () => {
    const gs = new GameState();
    const stats = calculateCombatStats({
      gs,
      skillTree: createSkillTree()
    });

    expect(stats.clickDamage).toBe(15);
    expect(stats.critChance).toBe(0.05);
    expect(stats.resourceMult).toBe(1);
    expect(stats.maxHp).toBe(100);
    expect(stats.maxShield).toBe(0);
    expect(stats.passiveRegenPerSecond).toBe(0);
    expect(stats.xpMult).toBe(1);
    expect(stats.bossProgressMult).toBe(1);
    expect(stats.autoDPS).toBeUndefined();
  });

  it('combines unified node effects into final combat output', () => {
    const gs = new GameState();
    gs.level = 4;

    const stats = calculateCombatStats({
      gs,
      skillTree: createSkillTree({
        click_damage_flat: 8,
        click_damage_mult: 0.4,
        crit_chance: 0.12,
        crit_mult: 1,
        resource_mult: 0.3,
        boss_progress: 0.25,
        max_hp: 0.25,
        shield: 0.1,
        passive_regen: 0.02
      })
    });

    expect(stats.clickDamage).toBeCloseTo(32.2, 5);
    expect(stats.critChance).toBeCloseTo(0.17, 5);
    expect(stats.critMult).toBe(4);
    expect(stats.resourceMult).toBeCloseTo(1.3, 5);
    expect(stats.maxHp).toBeCloseTo(162.5, 5);
    expect(stats.maxShield).toBeCloseTo(16.25, 5);
    expect(stats.passiveRegenPerSecond).toBeCloseTo(3.25, 5);
    expect(stats.bossProgressMult).toBeCloseTo(1.25, 5);
  });

  it('keeps level 1 health aligned with the base game state health', () => {
    const gs = new GameState();

    const stats = calculateCombatStats({
      gs,
      skillTree: createSkillTree()
    });

    expect(stats.maxHp).toBe(gs.maxHp);
  });

  it('includes expeditionTimeBonus from skills', () => {
    const gs = new GameState();
    const stats = calculateCombatStats({
      gs,
      skillTree: createSkillTree({ expedition_time: 6 })
    });

    expect(stats.expeditionTimeBonus).toBe(6);
  });
});
