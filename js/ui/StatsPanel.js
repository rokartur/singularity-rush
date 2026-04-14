import { META_CURRENCY_LABEL, getFailRetentionRate } from '../game/MetaState.js';
import { formatNumber } from '../utils/Math.js';
import resourcesData from '../data/resources.js';

function getNextSkillGoal(game, metaState) {
  const skillTree = game.skillTree;
  if (!skillTree?.getNodes) return null;

  const candidates = skillTree.getNodes().filter((node) => {
    if (skillTree.isPurchased(node.id)) return false;
    if (skillTree.getMissingPrerequisites(node.id).length > 0) return false;
    if (skillTree.getMissingZones(node.id).length > 0) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  const nextNode = candidates.sort((left, right) => left.cost - right.cost)[0];
  const shortfall = Math.max(0, nextNode.cost - metaState.resources);

  return {
    title: nextNode.title,
    cost: nextNode.cost,
    shortfall
  };
}

export function renderStatsPanel(game, metaState) {
  const gs = game.gs;
  const selectedZone = game.galaxy.getAllGalaxies?.()[metaState.selectedSectorIndex];
  const nextSkillGoal = getNextSkillGoal(game, metaState);
  const failRetentionPercent = Math.round(getFailRetentionRate(game.skillTree) * 100);
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
    'Next Skill': nextSkillGoal
      ? nextSkillGoal.shortfall > 0
        ? `${nextSkillGoal.title} (${nextSkillGoal.shortfall} short)`
        : `${nextSkillGoal.title} READY`
      : 'Clear more zones',
    'Runs': metaState.runCount,
    'Fail Retention': `${failRetentionPercent}%`
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
