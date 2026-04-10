import { describe, expect, it } from 'vitest';

import { GameState } from '../js/game/GameState.js';
import skills from '../js/data/skills.js';
import { SkillTree } from '../js/systems/SkillTree.js';

describe('SkillTree', () => {
  it('uses resource currencies and prerequisite chains', () => {
    const gs = new GameState();
    const tree = new SkillTree(gs);
    tree.loadData(skills);

    expect(tree.canUnlock('helium_scope')).toBe(false);

    gs.addResource('iron', 30);
    expect(tree.canUnlock('iron_lattice')).toBe(true);
    expect(tree.unlock('iron_lattice')).toBe(true);
    expect(gs.resources.iron).toBe(6);
    expect(tree.canUnlock('crystal_clock')).toBe(false);
  });

  it('charges scaled resource costs and sums flat node effects', () => {
    const gs = new GameState();
    const tree = new SkillTree(gs);
    tree.loadData(skills);

    gs.addResource('iron', 100);
    expect(tree.unlock('iron_lattice')).toBe(true);
    expect(tree.getNodeCost('iron_lattice')).toBe(Math.floor(24 * 1.55));
    expect(tree.unlock('iron_lattice')).toBe(true);
    expect(tree.getTotalEffect('click_damage_flat')).toBe(8);
  });
});
