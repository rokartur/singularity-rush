export function renderSectorsPanel(metaState, gameState, sectorsData) {
  const sectors = sectorsData.map((sector, i) => {
    const unlocked = metaState.isSectorUnlocked(i);
    const completed = metaState.isSectorCompleted(i);
    const selected = metaState.selectedSectorIndex === i;
    const previousSector = i > 0 ? sectorsData[i - 1] : null;
    const unlockHtml = unlocked
      ? `<span class="sector-cost free">AVAILABLE</span>`
      : `<span class="sector-cost">Beat ${previousSector?.bossName || previousSector?.name || 'previous boss'} to unlock</span>`;

    return `
      <div class="sector-card ${unlocked ? 'unlocked' : 'locked'} ${selected ? 'selected' : ''} ${completed ? 'completed' : ''}">
        <div class="sector-header">
          <span class="sector-difficulty">${'★'.repeat(sector.difficulty)}</span>
          <span class="sector-name">${sector.name}</span>
        </div>
        <div class="sector-desc">${sector.description}</div>
        <div class="sector-costs">${unlockHtml}</div>
        <div class="sector-costs">
          <span class="sector-cost">Boss: ${sector.bossName || sector.bossId}</span>
          <span class="sector-cost">Boss payout: ${sector.resourceReward ?? 0} resources</span>
        </div>
        ${sector.firstClearReward ? `<div class="sector-desc">First clear bonus: +${sector.firstClearReward} resources</div>` : ''}
        ${sector.recommendedPower ? `<div class="sector-desc">Recommended: ${sector.recommendedPower}</div>` : ''}
        ${completed ? '<div class="sector-badge completed-badge">CLEARED</div>' : ''}
        ${!unlocked ? '<div class="sector-badge locked-badge">LOCKED</div>' : ''}
        ${selected ? '<div class="sector-badge selected-badge">SELECTED</div>' : ''}
        <div class="sector-actions">
          ${unlocked && !selected ? `<button class="sector-btn select-btn" onclick="window.station.selectSector(${i})">SELECT</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="sectors-header">
      <span class="sectors-title">CAMPAIGN MAP</span>
    </div>
    <div class="sectors-grid">${sectors}</div>
  `;
}
