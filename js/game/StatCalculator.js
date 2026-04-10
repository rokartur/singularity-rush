export function calculateCombatStats({ gs, skillTree }) {
  const baseClick = 15 + (skillTree?.getTotalEffect?.('click_damage_flat') || 0);
  const clickDamageMult = 1 + (skillTree?.getTotalEffect?.('click_damage_mult') || 0);
  const critChance = 0.05 + (skillTree?.getTotalEffect?.('crit_chance') || 0);
  const critMult = 3 + (skillTree?.getTotalEffect?.('crit_mult') || 0);
  const resourceMult = 1 + (skillTree?.getTotalEffect?.('resource_mult') || 0);
  const maxHp = (100 + Math.max(0, gs.level - 1) * 10) * (1 + (skillTree?.getTotalEffect?.('max_hp') || 0));
  const maxShield = maxHp * (skillTree?.getTotalEffect?.('shield') || 0);
  const passiveRegenPerSecond = maxHp * (skillTree?.getTotalEffect?.('passive_regen') || 0);
  const bossProgressMult = 1 + (skillTree?.getTotalEffect?.('boss_progress') || 0);
  const expeditionTimeBonus = skillTree?.getTotalEffect?.('expedition_time') || 0;

  return {
    clickDamage: baseClick * clickDamageMult,
    critChance: Math.min(critChance, 0.8),
    critMult,
    resourceMult,
    damageMult: clickDamageMult,
    maxHp,
    maxShield,
    passiveRegenPerSecond,
    xpMult: 1,
    bossProgressMult,
    bonusResourceChance: 0,
    rareDropMult: 1,
    expeditionTimeBonus
  };
}
