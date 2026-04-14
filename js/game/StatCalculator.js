import weaponsData from '../data/weapons.js';

function getEquippedUtilityBonuses(metaState) {
  return (metaState?.utilitySlots || []).reduce((totals, moduleId) => {
    if (!moduleId) return totals;

    const module = weaponsData.find((item) => item.id === moduleId && item.slot === 'utility');
    if (!module?.stats) return totals;

    totals.shield += module.stats.shieldBonus || 0;
    totals.passiveRegen += module.stats.regenBonus || 0;
    totals.resourceMult += module.stats.resourceMultBonus || 0;
    return totals;
  }, {
    shield: 0,
    passiveRegen: 0,
    resourceMult: 0
  });
}

export function calculateCombatStats({ gs, skillTree, metaState }) {
  const utilityBonuses = getEquippedUtilityBonuses(metaState);

  const baseClick = 15 + (skillTree?.getTotalEffect?.('click_damage_flat') || 0);
  const clickDamageMult = 1 + (skillTree?.getTotalEffect?.('click_damage_mult') || 0);
  const critChance = 0.05 + (skillTree?.getTotalEffect?.('crit_chance') || 0);
  const critMult = 3 + (skillTree?.getTotalEffect?.('crit_mult') || 0);
  const resourceMult = 1
    + (skillTree?.getTotalEffect?.('resource_mult') || 0)
    + utilityBonuses.resourceMult;
  const maxHpBase = (100 + Math.max(0, gs.level - 1) * 10)
    * (1 + (skillTree?.getTotalEffect?.('max_hp') || 0));
  const maxShield = maxHpBase
    * ((skillTree?.getTotalEffect?.('shield') || 0) + utilityBonuses.shield);
  const passiveRegenPerSecond = maxHpBase
    * ((skillTree?.getTotalEffect?.('passive_regen') || 0) + utilityBonuses.passiveRegen);
  const bossProgressMult = 1 + (skillTree?.getTotalEffect?.('boss_progress') || 0);
  const expeditionTimeBonus = skillTree?.getTotalEffect?.('expedition_time') || 0;
  const fireRate = 3.0 + (skillTree?.getTotalEffect?.('fire_rate') || 0);
  const shipSpeed = 220 + (skillTree?.getTotalEffect?.('ship_speed') || 0);

  return {
    clickDamage: baseClick * clickDamageMult,
    critChance: Math.min(critChance, 0.8),
    critMult,
    resourceMult,
    damageMult: clickDamageMult,
    maxHp: maxHpBase,
    maxShield,
    passiveRegenPerSecond,
    xpMult: 1,
    bossProgressMult,
    bonusResourceChance: 0,
    rareDropMult: 1,
    expeditionTimeBonus,
    fireRate,
    shipSpeed
  };
}
