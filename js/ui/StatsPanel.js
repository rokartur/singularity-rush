import { META_CURRENCY_LABEL } from '../game/MetaState.js';
import { formatNumber } from '../utils/Math.js';
import resourcesData from '../data/resources.js';

export function renderStatsPanel(game, metaState) {
  const gs = game.gs;
  const selectedZone = game.galaxy.getAllGalaxies?.()[metaState.selectedSectorIndex];
  const stats = {
    'Day': metaState.day,
    [META_CURRENCY_LABEL]: metaState.resources,
    'Selected Zone': selectedZone?.name || `Zone ${metaState.selectedSectorIndex + 1}`,
    'Zones Cleared': metaState.clearedZones.length,
    'Level': gs.level,
    'Hull': `${Math.floor(gs.hp)}/${gs.maxHp}`,
    'Shield': gs.maxShield > 0 ? Math.floor(gs.maxShield) : '—',
    'Click DMG': formatNumber(Math.floor(game.clickDamage)),
    'Crit %': `${Math.round(game.critChance * 100)}%`,
    'Crit Mult': `${game.critMult.toFixed(1)}x`,
    'Resource Mult': `${Math.round(game.resourceMult * 100)}%`,
    'Run Time': `${gs.baseExpeditionTime + game.expeditionTimeBonus}s`,
    'Boss Progress': `${Math.round(game.bossProgressMult * 100)}%`,
    'Runs': metaState.runCount,
    'Fail Retention': '25%'
  };

  const currentResources = Object.entries(gs.resources)
    .filter(([, v]) => v > 0)
    .map(([key, val]) => {
      const info = resourcesData.resources[key];
      return `<div class="bank-row"><span class="bank-name" style="color:${info?.color || '#aaa'}">${info?.name || key}</span><span class="bank-val">${formatNumber(Math.floor(val))}</span></div>`;
    }).join('');

  return `
    <div class="stats-section">
      <div class="stats-title">CAMPAIGN STATUS</div>
      ${Object.entries(stats).map(([k, v]) =>
        `<div class="stat-row"><span class="stat-key">${k}</span><span class="stat-val">${v}</span></div>`
      ).join('')}
    </div>
    <div class="stats-section bank-section">
      <div class="stats-title">RUN RESOURCES</div>
      ${currentResources || '<div class="bank-empty">Empty</div>'}
    </div>
  `;
}
