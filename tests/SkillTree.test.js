import { describe, expect, it } from 'vitest';

import skills from '../js/data/skills.js';
import { MetaState } from '../js/game/MetaState.js';
import { SkillTree } from '../js/systems/SkillTree.js';

describe('SkillTree', () => {
  it('uses meta currency and prerequisite chains', () => {
    const meta = new MetaState();
    const tree = new SkillTree(meta);
    tree.loadData(skills);

    expect(tree.canPurchase('plasma_rifle_license')).toBe(false);

    meta.addResources(100);
    expect(tree.canPurchase('core_targeting')).toBe(true);
    expect(tree.purchase('core_targeting')).toBe(true);
    expect(meta.resources).toBe(94);
    expect(tree.canPurchase('plasma_rifle_license')).toBe(false);
  });

  it('charges fixed node costs and sums purchased stat effects', () => {
    const meta = new MetaState();
    const tree = new SkillTree(meta);
    tree.loadData(skills);

    meta.addResources(100);
    expect(tree.purchase('core_targeting')).toBe(true);
    expect(tree.getNodeCost('core_targeting')).toBe(6);
    expect(tree.purchase('core_targeting')).toBe(false);
    expect(tree.getTotalEffect('click_damage_flat')).toBe(8);
  });
});
