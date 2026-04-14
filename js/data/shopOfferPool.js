export default [
  {
    id: 'hp_boost',
    name: 'Hull Plating',
    description: '+{value}% Max Hull',
    category: 'stat',
    tier: 'common',
    effect: { type: 'max_hp', value: 0.08 },
    priceRange: { min: 20, max: 60, resource: 'iron' }
  },
  {
    id: 'damage_boost',
    name: 'Power Cell',
    description: '+{value}% Damage',
    category: 'stat',
    tier: 'common',
    effect: { type: 'click_damage_mult', value: 0.06 },
    priceRange: { min: 25, max: 70, resource: 'iron' }
  },
  {
    id: 'crit_boost',
    name: 'Targeting Module',
    description: '+{value}% Critical Chance',
    category: 'stat',
    tier: 'uncommon',
    effect: { type: 'crit_chance', value: 0.025 },
    priceRange: { min: 30, max: 80, resource: 'nickel' }
  },
  {
    id: 'crit_mult_boost',
    name: 'Amplifier Core',
    description: '+{value}% Critical Damage',
    category: 'stat',
    tier: 'uncommon',
    effect: { type: 'crit_mult', value: 0.15 },
    priceRange: { min: 40, max: 100, resource: 'nickel' }
  },
  {
    id: 'resource_boost',
    name: 'Cargo Scanner',
    description: '+{value}% Resource Yield',
    category: 'stat',
    tier: 'common',
    effect: { type: 'resource_mult', value: 0.08 },
    priceRange: { min: 30, max: 80, resource: 'iron' }
  },
  {
    id: 'shield_boost',
    name: 'Barrier Coil',
    description: '+{value}% Shield Capacity',
    category: 'stat',
    tier: 'uncommon',
    effect: { type: 'shield', value: 0.04 },
    priceRange: { min: 40, max: 90, resource: 'helium3' }
  },
  {
    id: 'regen_boost',
    name: 'Repair Nanites',
    description: '+{value}% Hull Regen/s',
    category: 'stat',
    tier: 'rare',
    effect: { type: 'passive_regen', value: 0.006 },
    priceRange: { min: 50, max: 120, resource: 'star_crystal' }
  },
  {
    id: 'time_boost',
    name: 'Time Dilation',
    description: '+{value}s Run Duration',
    category: 'utility',
    tier: 'uncommon',
    effect: { type: 'expedition_time', value: 2 },
    priceRange: { min: 40, max: 100, resource: 'star_crystal' }
  },
  {
    id: 'boss_progress_boost',
    name: 'Boss Tracker',
    description: '+{value}% Boss Progress',
    category: 'utility',
    tier: 'rare',
    effect: { type: 'boss_progress', value: 0.12 },
    priceRange: { min: 60, max: 140, resource: 'helium3' }
  },
  {
    id: 'iron_pack_s',
    name: 'Iron Cache',
    description: '+50 Iron',
    category: 'resource',
    tier: 'common',
    effect: { type: 'grant_resource', resource: 'iron', value: 50 },
    priceRange: { min: 15, max: 30, resource: 'nickel' }
  },
  {
    id: 'nickel_pack_s',
    name: 'Nickel Cache',
    description: '+25 Nickel',
    category: 'resource',
    tier: 'common',
    effect: { type: 'grant_resource', resource: 'nickel', value: 25 },
    priceRange: { min: 20, max: 45, resource: 'iron' }
  },
  {
    id: 'helium3_pack',
    name: 'Helium-3 Canister',
    description: '+15 Helium-3',
    category: 'resource',
    tier: 'uncommon',
    effect: { type: 'grant_resource', resource: 'helium3', value: 15 },
    priceRange: { min: 30, max: 70, resource: 'star_crystal' }
  },
  {
    id: 'crystal_shard',
    name: 'Crystal Shard',
    description: '+5 Star Crystals',
    category: 'resource',
    tier: 'rare',
    effect: { type: 'grant_resource', resource: 'star_crystal', value: 5 },
    priceRange: { min: 40, max: 90, resource: 'antimatter' }
  },
  {
    id: 'reroll_token',
    name: 'Shop Refresh Token',
    description: 'Grants 1 free shop reroll',
    category: 'utility',
    tier: 'common',
    effect: { type: 'grant_reroll', value: 1 },
    priceRange: { min: 10, max: 25, resource: 'nickel' }
  },
  {
    id: 'click_flat_boost',
    name: 'Impact Driver',
    description: '+{value} Base Damage',
    category: 'stat',
    tier: 'rare',
    effect: { type: 'click_damage_flat', value: 3 },
    priceRange: { min: 50, max: 120, resource: 'helium3' }
  }
];
