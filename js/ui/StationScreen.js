import { META_CURRENCY_LABEL, getFailRetentionRate } from '../game/MetaState.js';
import weaponsData from '../data/weapons.js';
import { renderStatsPanel } from './StatsPanel.js';
import { renderSectorsPanel } from './SectorsPanel.js';
import { renderLoadoutTray } from './LoadoutTray.js';
import { renderSkillTreePanel } from './SkillTreePanel.js';

const SKILL_TREE_MIN_ZOOM = 0.65;
const SKILL_TREE_MAX_ZOOM = 1.8;
const SKILL_TREE_ZOOM_STEP = 0.14;
const SKILL_TREE_FIT_PADDING = 32;

export class StationScreen {
  constructor(game, metaState, sectorsData) {
    this.game = game;
    this.meta = metaState;
    this.sectorsData = sectorsData;
    this.currentView = 'campaign';
    this.skillTreePan = { x: null, y: null, zoom: null, dragging: false };
    this._skillTreeDrag = null;
    this._suppressSkillTreeClickUntil = 0;
    this.stationStatus = null;
    this._stationStatusTimer = null;
  }

  init() {
    this.render();
    this._bindEvents();
  }

  render() {
    const wrapper = document.getElementById('station-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = this._buildShell();
    this._bindEvents();
  }

  _buildShell() {
    const selectedSector = this.sectorsData[this.meta.selectedSectorIndex];
    const failRetentionPercent = Math.round(getFailRetentionRate(this.game.skillTree) * 100);

    return `
      <div class="station-layout">
        <div class="station-nav">
          <button class="nav-btn ${this.currentView === 'campaign' ? 'active' : ''}" data-view="campaign">CAMPAIGN</button>
          <button class="nav-btn ${this.currentView === 'skills' ? 'active' : ''}" data-view="skills">SKILL TREE</button>
          <div class="nav-meta">
            <span class="nav-meta-label">${META_CURRENCY_LABEL}</span>
            <span class="nav-meta-value">${this.meta.resources}</span>
          </div>
          <div class="nav-day">RUN ${this.meta.runCount}</div>
          <button class="nav-btn settings-btn" onclick="window.station.showSettings()">SETTINGS</button>
        </div>
        ${this.stationStatus ? `<div class="station-status ${this.stationStatus.tone}" role="status">${this.stationStatus.message}</div>` : ''}
        <div class="station-body">
          <div class="station-center ${this.currentView === 'skills' ? 'skills-view' : ''}">
            ${this.currentView === 'campaign' ? this._renderCampaignView() : ''}
            ${this.currentView === 'skills' ? this._renderSkillTreeView() : ''}
          </div>
          <div class="station-right">
            ${renderStatsPanel(this.game, this.meta)}
            <div class="launch-section">
              <div class="launch-sector">${this._getSelectedSectorName()}</div>
              <div class="launch-meta">Boss payout: ${this._getSelectedSectorReward()} ${META_CURRENCY_LABEL}</div>
              <div class="launch-meta">Failure keeps ${failRetentionPercent}% of gathered ${META_CURRENCY_LABEL.toLowerCase()}</div>
              ${selectedSector?.firstClearReward && !this.meta.isSectorCompleted(this.meta.selectedSectorIndex)
                ? `<div class="launch-meta">First clear bonus: +${selectedSector.firstClearReward} ${META_CURRENCY_LABEL}</div>`
                : ''}
              <button class="launch-btn" onclick="window.station.launch()">
                ▶ LAUNCH
              </button>
              <div class="launch-time">RUN ${this.game.gs.baseExpeditionTime + this.game.expeditionTimeBonus}s</div>
            </div>
          </div>
        </div>
        <div class="station-bottom">
          ${renderLoadoutTray(this.meta)}
        </div>
      </div>
    `;
  }

  _renderCampaignView() {
    return `
      <div class="campaign-panel">
        ${renderSectorsPanel(this.meta, this.game.gs, this.sectorsData)}
      </div>
    `;
  }

  _renderSkillTreeView() {
    return `
      <div class="skill-tree-panel">
        ${renderSkillTreePanel(this.game.skillTree, this.skillTreePan)}
      </div>
    `;
  }

  _getSelectedSectorName() {
    const sector = this.sectorsData[this.meta.selectedSectorIndex];
    return sector ? sector.name : 'Unknown';
  }

  _getSelectedSectorReward() {
    const sector = this.sectorsData[this.meta.selectedSectorIndex];
    return sector?.resourceReward ?? 0;
  }

  _bindEvents() {
    const wrapper = document.getElementById('station-wrapper');
    if (!wrapper) return;

    wrapper.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        this.render();
      });
    });

    this._bindSkillTreePan(wrapper);
  }

  _bindSkillTreePan(wrapper) {
    const viewport = wrapper.querySelector('[data-skill-tree-viewport]');
    const graph = wrapper.querySelector('[data-skill-tree-graph]');
    if (!viewport || !graph) return;

    this._ensureSkillTreePan(viewport, graph);
    this._applySkillTreeTransform(graph);
    this._updateSkillTreeZoomDisplay(wrapper);

    viewport.addEventListener('click', (event) => {
      if (Date.now() < this._suppressSkillTreeClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('.skill-graph-node-wrap, .skill-tree-toolbar')) return;

      this._skillTreeDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: this.skillTreePan.x,
        originY: this.skillTreePan.y,
        moved: false
      };

      this.skillTreePan.dragging = false;
      viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener('pointermove', (event) => {
      if (!this._skillTreeDrag || this._skillTreeDrag.pointerId !== event.pointerId) return;

      const dx = event.clientX - this._skillTreeDrag.startX;
      const dy = event.clientY - this._skillTreeDrag.startY;

      if (!this._skillTreeDrag.moved && Math.hypot(dx, dy) > 6) {
        this._skillTreeDrag.moved = true;
        this.skillTreePan.dragging = true;
        graph.classList.add('dragging');
      }

      if (!this._skillTreeDrag.moved) return;

      const nextPan = this._clampSkillTreePan(
        viewport,
        graph,
        this._skillTreeDrag.originX + dx,
        this._skillTreeDrag.originY + dy
      );

      this.skillTreePan.x = nextPan.x;
      this.skillTreePan.y = nextPan.y;
      this._applySkillTreeTransform(graph);
    });

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();

      const zoomFactor = event.deltaY < 0 ? 1 + SKILL_TREE_ZOOM_STEP : 1 / (1 + SKILL_TREE_ZOOM_STEP);
      const nextZoom = this._clampSkillTreeZoom((this.skillTreePan.zoom ?? 1) * zoomFactor);
      this._setSkillTreeZoom(viewport, graph, nextZoom, event.clientX, event.clientY);
    }, { passive: false });

    const finishDrag = (event) => {
      if (!this._skillTreeDrag || this._skillTreeDrag.pointerId !== event.pointerId) return;

      if (this._skillTreeDrag.moved) {
        this._suppressSkillTreeClickUntil = Date.now() + 50;
      }

      this.skillTreePan.dragging = false;
      graph.classList.remove('dragging');
      this._skillTreeDrag = null;

      try {
        viewport.releasePointerCapture(event.pointerId);
      } catch {}
    };

    viewport.addEventListener('pointerup', finishDrag);
    viewport.addEventListener('pointercancel', finishDrag);
  }

  _ensureSkillTreePan(viewport, graph) {
    if (this.skillTreePan.zoom === null) {
      this.skillTreePan.zoom = this._getFitSkillTreeZoom(viewport, graph);
    }

    const centered = this._getCenteredSkillTreePan(viewport, graph, this.skillTreePan.zoom);

    if (this.skillTreePan.x === null || this.skillTreePan.y === null) {
      this.skillTreePan.x = centered.x;
      this.skillTreePan.y = centered.y;
      return;
    }

    const clamped = this._clampSkillTreePan(viewport, graph, this.skillTreePan.x, this.skillTreePan.y);
    this.skillTreePan.x = clamped.x;
    this.skillTreePan.y = clamped.y;
  }

  _getCenteredSkillTreePan(viewport, graph, zoom = this.skillTreePan.zoom ?? 1) {
    const viewportRect = viewport.getBoundingClientRect();
    const graphWidth = graph.offsetWidth * zoom;
    const graphHeight = graph.offsetHeight * zoom;
    return {
      x: (viewportRect.width - graphWidth) / 2,
      y: (viewportRect.height - graphHeight) / 2
    };
  }

  _clampSkillTreePan(viewport, graph, x, y) {
    const viewportRect = viewport.getBoundingClientRect();
    const zoom = this.skillTreePan.zoom ?? 1;
    const graphWidth = graph.offsetWidth * zoom;
    const graphHeight = graph.offsetHeight * zoom;

    const centered = this._getCenteredSkillTreePan(viewport, graph, zoom);

    const minX = graphWidth <= viewportRect.width ? centered.x : viewportRect.width - graphWidth;
    const maxX = graphWidth <= viewportRect.width ? centered.x : 0;
    const minY = graphHeight <= viewportRect.height ? centered.y : viewportRect.height - graphHeight;
    const maxY = graphHeight <= viewportRect.height ? centered.y : 0;

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y))
    };
  }

  _applySkillTreeTransform(graph) {
    graph.style.transform = `translate3d(${this.skillTreePan.x ?? 0}px, ${this.skillTreePan.y ?? 0}px, 0) scale(${this.skillTreePan.zoom ?? 1})`;
  }

  _clampSkillTreeZoom(zoom) {
    return Math.min(SKILL_TREE_MAX_ZOOM, Math.max(SKILL_TREE_MIN_ZOOM, zoom));
  }

  _getFitSkillTreeZoom(viewport, graph) {
    const viewportRect = viewport.getBoundingClientRect();
    const fitWidth = Math.max(0.1, (viewportRect.width - SKILL_TREE_FIT_PADDING * 2) / graph.offsetWidth);
    const fitHeight = Math.max(0.1, (viewportRect.height - SKILL_TREE_FIT_PADDING * 2) / graph.offsetHeight);
    return this._clampSkillTreeZoom(Math.min(fitWidth, fitHeight));
  }

  _setSkillTreeZoom(viewport, graph, zoom, clientX, clientY) {
    const nextZoom = this._clampSkillTreeZoom(zoom);
    const previousZoom = this.skillTreePan.zoom ?? 1;

    if (Math.abs(nextZoom - previousZoom) < 0.001) return;

    const viewportRect = viewport.getBoundingClientRect();
    const anchorX = clientX !== undefined ? clientX - viewportRect.left : viewportRect.width / 2;
    const anchorY = clientY !== undefined ? clientY - viewportRect.top : viewportRect.height / 2;

    const worldX = (anchorX - (this.skillTreePan.x ?? 0)) / previousZoom;
    const worldY = (anchorY - (this.skillTreePan.y ?? 0)) / previousZoom;

    this.skillTreePan.zoom = nextZoom;

    const nextPan = this._clampSkillTreePan(
      viewport,
      graph,
      anchorX - worldX * nextZoom,
      anchorY - worldY * nextZoom
    );

    this.skillTreePan.x = nextPan.x;
    this.skillTreePan.y = nextPan.y;
    this._applySkillTreeTransform(graph);
    this._updateSkillTreeZoomDisplay();
  }

  zoomSkillTree(direction) {
    const wrapper = document.getElementById('station-wrapper');
    const viewport = wrapper?.querySelector('[data-skill-tree-viewport]');
    const graph = wrapper?.querySelector('[data-skill-tree-graph]');
    if (!viewport || !graph) return;

    this._ensureSkillTreePan(viewport, graph);

    const factor = direction > 0 ? 1 + SKILL_TREE_ZOOM_STEP : 1 / (1 + SKILL_TREE_ZOOM_STEP);
    this._setSkillTreeZoom(viewport, graph, (this.skillTreePan.zoom ?? 1) * factor);
  }

  fitSkillTree() {
    const wrapper = document.getElementById('station-wrapper');
    const viewport = wrapper?.querySelector('[data-skill-tree-viewport]');
    const graph = wrapper?.querySelector('[data-skill-tree-graph]');
    if (!viewport || !graph) return;

    this.skillTreePan.zoom = this._getFitSkillTreeZoom(viewport, graph);
    const centered = this._getCenteredSkillTreePan(viewport, graph, this.skillTreePan.zoom);
    this.skillTreePan.x = centered.x;
    this.skillTreePan.y = centered.y;
    this._applySkillTreeTransform(graph);
    this._updateSkillTreeZoomDisplay(wrapper);
  }

  _updateSkillTreeZoomDisplay(wrapper = document.getElementById('station-wrapper')) {
    const zoomLabel = wrapper?.querySelector('.skill-tree-zoom-level');
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round((this.skillTreePan.zoom ?? 1) * 100)}%`;
    }
  }

  switchView(view) {
    this.currentView = view;
    this.render();
  }

  selectSector(index) {
    if (!this.meta.selectSector(index)) return;
    this.game.travelToGalaxy(index);
    this.game._recalcStats();
    this.render();
  }

  purchaseSkillNode(nodeId) {
    const blocker = this.game.skillTree.getPurchaseBlocker(nodeId);
    if (blocker) {
      this._showStationStatus(this._formatPurchaseBlocker(blocker), 'warning');
      return;
    }

    const node = this.game.skillTree.getNode(nodeId);
    const unlockedWeaponsBefore = new Set(this.meta.unlockedWeapons);
    const unlockedModulesBefore = new Set(this.meta.unlockedModules);

    if (!this.game.skillTree.purchase(nodeId)) {
      this._showStationStatus('Purchase failed. Try again.', 'warning');
      return;
    }

    const autoEquipMessage = this._autoEquipRecentUnlock(unlockedWeaponsBefore, unlockedModulesBefore);
    this.game._recalcStats();
    this.game.save?.autoSave?.();

    const successMessage = autoEquipMessage || this._formatPurchaseSuccess(node);
    this._showStationStatus(successMessage, 'success');
  }

  equipWeaponFromArmory(weaponId) {
    const equipped = this.meta.equippedWeapons;
    const emptySlot = equipped.indexOf(null);
    if (emptySlot >= 0) {
      this.meta.equipWeapon(emptySlot, weaponId);
    } else {
      this.meta.equipWeapon(0, weaponId);
    }
    this.game._recalcStats();
    this.render();
  }

  equipUtilityFromArmory(moduleId) {
    const emptySlot = this.meta.utilitySlots.indexOf(null);
    if (emptySlot >= 0) {
      this.meta.equipUtility(emptySlot, moduleId);
    } else {
      this.meta.equipUtility(0, moduleId);
    }
    this.game._recalcStats();
    this.render();
  }

  launch() {
    if (this.game.gs.isExpeditionActive()) return;
    this.game.gs.currentGalaxyIndex = this.meta.selectedSectorIndex;
    this.game.galaxy.loadData(this.sectorsData);
    this.game._generateStars();
    this.game._recalcStats();
    this.game.startExpedition();
  }

  showSettings() {
    const el = document.getElementById('settings-panel');
    if (el) el.style.display = 'flex';
  }

  hideSettings() {
    const el = document.getElementById('settings-panel');
    if (el) el.style.display = 'none';
  }

  exportSave() {
    const data = this.game.save.exportSave();
    const textarea = document.getElementById('export-textarea');
    if (textarea) {
      textarea.value = data;
      textarea.style.display = 'block';
    }
    navigator.clipboard?.writeText(data);
  }

  showImport() {
    const textarea = document.getElementById('import-textarea');
    if (textarea) {
      textarea.style.display = 'block';
      textarea.value = '';
    }
    const row = document.getElementById('import-confirm-row');
    if (row) row.style.display = 'flex';
  }

  importSave() {
    const textarea = document.getElementById('import-textarea');
    if (!textarea) return;
    const result = this.game.save.importSave(textarea.value);
    if (result.success) {
      this.game._recalcStats();
      location.reload();
    } else {
      alert('Invalid save data: ' + result.error);
    }
  }

  resetGame() {
    if (confirm('Are you sure? This will delete all progress!')) {
      localStorage.removeItem('singularity_rush_save');
      location.reload();
    }
  }

  returnToStation() {
    const panel = document.getElementById('run-summary');
    if (panel) panel.classList.remove('active');

    this.render();
    this.game._showStation();
  }

  _showStationStatus(message, tone = 'info', duration = 2600) {
    this.stationStatus = { message, tone };
    this.render();

    if (this._stationStatusTimer) {
      clearTimeout(this._stationStatusTimer);
      this._stationStatusTimer = null;
    }

    if (!duration) return;

    this._stationStatusTimer = setTimeout(() => {
      if (this.stationStatus?.message !== message) return;
      this.stationStatus = null;
      this._stationStatusTimer = null;
      this.render();
    }, duration);
  }

  _formatPurchaseBlocker(blocker) {
    if (!blocker?.node) return 'That upgrade is unavailable right now.';

    if (blocker.code === 'missing_resources') {
      return `Need ${blocker.missingAmount} more ${META_CURRENCY_LABEL} for ${blocker.node.title}.`;
    }

    if (blocker.code === 'missing_prerequisites') {
      const titles = blocker.missingPrerequisites.map((nodeId) => this.game.skillTree.getNode(nodeId)?.title || nodeId);
      return `Requires ${titles.join(', ')}.`;
    }

    if (blocker.code === 'missing_zones') {
      return `Clear zone ${blocker.missingZones.map((zoneIndex) => zoneIndex + 1).join(', ')} first.`;
    }

    if (blocker.code === 'purchased') {
      return `${blocker.node.title} is already online.`;
    }

    return `${blocker.node.title} is locked right now.`;
  }

  _formatPurchaseSuccess(node) {
    if (!node) return 'Upgrade installed.';

    if (node.effectType === 'unlock_weapon' || node.effectType === 'unlock_module') {
      return `${this._getLoadoutItemName(node.effectValue)} unlocked.`;
    }

    return `${node.title} installed.`;
  }

  _autoEquipRecentUnlock(unlockedWeaponsBefore, unlockedModulesBefore) {
    const newWeapon = this.meta.unlockedWeapons.find((weaponId) => !unlockedWeaponsBefore.has(weaponId));
    if (newWeapon) {
      const emptyWeaponSlot = this.meta.equippedWeapons.indexOf(null);
      if (emptyWeaponSlot >= 0 && this.meta.equipWeapon(emptyWeaponSlot, newWeapon)) {
        return `${this._getLoadoutItemName(newWeapon)} unlocked and auto-equipped.`;
      }
      return `${this._getLoadoutItemName(newWeapon)} unlocked.`;
    }

    const newModule = this.meta.unlockedModules.find((moduleId) => !unlockedModulesBefore.has(moduleId));
    if (newModule) {
      const emptyUtilitySlot = this.meta.utilitySlots.indexOf(null);
      if (emptyUtilitySlot >= 0 && this.meta.equipUtility(emptyUtilitySlot, newModule)) {
        return `${this._getLoadoutItemName(newModule)} unlocked and auto-equipped.`;
      }
      return `${this._getLoadoutItemName(newModule)} unlocked.`;
    }

    return null;
  }

  _getLoadoutItemName(itemId) {
    return weaponsData.find((item) => item.id === itemId)?.name || itemId;
  }
}
