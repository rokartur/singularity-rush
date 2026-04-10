import { Game } from './game/Game.js';
import resourcesData from './data/resources.js';

const game = new Game();
const resourceInfo = resourcesData.resources;

function resourceChip(resourceId, amount) {
  return `
    <span class="resource-chip">
      <img class="res-icon" src="assets/sprites/resources/${resourceId}.svg" alt="${resourceId}">
      <span>${resourceInfo[resourceId]?.name || resourceId}</span>
      <strong>${Math.ceil(amount)}</strong>
    </span>
  `;
}

function renderSkillTree() {
  const shell = document.getElementById('skill-tree-shell');
  const nodes = game.skillTree.getNodes();
  const links = [];

  for (const node of nodes) {
    for (const req of node.requires || []) {
      const parent = game.skillTree.getNode(req);
      if (parent) {
        links.push({
          fromX: parent.position.x + 32,
          fromY: parent.position.y + 32,
          toX: node.position.x + 32,
          toY: node.position.y + 32,
          active: game.skillTree.getNodeLevel(req) > 0
        });
      }
    }
  }

  shell.innerHTML = `
    <div class="skill-tree-shell">
      <div class="skill-tree-board">
        <svg class="skill-tree-connections" viewBox="0 0 1560 700" preserveAspectRatio="none">
          ${links.map((link) => `
            <line
              x1="${link.fromX}"
              y1="${link.fromY}"
              x2="${link.toX}"
              y2="${link.toY}"
              class="${link.active ? 'active' : ''}"
            />
          `).join('')}
        </svg>
        ${nodes.map((node) => {
          const state = game.skillTree.getNodeState(node.id);
          const cls = state.isMaxed
            ? 'maxed'
            : state.isOwned
              ? 'owned'
              : state.canUnlock
                ? 'available'
                : 'locked';
          return `
            <div
              class="skill-graph-node-wrap"
              style="left:${node.position.x}px; top:${node.position.y}px;"
            >
              <button
                class="skill-graph-node ${cls}"
                onclick="window.gameUI.unlockNode('${node.id}')"
              >
                <img class="skill-node-icon" src="assets/sprites/resources/${node.costResource}.svg" alt="${node.costResource}">
              </button>
              <div class="skill-node-tooltip">
                <div class="skill-node-head">
                  <span>${node.name}</span>
                </div>
                <div class="skill-node-desc">${node.description}</div>
                <div class="skill-node-meta">LV ${state.level}/${node.maxLevel}</div>
                <div class="skill-node-cost">${resourceChip(node.costResource, state.cost)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  if (window.gameUI && window.gameUI.treeTransform) {
    const board = shell.querySelector('.skill-tree-board');
    if (board) {
      const t = window.gameUI.treeTransform;
      board.style.transformOrigin = '0 0';
      board.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
  }
}

window.gameUI = {
  startExpedition() {
    game.startExpedition();
  },

  closeRunSummary() {
    document.getElementById('run-summary').style.display = 'none';
  },

  showSkills() {
    if (game.gs.isExpeditionActive()) return;
    renderSkillTree();
    this.switchTab('skills');
  },

  unlockNode(nodeId) {
    if (game.gs.isExpeditionActive()) return;
    game.skillTree.unlock(nodeId);
    renderSkillTree();
  },

  showMap() {
    if (game.gs.isExpeditionActive()) return;
    const container = document.getElementById('map-galaxies');
    const galaxies = game.galaxy.getAllGalaxies();

    container.innerHTML = galaxies.map((g, i) => {
      const isCurrent = i === game.gs.currentGalaxyIndex;
      const cls = isCurrent ? 'current' : g.completed ? 'completed' : g.unlocked ? '' : 'locked';
      const costEntries = Object.entries(g.unlockCost || {});
      const costHtml = costEntries.length > 0
        ? `<div class="map-costs">${costEntries.map(([resourceId, amount]) => resourceChip(resourceId, amount)).join('')}</div>`
        : '<div class="map-free">START ZONE</div>';

      return `
        <div class="map-galaxy ${cls}">
          <div>
            <div class="map-galaxy-name" style="color: ${g.unlocked ? '#e0e0e0' : '#666'}">${i + 1}. ${g.name}</div>
            <div class="map-galaxy-desc">${g.description}</div>
            ${costHtml}
            ${g.bossKilled ? '<div class="map-boss-clear">BOSS CLEARED</div>' : ''}
          </div>
          ${g.canUnlock && !isCurrent ? `<button class="map-galaxy-btn" onclick="window.gameUI.travelTo(${i})">${g.unlocked ? 'TRAVEL' : 'UNLOCK'}</button>` : ''}
          ${isCurrent ? '<span style="color:var(--blue); font-size:10px;">CURRENT</span>' : ''}
        </div>
      `;
    }).join('');
    this.switchTab('map');
  },

  travelTo(index) {
    const result = game.travelToGalaxy(index);
    if (!result.success && result.reason === 'boss-active') {
      alert('Finish the current boss encounter before changing galaxies.');
      return;
    }
    if (!result.success && result.reason === 'expedition-active') {
      alert('Return to the station before changing galaxies.');
      return;
    }
    this.showMap();
  },

  showStats() {
    const stats = game.gs.getStatSummary();
    const extendedStats = {
      ...stats,
      'Expedition Time': `${game.gs.baseExpeditionTime + game.gs.expeditionTimeBonus}s`,
      'Click Damage': Math.floor(game.clickDamage),
      'Resource Mult': `${Math.round(game.resourceMult * 100)}%`
    };
    document.getElementById('stats-content').innerHTML = Object.entries(extendedStats).map(([k, v]) =>
      `<div class="settings-row"><span class="settings-label">${k}</span><span class="stat-value">${v}</span></div>`
    ).join('');
    this.switchTab('stats');
  },

  showSettings() {
    this.switchTab('settings');
  },

  closePanel(id) {
    this.switchTab('game');
  },

  switchTab(tabId) {
    if (game.gs.isExpeditionActive() && tabId !== 'game') return;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    
    document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`btn-${tabId}`);
    if (btn) btn.classList.add('active');
    
    const crt = document.getElementById('crt-overlay');
    if (crt) {
      crt.style.animation = 'none';
      void crt.offsetWidth;
      crt.style.animation = 'crtFlicker 0.15s steps(2)';
    }

    const mainArea = document.getElementById('main-area');
    if (mainArea) {
      mainArea.classList.remove('scanline-wipe');
      void mainArea.offsetWidth;
      mainArea.classList.add('scanline-wipe');
    }
  },

  exportSave() {
    const data = game.save.exportSave();
    const textarea = document.getElementById('export-textarea');
    textarea.value = data;
    textarea.style.display = 'block';
    navigator.clipboard?.writeText(data);
  },

  showImport() {
    const textarea = document.getElementById('import-textarea');
    textarea.style.display = 'block';
    textarea.value = '';
    document.getElementById('import-confirm-row').style.display = 'flex';
  },

  importSave() {
    const textarea = document.getElementById('import-textarea');
    const result = game.save.importSave(textarea.value);
    if (result.success) {
      game._recalcStats();
      game._generateStars();
      game.asteroidMgr.setGalaxy(game.galaxy.getCurrent());
      game._updateMenuVisibility();
      game._updateStartButton();
      this.closePanel('panel-settings');
      location.reload();
    } else {
      alert('Invalid save data: ' + result.error);
    }
  },

  resetGame() {
    if (confirm('Are you sure? This will delete all progress!')) {
      localStorage.removeItem('singularity_rush_save');
      location.reload();
    }
  }
};

game.init();
window.gameUI.showSkills();

window.gameUI.treeTransform = { x: 0, y: 0, scale: 1, initialized: false };

(function initSkillTreePanning() {
  const shell = document.getElementById('skill-tree-shell');
  let isDragging = false;
  let startX, startY;

  function updateTransform() {
    const board = document.querySelector('.skill-tree-board');
    if (board) {
      const t = window.gameUI.treeTransform;
      board.style.transformOrigin = '0 0';
      board.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
  }

  setTimeout(() => {
    if (!window.gameUI.treeTransform.initialized) {
      window.gameUI.treeTransform.x = (shell.clientWidth - 1560) / 2;
      window.gameUI.treeTransform.y = (shell.clientHeight - 700) / 2;
      window.gameUI.treeTransform.initialized = true;
      updateTransform();
    }
  }, 10);

  shell.addEventListener('mousedown', (e) => {
    if (e.target.closest('.skill-graph-node')) return;
    isDragging = true;
    shell.classList.add('dragging');
    startX = e.clientX - window.gameUI.treeTransform.x;
    startY = e.clientY - window.gameUI.treeTransform.y;
  });

  shell.addEventListener('mouseleave', () => {
    isDragging = false;
    shell.classList.remove('dragging');
  });

  shell.addEventListener('mouseup', () => {
    isDragging = false;
    shell.classList.remove('dragging');
  });

  shell.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    window.gameUI.treeTransform.x = e.clientX - startX;
    window.gameUI.treeTransform.y = e.clientY - startY;
    updateTransform();
  });

  shell.addEventListener('wheel', (e) => {
    e.preventDefault();
    const board = document.querySelector('.skill-tree-board');
    if (!board) return;

    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    
    const t = window.gameUI.treeTransform;
    const newScale = Math.min(Math.max(0.3, t.scale * zoom), 3);
    
    const rect = shell.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const boardX = (mouseX - t.x) / t.scale;
    const boardY = (mouseY - t.y) / t.scale;

    t.x = mouseX - boardX * newScale;
    t.y = mouseY - boardY * newScale;
    t.scale = newScale;
    
    updateTransform();
  });
})();
