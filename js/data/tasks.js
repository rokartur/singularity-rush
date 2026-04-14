export default [
  {
    id: 'destroy_asteroids_1',
    name: 'Asteroid Sweeper',
    description: 'Destroy {target} asteroids',
    type: 'destroy_asteroids',
    target: 25,
    reward: { resources: { iron: 30 } }
  },
  {
    id: 'destroy_asteroids_2',
    name: 'Deep Miner',
    description: 'Destroy {target} asteroids',
    type: 'destroy_asteroids',
    target: 80,
    reward: { resources: { nickel: 50, helium3: 15 } }
  },
  {
    id: 'destroy_asteroids_3',
    name: 'Void Breaker',
    description: 'Destroy {target} asteroids',
    type: 'destroy_asteroids',
    target: 200,
    reward: { resources: { star_crystal: 25, antimatter: 10 } }
  },
  {
    id: 'collect_resource_1',
    name: 'Iron Haul',
    description: 'Collect {target} Iron',
    type: 'collect_resource',
    target: 100,
    targetResource: 'iron',
    reward: { resources: { nickel: 40 } }
  },
  {
    id: 'collect_resource_2',
    name: 'Crystal Harvest',
    description: 'Collect {target} Star Crystals',
    type: 'collect_resource',
    target: 20,
    targetResource: 'star_crystal',
    reward: { resources: { helium3: 60, antimatter: 8 } }
  },
  {
    id: 'complete_runs_1',
    name: 'Rookie Runner',
    description: 'Complete {target} runs',
    type: 'complete_runs',
    target: 3,
    reward: { resources: { iron: 50, nickel: 25 } }
  },
  {
    id: 'complete_runs_2',
    name: 'Veteran Pilot',
    description: 'Complete {target} runs',
    type: 'complete_runs',
    target: 10,
    reward: { resources: { helium3: 40, star_crystal: 15 } }
  },
  {
    id: 'kill_boss_1',
    name: 'Boss Hunter',
    description: 'Defeat {target} bosses',
    type: 'kill_bosses',
    target: 1,
    reward: { resources: { iron: 120, nickel: 60 } }
  },
  {
    id: 'kill_boss_2',
    name: 'Boss Slayer',
    description: 'Defeat {target} bosses',
    type: 'kill_bosses',
    target: 3,
    reward: { resources: { antimatter: 20, degenerate: 8 } }
  },
  {
    id: 'reach_combo_1',
    name: 'Combo Starter',
    description: 'Reach a {target}x combo',
    type: 'reach_combo',
    target: 10,
    reward: { resources: { nickel: 30 } }
  },
  {
    id: 'reach_combo_2',
    name: 'Combo Master',
    description: 'Reach a {target}x combo',
    type: 'reach_combo',
    target: 30,
    reward: { resources: { star_crystal: 10, helium3: 25 } }
  }
];
