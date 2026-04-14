export const META_CURRENCY_LABEL = 'RESOURCES';

const DEFAULT_WEAPON_SLOTS = 2;
const DEFAULT_UTILITY_SLOTS = 1;

function withUniqueNumbers(values, fallback = [0]) {
  const normalized = Array.isArray(values)
    ? [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))].sort((a, b) => a - b)
    : [];

  return normalized.length > 0 ? normalized : [...fallback];
}

function withUniqueStrings(values, fallback = []) {
  const normalized = Array.isArray(values)
    ? [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
    : [];

  return normalized.length > 0 ? normalized : [...fallback];
}

export class MetaState {
  constructor() {
    this.day = 1;
    this.runCount = 0;
    this.resources = 0;
    this.selectedZone = 0;
    this.unlockedZones = [0];
    this.clearedZones = [];

    this.purchasedSkillNodes = [];
    this.unlockedWeapons = ['basic_laser'];
    this.unlockedModules = [];
    this.unlockedSystems = [];

    this.equippedWeapons = ['basic_laser', null];
    this.utilitySlots = [null];

    this._listeners = new Map();
    this._pendingNotifications = [];
  }

  get selectedSectorIndex() {
    return this.selectedZone;
  }

  set selectedSectorIndex(value) {
    this.selectedZone = value;
  }

  get unlockedSectors() {
    return this.unlockedZones;
  }

  set unlockedSectors(value) {
    this.unlockedZones = value;
  }

  get completedSectors() {
    return this.clearedZones;
  }

  set completedSectors(value) {
    this.clearedZones = value;
  }

  get ownedWeapons() {
    return this.unlockedWeapons;
  }

  set ownedWeapons(value) {
    this.unlockedWeapons = value;
  }

  get metaCurrency() {
    return this.resources;
  }

  set metaCurrency(value) {
    this.resources = Math.max(0, Math.floor(value ?? 0));
  }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(cb);
  }

  off(event, cb) {
    if (!this._listeners.has(event)) return;
    const arr = this._listeners.get(event);
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  }

  emit(event, data) {
    this._pendingNotifications.push({ event, data });
  }

  flushNotifications() {
    const pending = this._pendingNotifications;
    this._pendingNotifications = [];

    for (const { event, data } of pending) {
      const listeners = this._listeners.get(event);
      if (!listeners) continue;
      for (const cb of listeners) cb(data);
    }
  }

  isSectorUnlocked(index) {
    return this.unlockedZones.includes(index);
  }

  isSectorCompleted(index) {
    return this.clearedZones.includes(index);
  }

  isSkillNodePurchased(nodeId) {
    return this.purchasedSkillNodes.includes(nodeId);
  }

  canAffordResources(amount) {
    return this.resources >= amount;
  }

  canAffordMeta(amount) {
    return this.canAffordResources(amount);
  }

  addResources(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    this.resources += Math.floor(amount);
    this.emit('metaCurrencyChanged', { value: this.resources, delta: Math.floor(amount) });
    return Math.floor(amount);
  }

  addMetaCurrency(amount) {
    return this.addResources(amount);
  }

  spendResources(amount) {
    const normalizedAmount = Math.floor(amount);
    if (!this.canAffordResources(normalizedAmount)) return false;
    this.resources -= normalizedAmount;
    this.emit('metaCurrencyChanged', { value: this.resources, delta: -normalizedAmount });
    return true;
  }

  spendMetaCurrency(amount) {
    return this.spendResources(amount);
  }

  completeRun(summary = {}, zonesData = []) {
    this.runCount += 1;
    this.day = 1 + this.runCount;

    const zoneIndex = summary.zoneIndex ?? this.selectedZone;
    const successful = Boolean(summary.success && summary.bossDefeated);
    const collected = Math.max(0, Math.floor(
      summary.resourcesCollected
      ?? summary.resourcesFromAsteroids
      ?? 0
    ));
    const retained = successful
      ? collected
      : Math.floor(collected * 0.25);

    if (retained > 0) {
      this.addResources(retained);
    }

    if (successful) {
      this.markZoneCleared(zoneIndex);
      this.unlockNextZone(zoneIndex, zonesData);
    }

    this.emit('runCompleted', {
      day: this.day,
      summary,
      successful,
      reward: retained,
      retained,
      collected,
      zoneIndex
    });

    return { successful, reward: retained, retained, collected, zoneIndex };
  }

  unlockZone(index) {
    if (!Number.isInteger(index) || index < 0 || this.unlockedZones.includes(index)) {
      return false;
    }

    this.unlockedZones.push(index);
    this.unlockedZones.sort((a, b) => a - b);
    this.emit('zoneUnlocked', { index });
    return true;
  }

  markZoneCleared(index) {
    if (!Number.isInteger(index) || index < 0 || this.clearedZones.includes(index)) {
      return false;
    }

    this.clearedZones.push(index);
    this.clearedZones.sort((a, b) => a - b);
    this.emit('zoneCleared', { index });
    return true;
  }

  unlockNextZone(index, zonesData = []) {
    const nextIndex = index + 1;
    if (nextIndex >= zonesData.length) return false;
    return this.unlockZone(nextIndex);
  }

  selectSector(index) {
    if (!this.isSectorUnlocked(index)) return false;
    this.selectedZone = index;
    this.emit('sectorSelected', { index });
    return true;
  }

  addPurchasedSkillNode(nodeId) {
    if (this.purchasedSkillNodes.includes(nodeId)) return false;
    this.purchasedSkillNodes.push(nodeId);
    this.emit('skillNodePurchased', { nodeId });
    return true;
  }

  unlockWeapon(weaponId) {
    if (!weaponId || this.unlockedWeapons.includes(weaponId)) return false;
    this.unlockedWeapons.push(weaponId);
    this.emit('weaponUnlocked', { weaponId });
    return true;
  }

  unlockModule(moduleId) {
    if (!moduleId || this.unlockedModules.includes(moduleId)) return false;
    this.unlockedModules.push(moduleId);
    this.emit('moduleUnlocked', { moduleId });
    return true;
  }

  unlockSystem(systemId) {
    if (!systemId || this.unlockedSystems.includes(systemId)) return false;
    this.unlockedSystems.push(systemId);
    this.emit('systemUnlocked', { systemId });
    return true;
  }

  equipWeapon(slotIndex, weaponId) {
    if (slotIndex < 0 || slotIndex >= this.equippedWeapons.length) return false;
    if (weaponId !== null && !this.unlockedWeapons.includes(weaponId)) return false;

    this.equippedWeapons[slotIndex] = weaponId;
    this.emit('loadoutChanged', { type: 'weapon', slotIndex, weaponId });
    return true;
  }

  equipUtility(slotIndex, moduleId) {
    if (slotIndex < 0 || slotIndex >= this.utilitySlots.length) return false;
    if (moduleId !== null && !this.unlockedModules.includes(moduleId)) return false;

    this.utilitySlots[slotIndex] = moduleId;
    this.emit('loadoutChanged', { type: 'utility', slotIndex, moduleId });
    return true;
  }

  serialize() {
    return {
      day: this.day,
      runCount: this.runCount,
      resources: this.resources,
      selectedZone: this.selectedZone,
      selectedSectorIndex: this.selectedZone,
      unlockedZones: [...this.unlockedZones],
      unlockedSectors: [...this.unlockedZones],
      clearedZones: [...this.clearedZones],
      completedSectors: [...this.clearedZones],
      purchasedSkillNodes: [...this.purchasedSkillNodes],
      unlockedWeapons: [...this.unlockedWeapons],
      ownedWeapons: [...this.unlockedWeapons],
      unlockedModules: [...this.unlockedModules],
      unlockedSystems: [...this.unlockedSystems],
      equippedWeapons: [...this.equippedWeapons],
      utilitySlots: [...this.utilitySlots]
    };
  }

  deserialize(data) {
    if (!data) return;

    this.day = data.day ?? 1;
    this.runCount = data.runCount ?? 0;
    this.resources = Math.max(0, Math.floor(data.resources ?? data.metaCurrency ?? 0));
    this.selectedZone = data.selectedZone ?? data.selectedSectorIndex ?? 0;
    this.unlockedZones = withUniqueNumbers(data.unlockedZones ?? data.unlockedSectors, [0]);
    this.clearedZones = withUniqueNumbers(data.clearedZones ?? data.completedSectors, []);
    this.purchasedSkillNodes = withUniqueStrings(data.purchasedSkillNodes, []);
    this.unlockedWeapons = withUniqueStrings(data.unlockedWeapons ?? data.ownedWeapons, ['basic_laser']);
    this.unlockedModules = withUniqueStrings(data.unlockedModules, []);
    this.unlockedSystems = withUniqueStrings(data.unlockedSystems, []);

    this.equippedWeapons = Array.isArray(data.equippedWeapons)
      ? [...data.equippedWeapons]
      : ['basic_laser', null];
    while (this.equippedWeapons.length < DEFAULT_WEAPON_SLOTS) {
      this.equippedWeapons.push(null);
    }
    if (!this.equippedWeapons.some((weaponId) => weaponId === 'basic_laser') && this.unlockedWeapons.includes('basic_laser')) {
      this.equippedWeapons[0] = this.equippedWeapons[0] || 'basic_laser';
    }

    this.utilitySlots = Array.isArray(data.utilitySlots)
      ? [...data.utilitySlots]
      : [null];
    while (this.utilitySlots.length < DEFAULT_UTILITY_SLOTS) {
      this.utilitySlots.push(null);
    }

    if (!this.isSectorUnlocked(this.selectedZone)) {
      this.selectedZone = this.unlockedZones[0] ?? 0;
    }
  }
}
