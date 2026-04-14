export default [
  {
    id: 'basic_laser',
    name: 'Basic Laser',
    description: 'Standard mining laser. Reliable but weak.',
    tier: 'common',
    slot: 'primary',
    stats: { damage: 1.0, fireRate: 1.0 },
    price: null
  },
  {
    id: 'pulse_cannon',
    name: 'Pulse Cannon',
    description: 'Fires concentrated energy pulses. Higher burst damage.',
    tier: 'uncommon',
    slot: 'primary',
    stats: { damage: 1.4, fireRate: 0.85 },
    price: { resource: 'nickel', amount: 60 }
  },
  {
    id: 'spread_shot',
    name: 'Spread Shot',
    description: 'Wide beam that hits multiple targets.',
    tier: 'uncommon',
    slot: 'primary',
    stats: { damage: 0.8, fireRate: 1.2, targets: 3 },
    price: { resource: 'iron', amount: 120 }
  },
  {
    id: 'plasma_rifle',
    name: 'Plasma Rifle',
    description: 'Superheated plasma rounds melt through armor.',
    tier: 'rare',
    slot: 'primary',
    stats: { damage: 2.0, fireRate: 0.9 },
    price: { resource: 'helium3', amount: 50 }
  },
  {
    id: 'void_beam',
    name: 'Void Beam',
    description: 'Continuous beam that grows stronger over time.',
    tier: 'rare',
    slot: 'primary',
    stats: { damage: 1.2, fireRate: 2.0, rampUp: 0.5 },
    price: { resource: 'star_crystal', amount: 25 }
  },
  {
    id: 'quantum_driver',
    name: 'Quantum Driver',
    description: 'Quantum-entangled projectiles that ignore defenses.',
    tier: 'epic',
    slot: 'primary',
    stats: { damage: 3.0, fireRate: 0.75, armorPen: 0.4 },
    price: { resource: 'antimatter', amount: 25 }
  },
  {
    id: 'singularity_cannon',
    name: 'Singularity Cannon',
    description: 'Creates micro black holes on impact.',
    tier: 'legendary',
    slot: 'primary',
    stats: { damage: 5.0, fireRate: 0.5, aoeRadius: 40 },
    price: { resource: 'dark_matter', amount: 10 }
  },
  {
    id: 'shield_booster',
    name: 'Shield Booster',
    description: 'Auxiliary module that reinforces energy shields.',
    tier: 'common',
    slot: 'utility',
    stats: { shieldBonus: 0.1 },
    price: { resource: 'iron', amount: 50 }
  },
  {
    id: 'repair_drone',
    name: 'Repair Drone',
    description: 'Passive hull regeneration between engagements.',
    tier: 'uncommon',
    slot: 'utility',
    stats: { regenBonus: 0.008 },
    price: { resource: 'nickel', amount: 80 }
  },
  {
    id: 'cargo_expander',
    name: 'Cargo Expander',
    description: 'Increased resource yield from each run.',
    tier: 'uncommon',
    slot: 'utility',
    stats: { resourceMultBonus: 0.1 },
    price: { resource: 'helium3', amount: 30 }
  }
];
