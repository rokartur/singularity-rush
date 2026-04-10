export default [
  {
    "id": "asteroid_belt",
    "name": "Pas Asteroid",
    "index": 0,
    "description": "Gęste pole asteroid na obrzeżach Układu Słonecznego. Idealne miejsce na start.",
    "bgColor": "#0a0a1a",
    "asteroidColor": "#8a8a8a",
    "starDensity": 60,
    "resources": ["iron", "nickel"],
    "asteroidHP": { "base": 45, "scale": 1.2 },
    "asteroidSpawnRate": 1.2,
    "unlockCost": {},
    "boss": {
      "name": "Wielka Asteroida",
      "hp": 2200,
      "color": "#a0522d",
      "phases": [
        { "hpPercent": 100, "attackInterval": 4, "attackDamage": 5 },
        { "hpPercent": 40, "attackInterval": 2.5, "attackDamage": 8 }
      ],
      "reward": { "resources": { "iron": 90, "nickel": 35 }, "xp": 20 }
    }
  },
  {
    "id": "orion_nebula",
    "name": "Mgławica Oriona",
    "index": 1,
    "description": "Kolorowe gazy i świecące asteroidy pełne cennych surowców.",
    "bgColor": "#0d0a1a",
    "asteroidColor": "#6a5acd",
    "starDensity": 80,
    "resources": ["iron", "nickel", "helium3", "star_crystal"],
    "asteroidHP": { "base": 360, "scale": 1.22 },
    "asteroidSpawnRate": 1.0,
    "unlockCost": { "iron": 180, "nickel": 90 },
    "boss": {
      "name": "Gwiezdny Lewiatan",
      "hp": 22000,
      "color": "#ff6347",
      "phases": [
        { "hpPercent": 100, "attackInterval": 3, "attackDamage": 15 },
        { "hpPercent": 60, "attackInterval": 2, "attackDamage": 20 },
        { "hpPercent": 20, "attackInterval": 1.2, "attackDamage": 30 }
      ],
      "reward": { "resources": { "helium3": 45, "star_crystal": 18 }, "xp": 35 }
    }
  },
  {
    "id": "binary_system",
    "name": "Układ Podwójny",
    "index": 2,
    "description": "Dwa słońca tworzą grawitacyjny chaos pełen bogatych złóż.",
    "bgColor": "#1a0a0a",
    "asteroidColor": "#cd853f",
    "starDensity": 100,
    "resources": ["iron", "nickel", "helium3", "star_crystal", "antimatter", "degenerate"],
    "asteroidHP": { "base": 2250, "scale": 1.25 },
    "asteroidSpawnRate": 0.9,
    "unlockCost": { "helium3": 110, "star_crystal": 55 },
    "boss": {
      "name": "Binarna Gwiazda",
      "hp": 220000,
      "color": "#ffd700",
      "phases": [
        { "hpPercent": 100, "attackInterval": 2.5, "attackDamage": 40 },
        { "hpPercent": 50, "attackInterval": 1.5, "attackDamage": 60 }
      ],
      "reward": { "resources": { "antimatter": 30, "degenerate": 12 }, "xp": 55 }
    }
  },
  {
    "id": "black_hole_proxima",
    "name": "Czarna Dziura Proxima",
    "index": 3,
    "description": "Zakrzywienie czasoprzestrzeni ukrywa najrzadsze materiały wszechświata.",
    "bgColor": "#050510",
    "asteroidColor": "#4b0082",
    "starDensity": 40,
    "resources": ["antimatter", "degenerate", "dark_matter", "exotic_particle"],
    "asteroidHP": { "base": 15000, "scale": 1.25 },
    "asteroidSpawnRate": 0.8,
    "unlockCost": { "antimatter": 70, "degenerate": 30 },
    "boss": {
      "name": "Horyzont Zdarzeń",
      "hp": 2200000,
      "color": "#1a0033",
      "phases": [
        { "hpPercent": 100, "attackInterval": 2, "attackDamage": 100, "timer": 120 },
        { "hpPercent": 30, "attackInterval": 1, "attackDamage": 200, "timer": 60 }
      ],
      "reward": { "resources": { "dark_matter": 18, "exotic_particle": 8 }, "xp": 85 }
    }
  },
  {
    "id": "dwarf_galaxy",
    "name": "Galaktyka Karłowata",
    "index": 4,
    "description": "Gęste pole neonowych asteroid w małej galaktyce satelitarnej.",
    "bgColor": "#0a1a0a",
    "asteroidColor": "#00ff7f",
    "starDensity": 120,
    "resources": ["dark_matter", "exotic_particle", "neutrino_quartz", "fusionium"],
    "asteroidHP": { "base": 110000, "scale": 1.25 },
    "asteroidSpawnRate": 0.7,
    "unlockCost": { "dark_matter": 28, "exotic_particle": 12 },
    "boss": {
      "name": "Gwiezdny Żuk",
      "hp": 22000000,
      "color": "#00ff7f",
      "phases": [
        { "hpPercent": 100, "attackInterval": 1.5, "attackDamage": 250, "swarm": true },
        { "hpPercent": 50, "attackInterval": 1, "attackDamage": 400, "swarm": true }
      ],
      "reward": { "resources": { "neutrino_quartz": 10, "fusionium": 5 }, "xp": 120 }
    }
  },
  {
    "id": "supernova_remnant",
    "name": "Supernova Remnant",
    "index": 5,
    "description": "Niestabilne pozostałości potężnej eksplozji gwiazdy.",
    "bgColor": "#1a0a05",
    "asteroidColor": "#ff4500",
    "starDensity": 90,
    "resources": ["neutrino_quartz", "fusionium", "plasma", "neutron_core"],
    "asteroidHP": { "base": 900000, "scale": 1.28 },
    "asteroidSpawnRate": 0.6,
    "unlockCost": { "neutrino_quartz": 15, "fusionium": 7 },
    "boss": {
      "name": "Resztki Supernovej",
      "hp": 220000000,
      "color": "#ff4500",
      "phases": [
        { "hpPercent": 100, "attackInterval": 1.2, "attackDamage": 800 },
        { "hpPercent": 60, "attackInterval": 0.8, "attackDamage": 1200, "enrageTimer": 90 },
        { "hpPercent": 20, "attackInterval": 0.5, "attackDamage": 2000 }
      ],
      "reward": { "resources": { "plasma": 6, "neutron_core": 3 }, "xp": 170 }
    }
  },
  {
    "id": "galactic_center",
    "name": "Centrum Galaktyki",
    "index": 6,
    "description": "Samo serce galaktyki. Kosmiczny horror i nieskończona moc.",
    "bgColor": "#0a0005",
    "asteroidColor": "#ff00ff",
    "starDensity": 150,
    "resources": ["plasma", "neutron_core", "exotic_matter", "quantum_string"],
    "asteroidHP": { "base": 7500000, "scale": 1.3 },
    "asteroidSpawnRate": 0.5,
    "unlockCost": { "plasma": 8, "neutron_core": 4 },
    "boss": {
      "name": "SINGULARITY",
      "hp": 4500000000,
      "color": "#ff00ff",
      "phases": [
        { "hpPercent": 100, "attackInterval": 1, "attackDamage": 3000 },
        { "hpPercent": 70, "attackInterval": 0.7, "attackDamage": 5000 },
        { "hpPercent": 40, "attackInterval": 0.4, "attackDamage": 8000 },
        { "hpPercent": 10, "attackInterval": 0.2, "attackDamage": 15000 }
      ],
      "reward": { "resources": { "exotic_matter": 2, "quantum_string": 1 }, "xp": 250 }
    }
  }
];
