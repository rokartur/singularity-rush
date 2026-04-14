import { describe, expect, it } from 'vitest';

import sectorsData from '../js/data/sectors.js';
import skillsData from '../js/data/skills.js';
import { GameState } from '../js/game/GameState.js';
import { MetaState } from '../js/game/MetaState.js';
import { calculateCombatStats } from '../js/game/StatCalculator.js';
import { SkillTree } from '../js/systems/SkillTree.js';

describe('Story meta progression', () => {
  it('retains all gathered resources on successful zone clears and unlocks the next zone', () => {
    const meta = new MetaState();

    const result = meta.completeRun({
      success: true,
      bossDefeated: true,
      zoneIndex: 0,
      resourcesCollected: 40
    }, sectorsData);

    expect(result).toEqual({
      successful: true,
      reward: 50,
      retained: 50,
      collected: 40,
      firstClearReward: 10,
      failRetentionRate: 0.4,
      zoneIndex: 0
    });
    expect(meta.resources).toBe(50);
    expect(meta.clearedZones).toEqual([0]);
    expect(meta.unlockedZones).toContain(1);
  });

  it('retains 40% of gathered resources and no new zone on failed runs', () => {
    const meta = new MetaState();

    const result = meta.completeRun({
      success: false,
      bossDefeated: false,
      zoneIndex: 0,
      resourcesCollected: 30
    }, sectorsData);

    expect(result).toEqual({
      successful: false,
      reward: 12,
      retained: 12,
      collected: 30,
      firstClearReward: 0,
      failRetentionRate: 0.4,
      zoneIndex: 0
    });
    expect(meta.resources).toBe(12);
    expect(meta.clearedZones).toEqual([]);
    expect(meta.unlockedZones).toEqual([0]);
  });

  it('boosts fail retention and first-clear rewards from economy nodes', () => {
    const meta = new MetaState();
    const skillTree = new SkillTree(meta);
    skillTree.loadData(skillsData);

    meta.addResources(300);
    skillTree.purchase('core_targeting');
    skillTree.purchase('combat_throttle');
    skillTree.purchase('vector_thrusters');
    skillTree.purchase('time_dilation');
    skillTree.purchase('fallback_cache');
    skillTree.purchase('salvage_routines');
    skillTree.purchase('ore_crushers');
    skillTree.purchase('precision_extractors');
    skillTree.purchase('survey_beacons');

    const failedRun = meta.completeRun({
      success: false,
      bossDefeated: false,
      zoneIndex: 0,
      resourcesCollected: 30
    }, sectorsData, skillTree);

    expect(failedRun.retained).toBe(15);
    expect(failedRun.failRetentionRate).toBeCloseTo(0.5, 5);

    const successfulRun = meta.completeRun({
      success: true,
      bossDefeated: true,
      zoneIndex: 1,
      resourcesCollected: 40
    }, sectorsData, skillTree);

    expect(successfulRun.firstClearReward).toBe(24);
    expect(successfulRun.retained).toBe(64);
  });

  it('purchases skill nodes with resources and persists unlocks', () => {
    const meta = new MetaState();
    const skillTree = new SkillTree(meta);
    skillTree.loadData(skillsData);

    meta.addResources(150);

    expect(skillTree.purchase('core_targeting')).toBe(true);
    expect(skillTree.purchase('combat_throttle')).toBe(true);
    expect(skillTree.purchase('pulse_cannon_license')).toBe(true);

    expect(meta.resources).toBe(150 - 6 - 8 - 14);
    expect(meta.purchasedSkillNodes).toEqual([
      'core_targeting',
      'combat_throttle',
      'pulse_cannon_license'
    ]);
    expect(meta.unlockedWeapons).toContain('pulse_cannon');

    const roundTrip = new MetaState();
    roundTrip.deserialize(meta.serialize());
    expect(roundTrip.purchasedSkillNodes).toEqual(meta.purchasedSkillNodes);
    expect(roundTrip.unlockedWeapons).toContain('pulse_cannon');
  });

  it('blocks purchases when prerequisites are missing', () => {
    const meta = new MetaState();
    const skillTree = new SkillTree(meta);
    skillTree.loadData(skillsData);
    meta.addResources(100);

    expect(skillTree.purchase('plasma_rifle_license')).toBe(false);
    expect(meta.resources).toBe(100);
    expect(meta.unlockedWeapons).not.toContain('plasma_rifle');
  });

  it('derives combat stats from purchased nodes and equipped utility modules', () => {
    const meta = new MetaState();
    const gs = new GameState();
    const skillTree = new SkillTree(meta);
    skillTree.loadData(skillsData);

    meta.addResources(300);
    skillTree.purchase('core_targeting');
    skillTree.purchase('hull_rivets');
    skillTree.purchase('shield_booster_license');
    meta.equipUtility(0, 'shield_booster');

    const stats = calculateCombatStats({ gs, skillTree, metaState: meta });

    expect(stats.clickDamage).toBeGreaterThan(15);
    expect(stats.maxHp).toBeGreaterThan(100);
    expect(stats.maxShield).toBeGreaterThan(0);
  });

  it('unlocks modules from the tree and allows equipping them', () => {
    const meta = new MetaState();
    const skillTree = new SkillTree(meta);
    skillTree.loadData(skillsData);

    meta.addResources(200);
    skillTree.purchase('core_targeting');
    skillTree.purchase('hull_rivets');
    skillTree.purchase('shield_booster_license');

    expect(meta.unlockedModules).toContain('shield_booster');
    expect(meta.equipUtility(0, 'shield_booster')).toBe(true);
    expect(meta.utilitySlots[0]).toBe('shield_booster');
  });
});
