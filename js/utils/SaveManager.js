const SAVE_VERSION = '6.0.0';
const STORAGE_KEY = 'singularity_rush_save';

export class SaveManager {
  constructor(gameState, metaState) {
    this.gs = gameState;
    this.ms = metaState;
    this.autoSaveInterval = 30000;
    this.autoSaveTimer = 0;
  }

  generateSave() {
    const data = {
      version: SAVE_VERSION,
      timestamp: new Date().toISOString(),
      playtime_seconds: this.gs.statistics.playtime,
      galaxy: this.gs.currentGalaxyIndex,
      prestige_level: this.gs.prestigeLevel,
      level: this.gs.level,
      xp: this.gs.xp,
      resources: { ...this.gs.resources },
      hp: this.gs.hp,
      maxHp: this.gs.maxHp,
      shield: this.gs.shield,
      skillLevels: { ...this.gs.skillLevels },
      unlockedGalaxies: [...this.gs.unlockedGalaxies],
      completedGalaxies: [...this.gs.completedGalaxies],
      bossesKilledInGalaxy: { ...this.gs.bossesKilledInGalaxy },
      bossProgressCollected: this.gs.bossProgressCollected,
      bossProgressNeeded: this.gs.bossProgressNeeded,
      bossProgressActive: this.gs.bossProgressActive,
      bossState: this.gs.bossState,
      baseExpeditionTime: this.gs.baseExpeditionTime,
      expeditionTimeBonus: this.gs.expeditionTimeBonus,
      statistics: { ...this.gs.statistics },
      combo: { count: this.gs.combo.count, bestCombo: this.gs.combo.bestCombo },
      meta: this.ms ? this.ms.serialize() : null
    };
    return JSON.stringify(data);
  }

  exportSave() {
    const json = this.generateSave();
    return btoa(unescape(encodeURIComponent(json)));
  }

