export default [
  {
    id: 'asteroid_belt',
    name: 'Asteroid Belt',
    index: 0,
    description: 'Dense asteroid field on the outskirts of the Solar System. A perfect training ground.',
    difficulty: 1,
    bgColor: '#0a0a1a',
    asteroidColor: '#8a8a8a',
    starDensity: 60,
    resources: ['resources'],
    resourceReward: 12,
    bossId: 'great_asteroid',
    unlockRule: 'start',
    recommendedPower: 'Starter loadout',
    asteroidHP: { base: 45, scale: 1.2 },
    asteroidSpawnRate: 1.2,
    unlockCost: {},
    boss: {
      name: 'Great Asteroid',
      hp: 2200,
      color: '#a0522d',
      phases: [
        { hpPercent: 100, attackInterval: 4, attackDamage: 5 },
        { hpPercent: 40, attackInterval: 2.5, attackDamage: 8 }
      ],
      reward: { xp: 20 }
    }
  },
  {
    id: 'orion_nebula',
    name: 'Orion Nebula',
    index: 1,
    description: 'Colorful gases and glowing asteroids rich in valuable minerals.',
    difficulty: 2,
    bgColor: '#0d0a1a',
    asteroidColor: '#6a5acd',
    starDensity: 80,
    resources: ['resources'],
    resourceReward: 18,
    bossId: 'star_leviathan',
    unlockRule: 'defeat_previous_boss',
    recommendedPower: 'Early offense branch + one utility unlock',
    asteroidHP: { base: 360, scale: 1.22 },
    asteroidSpawnRate: 1.0,
    unlockCost: { iron: 180, nickel: 90 },
    boss: {
      name: 'Star Leviathan',
      hp: 22000,
      color: '#ff6347',
      phases: [
        { hpPercent: 100, attackInterval: 3, attackDamage: 15 },
        { hpPercent: 60, attackInterval: 2, attackDamage: 20 },
        { hpPercent: 20, attackInterval: 1.2, attackDamage: 30 }
      ],
      reward: { xp: 35 }
    }
  },
  {
    id: 'binary_system',
    name: 'Binary System',
    index: 2,
    description: 'Two suns create gravitational chaos full of rich deposits.',
    difficulty: 3,
    bgColor: '#1a0a0a',
    asteroidColor: '#cd853f',
    starDensity: 100,
    resources: ['resources'],
    resourceReward: 25,
    bossId: 'binary_star',
    unlockRule: 'defeat_previous_boss',
    recommendedPower: 'Two branch specialization and an unlocked weapon',
    asteroidHP: { base: 2250, scale: 1.25 },
    asteroidSpawnRate: 0.9,
    unlockCost: { helium3: 110, star_crystal: 55 },
    boss: {
      name: 'Binary Star',
      hp: 220000,
      color: '#ffd700',
      phases: [
        { hpPercent: 100, attackInterval: 2.5, attackDamage: 40 },
        { hpPercent: 50, attackInterval: 1.5, attackDamage: 60 }
      ],
      reward: { xp: 55 }
    }
  },
  {
    id: 'black_hole_proxima',
    name: 'Black Hole Proxima',
    index: 3,
    description: 'Spacetime curvature hides the rarest materials in the universe.',
    difficulty: 4,
    bgColor: '#050510',
    asteroidColor: '#4b0082',
    starDensity: 40,
    resources: ['resources'],
    resourceReward: 35,
    bossId: 'event_horizon',
    unlockRule: 'defeat_previous_boss',
    recommendedPower: 'Defensive branch online with boss tempo nodes',
    asteroidHP: { base: 15000, scale: 1.25 },
    asteroidSpawnRate: 0.8,
    unlockCost: { antimatter: 70, degenerate: 30 },
    boss: {
      name: 'Event Horizon',
      hp: 2200000,
      color: '#1a0033',
      phases: [
        { hpPercent: 100, attackInterval: 2, attackDamage: 100, timer: 120 },
        { hpPercent: 30, attackInterval: 1, attackDamage: 200, timer: 60 }
      ],
      reward: { xp: 85 }
    }
  },
  {
    id: 'dwarf_galaxy',
    name: 'Dwarf Galaxy',
    index: 4,
    description: 'Dense field of neon asteroids in a small satellite galaxy.',
    difficulty: 5,
    bgColor: '#0a1a0a',
    asteroidColor: '#00ff7f',
    starDensity: 120,
    resources: ['resources'],
    resourceReward: 50,
    bossId: 'star_beetle',
    unlockRule: 'defeat_previous_boss',
    recommendedPower: 'Broad survival plus mining efficiency stack',
    asteroidHP: { base: 110000, scale: 1.25 },
    asteroidSpawnRate: 0.7,
    unlockCost: { dark_matter: 28, exotic_particle: 12 },
    boss: {
      name: 'Star Beetle',
      hp: 22000000,
      color: '#00ff7f',
      phases: [
        { hpPercent: 100, attackInterval: 1.5, attackDamage: 250, swarm: true },
        { hpPercent: 50, attackInterval: 1, attackDamage: 400, swarm: true }
      ],
      reward: { xp: 120 }
    }
  },
  {
    id: 'supernova_remnant',
    name: 'Supernova Remnant',
    index: 5,
    description: 'Unstable remains of a massive stellar explosion.',
    difficulty: 6,
    bgColor: '#1a0a05',
    asteroidColor: '#ff4500',
    starDensity: 90,
    resources: ['resources'],
    resourceReward: 65,
    bossId: 'supernova_core',
    unlockRule: 'defeat_previous_boss',
    recommendedPower: 'Mid-late tree with stronger crit or shield build',
    asteroidHP: { base: 900000, scale: 1.28 },
    asteroidSpawnRate: 0.6,
    unlockCost: { neutrino_quartz: 15, fusionium: 7 },
    boss: {
      name: 'Supernova Core',
      hp: 220000000,
      color: '#ff4500',
      phases: [
        { hpPercent: 100, attackInterval: 1.2, attackDamage: 800 },
        { hpPercent: 60, attackInterval: 0.8, attackDamage: 1200, enrageTimer: 90 },
        { hpPercent: 20, attackInterval: 0.5, attackDamage: 2000 }
      ],
      reward: { xp: 170 }
    }
  },
  {
    id: 'galactic_center',
    name: 'Galactic Core',
    index: 6,
    description: 'The heart of the galaxy. Cosmic horror and infinite power.',
    difficulty: 7,
    bgColor: '#0a0005',
    asteroidColor: '#ff00ff',
    starDensity: 150,
    resources: ['resources'],
    resourceReward: 80,
    bossId: 'singularity',
    unlockRule: 'defeat_previous_boss',
    recommendedPower: 'Late tree capstones and multiple content unlocks',
    asteroidHP: { base: 7500000, scale: 1.3 },
    asteroidSpawnRate: 0.5,
    unlockCost: { plasma: 8, neutron_core: 4 },
    boss: {
      name: 'SINGULARITY',
      hp: 4500000000,
      color: '#ff00ff',
      phases: [
        { hpPercent: 100, attackInterval: 1, attackDamage: 3000 },
        { hpPercent: 70, attackInterval: 0.7, attackDamage: 5000 },
        { hpPercent: 40, attackInterval: 0.4, attackDamage: 8000 },
        { hpPercent: 10, attackInterval: 0.2, attackDamage: 15000 }
      ],
      reward: { xp: 250 }
    }
  }
];
