import weaponsData from '../data/weapons.js';

export function renderLoadoutTray(metaState) {
  const equipped = metaState.equippedWeapons;
  const utility = metaState.utilitySlots;

  const weaponSlots = equipped.map((weaponId, i) => {
    const weapon = weaponId ? weaponsData.find(w => w.id === weaponId) : null;
    return `
      <div class="loadout-slot ${weapon ? 'filled' : 'empty'}" data-slot="${i}" data-type="weapon">
        <div class="slot-label">${i === 0 ? 'PRIMARY' : 'SECONDARY'}</div>
        ${weapon
          ? `<div class="slot-weapon-name">${weapon.name}</div>
             <div class="slot-weapon-desc">${weapon.description}</div>`
          : '<div class="slot-empty-text">Empty</div>'}
      </div>
    `;
  }).join('');

  const utilitySlots = utility.map((moduleId, i) => {
    const mod = moduleId ? weaponsData.find(w => w.id === moduleId) : null;
    return `
      <div class="loadout-slot utility ${mod ? 'filled' : 'empty'}" data-slot="${i}" data-type="utility">
        <div class="slot-label">UTILITY</div>
        ${mod
          ? `<div class="slot-weapon-name">${mod.name}</div>`
          : '<div class="slot-empty-text">Empty</div>'}
      </div>
    `;
  }).join('');

  const ownedWeapons = metaState.unlockedWeapons
    .filter(id => !equipped.includes(id))
    .map(id => weaponsData.find(w => w.id === id))
    .filter(Boolean);

  const ownedModules = metaState.unlockedModules
    .filter(id => !utility.includes(id))
    .map(id => weaponsData.find(w => w.id === id))
    .filter(Boolean);

  const armoryHtml = ownedWeapons.length > 0
    ? ownedWeapons.map(w => `
        <div class="armory-item" onclick="window.station.equipWeaponFromArmory('${w.id}')">
          <span class="armory-name">${w.name}</span>
          <span class="armory-tier ${w.tier}">${w.tier.toUpperCase()}</span>
        </div>
      `).join('')
    : '<div class="armory-empty">No extra weapons unlocked</div>';

  const utilityArmoryHtml = ownedModules.length > 0
    ? ownedModules.map(mod => `
        <div class="armory-item" onclick="window.station.equipUtilityFromArmory('${mod.id}')">
          <span class="armory-name">${mod.name}</span>
          <span class="armory-tier ${mod.tier}">${mod.tier.toUpperCase()}</span>
        </div>
      `).join('')
    : '<div class="armory-empty">No utility modules unlocked</div>';

  return `
    <div class="loadout-tray">
      <div class="loadout-section">
        <span class="loadout-title">WEAPONS</span>
        <div class="loadout-slots">${weaponSlots}</div>
      </div>
      <div class="loadout-section">
        <span class="loadout-title">UTILITY</span>
        <div class="loadout-slots">${utilitySlots}</div>
      </div>
      <div class="loadout-section armory">
        <span class="loadout-title">WEAPON ARMORY</span>
        <div class="armory-list">${armoryHtml}</div>
      </div>
      <div class="loadout-section armory">
        <span class="loadout-title">UTILITY ARMORY</span>
        <div class="armory-list">${utilityArmoryHtml}</div>
      </div>
    </div>
  `;
}