  importSave(b64) {
    try {
      const json = decodeURIComponent(escape(atob(b64.trim())));
      const data = JSON.parse(json);
      if (!data.version) throw new Error('Invalid save');
      this.loadFromData(data);
      this.autoSave();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  autoSave() {
    const json = this.generateSave();
    const saves = this._getAllSaves();
    saves.auto = json;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  }

  loadAutoSave() {
    const saves = this._getAllSaves();
    if (!saves.auto) return false;
    try {
      const data = JSON.parse(saves.auto);
      this.loadFromData(data);
      return true;
    } catch {
      return false;
    }
  }

  hasAutoSave() {
    const saves = this._getAllSaves();
    return !!saves.auto;
  }

  _migrateV1toV2(data) {
    const migrated = { ...data };
    migrated.version = '2.0.0';
    migrated.baseExpeditionTime = data.baseExpeditionTime ?? 15;
    migrated.expeditionTimeBonus = data.expeditionTimeBonus ?? 0;

    if (migrated.skillLevels) {
      const mapping = {
        'a_mine_drone': 'ex_time_1',
        'a_collect_drone': 'ex_lucky_start',
        'a_repair_drone': 'ex_time_1',
        'a_speed_drone': 'ex_time_2',
        'a_swarm': 'ex_speed_clicks',
        'a_quantum_link': 'ex_boss_rush',
        'a_auto_target': 'ex_double_time',
        'a_auto_craft': 'ex_crit_surge',
        'a_self_replicate': 'ex_marathon'
      };
      const newLevels = {};
      for (const [key, val] of Object.entries(migrated.skillLevels)) {
        const mapped = mapping[key];
        if (mapped) {
          newLevels[mapped] = (newLevels[mapped] || 0) + val;
        } else {
          newLevels[key] = val;
        }
      }
      migrated.skillLevels = newLevels;
    }

    if (migrated.talentCards) {
      migrated.talentCards = migrated.talentCards.filter(t => t.id !== 'automaton');
    }

    return migrated;
  }

  _migrateToV3(data) {
    const migrated = { ...data, version: '3.0.0' };
    const mapping = {
      l_power_1: 'iron_lattice',
      l_power_2: 'neutron_driver',
      l_speed_1: 'nickel_focus',
      l_speed_2: 'nickel_focus',
      ex_time_1: 'crystal_clock',
      ex_time_2: 'crystal_clock',
      ex_marathon: 'exotic_timefold',
      ex_crit_surge: 'fusion_overload',
      ex_boss_rush: 'degenerate_radar',
      d_hp_base: 'darkmatter_armor',
      d_shield: 'particle_barrier',
      d_repair_bot: 'neutrino_repair',
      e_scrapper: 'antimatter_yield',
      e_market_scan: 'plasma_refinery'
    };

    const mergedLevels = {};
    for (const [oldId, level] of Object.entries(migrated.skillLevels || {})) {
      const nextId = mapping[oldId] || oldId;
      mergedLevels[nextId] = (mergedLevels[nextId] || 0) + level;
    }
    migrated.skillLevels = mergedLevels;
    delete migrated.talentPoints;
    delete migrated.skillPoints;
    delete migrated.credits;
    delete migrated.gems;
    delete migrated.laser;
    delete migrated.modules;
    delete migrated.artifacts;
    delete migrated.talentCards;
    delete migrated.shopUpgrades;
    delete migrated.activeShopBuffs;
    delete migrated.shopSessionItems;
    return migrated;
  }

  _migrateToV4(data) {
    const migrated = { ...data, version: '4.0.0' };
    // Derive meta state from existing save data
    migrated.meta = {
      day: 1 + (data.statistics?.expeditionRuns ?? 0),
      runCount: data.statistics?.expeditionRuns ?? 0,
      selectedSectorIndex: data.galaxy ?? 0,
      unlockedSectors: data.unlockedGalaxies ?? [0],
      completedSectors: data.completedGalaxies ?? [],
      ownedWeapons: ['basic_laser'],
      equippedWeapons: ['basic_laser', null],
      utilitySlots: [null],
      activeTasks: [],
      completedTaskCount: 0,
      shopOffers: [],
      shopRerollsFree: 1,
      shopRerollsPaid: 0,
      shopSeed: Math.floor(Math.random() * 2147483647),
      ownedBuffs: []
    };
    return migrated;
  }

  _migrateToV5(data) {
    const legacyMeta = data.meta || {};

    return {
      ...data,
      version: SAVE_VERSION,
      meta: {
        day: legacyMeta.day ?? 1 + (data.statistics?.expeditionRuns ?? 0),
        runCount: legacyMeta.runCount ?? data.statistics?.expeditionRuns ?? 0,
        metaCurrency: legacyMeta.metaCurrency ?? 0,
        selectedZone: legacyMeta.selectedZone ?? legacyMeta.selectedSectorIndex ?? data.galaxy ?? 0,
        unlockedZones: legacyMeta.unlockedZones ?? legacyMeta.unlockedSectors ?? data.unlockedGalaxies ?? [0],
        clearedZones: legacyMeta.clearedZones ?? legacyMeta.completedSectors ?? data.completedGalaxies ?? [],
        purchasedSkillNodes: legacyMeta.purchasedSkillNodes ?? [],
        unlockedWeapons: legacyMeta.unlockedWeapons ?? legacyMeta.ownedWeapons ?? ['basic_laser'],
        unlockedModules: legacyMeta.unlockedModules ?? [],
        unlockedSystems: legacyMeta.unlockedSystems ?? [],
        equippedWeapons: legacyMeta.equippedWeapons ?? ['basic_laser', null],
        utilitySlots: legacyMeta.utilitySlots ?? [null]
      }
    };
  }

  _migrateToV6(data) {
    const legacyMeta = data.meta || {};

    return {
      ...data,
      version: SAVE_VERSION,
      resources: {
        resources: Math.max(0, Math.floor(data.resources?.resources ?? 0))
      },
      meta: {
        ...legacyMeta,
        resources: Math.max(0, Math.floor(legacyMeta.resources ?? legacyMeta.metaCurrency ?? 0))
      }
    };
  }

  loadFromData(data) {
    let saveData = data;
    const versionMajor = Number.parseInt(String(saveData.version || '0').split('.')[0], 10) || 0;

    if (versionMajor === 1) {
      saveData = this._migrateV1toV2(data);
    }
    const normalizedMajor = Number.parseInt(String(saveData.version || '0').split('.')[0], 10) || 0;

    if (normalizedMajor < 3) {
      saveData = this._migrateToV3(saveData);
    }
    const afterV3Major = Number.parseInt(String(saveData.version || '0').split('.')[0], 10) || 0;
    if (afterV3Major < 4) {
      saveData = this._migrateToV4(saveData);
    }
    const afterV4Major = Number.parseInt(String(saveData.version || '0').split('.')[0], 10) || 0;
    if (afterV4Major < 5) {
      saveData = this._migrateToV5(saveData);
    }
    const afterV5Major = Number.parseInt(String(saveData.version || '0').split('.')[0], 10) || 0;
    if (afterV5Major < 6) {
      saveData = this._migrateToV6(saveData);
    }

    const completedGalaxies = saveData.completedGalaxies ?? [];
    const derivedUnlocked = new Set([0, saveData.galaxy ?? 0]);
    for (const completedGalaxy of completedGalaxies) {
      derivedUnlocked.add(completedGalaxy);
      derivedUnlocked.add(completedGalaxy + 1);
    }

    const level = saveData.level ?? 1;
    const derivedMaxHp = 100 + Math.max(0, level - 1) * 10;

    this.gs.currentGalaxyIndex = saveData.galaxy ?? 0;
    this.gs.prestigeLevel = saveData.prestige_level ?? 0;
    this.gs.level = level;
    this.gs.xp = saveData.xp ?? 0;
    this.gs.resources = {
      resources: Math.max(0, Math.floor(saveData.resources?.resources ?? 0))
    };
    this.gs.maxHp = saveData.maxHp ?? derivedMaxHp;
    this.gs.hp = Math.min(saveData.hp ?? this.gs.maxHp, this.gs.maxHp);
    this.gs.shield = saveData.shield ?? 0;
    this.gs.skillLevels = saveData.skillLevels ?? {};
    this.gs.unlockedGalaxies = Array.isArray(saveData.unlockedGalaxies)
      ? [...new Set(saveData.unlockedGalaxies)].sort((a, b) => a - b)
      : [...derivedUnlocked].sort((a, b) => a - b);
    this.gs.completedGalaxies = completedGalaxies;
    this.gs.bossesKilledInGalaxy = saveData.bossesKilledInGalaxy ?? {};
    this.gs.bossProgressCollected = saveData.bossProgressCollected ?? 0;
    this.gs.bossProgressNeeded = saveData.bossProgressNeeded ?? 200;
    this.gs.bossProgressActive = saveData.bossProgressActive ?? false;
    this.gs.bossState = saveData.bossState ? structuredClone(saveData.bossState) : null;
    this.gs.baseExpeditionTime = saveData.baseExpeditionTime ?? 15;
    this.gs.expeditionTimeBonus = saveData.expeditionTimeBonus ?? 0;
    this.gs.autoMineTimer = 0;
    this.gs.statistics = { ...this.gs.statistics, ...saveData.statistics };
    if (saveData.combo) {
      this.gs.combo.count = saveData.combo.count ?? 0;
      this.gs.combo.bestCombo = saveData.combo.bestCombo ?? 0;
    }

    if (this.ms && saveData.meta) {
      this.ms.deserialize(saveData.meta);
    } else if (this.ms) {
      this.ms.deserialize(this._migrateToV5(saveData).meta);
    }

    if (this.ms) {
      this.gs.currentGalaxyIndex = this.ms.selectedSectorIndex;
      this.gs.unlockedGalaxies = [...this.ms.unlockedSectors];
      this.gs.completedGalaxies = [...this.ms.completedSectors];
    }
  }

  _getAllSaves() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { auto: null, slots: {} };
    } catch {
      return { auto: null, slots: {} };
    }
  }

  update(dt) {
    this.autoSaveTimer += dt * 1000;
    if (this.autoSaveTimer >= this.autoSaveInterval) {
      this.autoSaveTimer = 0;
      this.autoSave();
    }
  }
}
