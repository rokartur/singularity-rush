import { META_CURRENCY_LABEL } from '../game/MetaState.js';

const GRAPH_WIDTH = 1160;
const GRAPH_HEIGHT = 920;

const NODE_LAYOUT = {
  core_targeting: { x: 438, y: 338, size: 84 },

  combat_throttle: { x: 448, y: 246, size: 64 },
  crit_matrix: { x: 448, y: 164, size: 60 },
  targeting_uplink: { x: 522, y: 164, size: 60 },
  pulse_cannon_license: { x: 374, y: 164, size: 60 },
  plasma_rifle_license: { x: 374, y: 86, size: 60 },
  overcharge_chamber: { x: 448, y: 86, size: 60 },
  quantum_driver_license: { x: 522, y: 86, size: 60 },
  laser_overclock: { x: 596, y: 86, size: 60 },
  singularity_cannon_license: { x: 670, y: 86, size: 60 },

  hull_rivets: { x: 346, y: 348, size: 64 },
  reinforced_bulkheads: { x: 258, y: 348, size: 60 },
  shield_booster_license: { x: 258, y: 274, size: 60 },
  particle_screening: { x: 170, y: 311, size: 60 },
  ablative_mesh: { x: 170, y: 385, size: 60 },
  repair_drone_license: { x: 96, y: 311, size: 60 },
  capacitor_lattice: { x: 96, y: 385, size: 60 },
  emergency_regen: { x: 96, y: 237, size: 60 },
  triage_protocol: { x: 96, y: 163, size: 60 },

  salvage_routines: { x: 448, y: 430, size: 64 },
  ore_crushers: { x: 448, y: 514, size: 60 },
  spread_shot_license: { x: 374, y: 514, size: 60 },
  precision_extractors: { x: 448, y: 598, size: 60 },
  cargo_expander_license: { x: 374, y: 598, size: 60 },
  survey_beacons: { x: 522, y: 598, size: 60 },
  scavenger_drones: { x: 300, y: 598, size: 60 },
  deep_core_reprocessing: { x: 448, y: 682, size: 60 },
  jackpot_relays: { x: 448, y: 766, size: 60 },

  vector_thrusters: { x: 550, y: 348, size: 64 },
  time_dilation: { x: 640, y: 348, size: 60 },
  boss_scanner: { x: 728, y: 348, size: 60 },
  drift_stabilizers: { x: 550, y: 422, size: 60 },
  fallback_cache: { x: 640, y: 422, size: 60 },
  cooldown_mesh: { x: 728, y: 422, size: 60 },
  hunter_killer_link: { x: 816, y: 348, size: 60 },
  void_beam_license: { x: 816, y: 422, size: 60 }
};

const GLYPHS = {
  core_targeting: '⚙',
  combat_throttle: 'ROF',
  crit_matrix: 'CRT',
  targeting_uplink: 'DMG',
  pulse_cannon_license: 'WPN',
  plasma_rifle_license: 'PLS',
  overcharge_chamber: 'AMP',
  quantum_driver_license: 'QNT',
  laser_overclock: 'OVR',
  singularity_cannon_license: 'SGC',
  hull_rivets: 'HP',
  reinforced_bulkheads: 'HUL',
  shield_booster_license: 'SHD',
  particle_screening: 'SCR',
  ablative_mesh: 'ABL',
  repair_drone_license: 'DRN',
  capacitor_lattice: 'CAP',
  emergency_regen: 'REG',
  triage_protocol: 'MED',
  salvage_routines: 'ORE',
  ore_crushers: 'MIN',
  spread_shot_license: 'SPR',
  precision_extractors: 'PRC',
  cargo_expander_license: 'CRG',
  survey_beacons: 'CLR',
  scavenger_drones: 'BOT',
  deep_core_reprocessing: 'DCR',
  jackpot_relays: 'JPT',
  vector_thrusters: 'SPD',
  time_dilation: 'TIME',
  boss_scanner: 'BOSS',
  drift_stabilizers: 'DRF',
  fallback_cache: 'SAFE',
  cooldown_mesh: 'CDR',
  hunter_killer_link: 'HK',
  void_beam_license: 'VOID'
};

const BRANCH_LABELS = {
  shared: 'Core',
  offense: 'Offense',
  defense: 'Defense',
  mining: 'Mining',
  utility: 'Utility'
};

const EFFECT_LABELS = {
  click_damage_flat: 'flat damage',
  click_damage_mult: 'damage multiplier',
  crit_chance: 'crit chance',
  crit_mult: 'crit damage',
  max_hp: 'max hull',
  shield: 'shield conversion',
  passive_regen: 'passive regen',
  resource_mult: 'resource yield',
  boss_progress: 'boss progress',
  expedition_time: 'run time',
  fire_rate: 'fire rate',
  ship_speed: 'ship speed',
  fail_retention: 'fail retention',
  first_clear_bonus: 'first clear bonus'
};

function centerOf(layout) {
  return {
    x: layout.x + layout.size / 2,
    y: layout.y + layout.size / 2
  };
}

function formatEffect(node) {
  if (node.effectType === 'unlock_weapon') return `Unlock weapon: ${node.effectValue}`;
  if (node.effectType === 'unlock_module') return `Unlock module: ${node.effectValue}`;
  if (node.effectType === 'unlock_system') return `Unlock system: ${node.effectValue}`;

  const label = EFFECT_LABELS[node.effectKey] || node.effectKey;
  const numericValue = Number(node.effectValue);
  const isPercent = ['crit_chance', 'click_damage_mult', 'max_hp', 'shield', 'passive_regen', 'resource_mult', 'boss_progress', 'fail_retention', 'first_clear_bonus'].includes(node.effectKey);

  if (isPercent) {
    return `+${Math.round(numericValue * 100)}% ${label}`;
  }

  return `+${numericValue} ${label}`;
}

function getNodeStateClass(state) {
  return state.isPurchased ? 'purchased' : state.canPurchase ? 'available' : 'locked';
}

function getNodeGlyph(node, state) {
  if (node.id === 'core_targeting') return GLYPHS[node.id] || '⚙';
  if (!state.isPurchased && !state.canPurchase) return '?';
  return GLYPHS[node.id] || node.title.slice(0, 3).toUpperCase();
}

function formatRequirementNotes(node, state, skillTree) {
  const notes = [];

  if (state.missingPrerequisites.length > 0) {
    const missingTitles = state.missingPrerequisites.map((prerequisiteId) => {
      return skillTree.getNode(prerequisiteId)?.title || prerequisiteId;
    });
    notes.push(`Requires: ${missingTitles.join(', ')}`);
  }

  if (state.missingZones.length > 0) {
    notes.push(`Clear zones: ${state.missingZones.map((zone) => zone + 1).join(', ')}`);
  } else if ((node.requiredZonesCleared || []).length > 0) {
    notes.push(`Zone clears: ${(node.requiredZonesCleared || []).map((zone) => zone + 1).join(', ')}`);
  }

  return notes;
}

function getTooltipStatus(node, state) {
  if (state.isPurchased) {
    return {
      label: 'PURCHASED',
      cost: 'OWNED'
    };
  }

  if (state.canPurchase) {
    return {
      label: 'CLICK TO BUY',
      cost: `${node.cost} ${META_CURRENCY_LABEL}`
    };
  }

  return {
    label: 'LOCKED',
    cost: `${node.cost} ${META_CURRENCY_LABEL}`
  };
}

function renderConnections(skillTree) {
  const paths = [];

  for (const node of skillTree.getNodes()) {
    const endLayout = NODE_LAYOUT[node.id];
    if (!endLayout) continue;

    for (const prerequisiteId of node.prerequisites || []) {
      const startLayout = NODE_LAYOUT[prerequisiteId];
      if (!startLayout) continue;

      const from = centerOf(startLayout);
      const to = centerOf(endLayout);
      const elbowX = Math.abs(from.x - to.x) > Math.abs(from.y - to.y)
        ? (from.x + to.x) / 2
        : from.x;
      const elbowY = Math.abs(from.y - to.y) >= Math.abs(from.x - to.x)
        ? (from.y + to.y) / 2
        : to.y;

      const purchased = skillTree.isPurchased(prerequisiteId) && skillTree.isPurchased(node.id);
      const reachable = skillTree.isPurchased(prerequisiteId) && !skillTree.isPurchased(node.id);

      paths.push(`
        <path
          class="skill-link ${purchased ? 'purchased' : reachable ? 'reachable' : 'locked'}"
          d="M ${from.x} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${elbowY} L ${to.x} ${elbowY} L ${to.x} ${to.y}"
        />
      `);
    }
  }

  return `
    <svg class="skill-graph-lines" viewBox="0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}" aria-hidden="true">
      ${paths.join('')}
    </svg>
  `;
}

function renderTooltip(node, state, skillTree) {
  const status = getTooltipStatus(node, state);
  const notes = formatRequirementNotes(node, state, skillTree);

  return `
    <div class="skill-node-tooltip" role="tooltip">
      <div class="skill-node-tooltip-top">
        <div>
          <div class="skill-node-tooltip-branch">${BRANCH_LABELS[node.branch] || node.branch} · T${node.tier + 1}</div>
          <div class="skill-node-tooltip-title">${node.title}</div>
        </div>
        <div class="skill-node-tooltip-cost">${status.cost}</div>
      </div>
      <div class="skill-node-tooltip-status ${state.isPurchased ? 'purchased' : state.canPurchase ? 'available' : 'locked'}">${status.label}</div>
      <div class="skill-node-tooltip-desc">${node.description}</div>
      <div class="skill-node-tooltip-effect">${formatEffect(node)}</div>
      ${notes.map((note) => `<div class="skill-node-tooltip-note">${note}</div>`).join('')}
    </div>
  `;
}

function renderNodeButton(node, skillTree) {
  const layout = NODE_LAYOUT[node.id];
  if (!layout) return '';

  const state = skillTree.getNodeState(node.id);
  const className = getNodeStateClass(state);

  return `
    <div
      class="skill-graph-node-wrap"
      style="left:${layout.x}px;top:${layout.y}px;width:${layout.size}px;height:${layout.size}px"
    >
      <button
        type="button"
        class="skill-graph-node ${className} ${node.id === 'core_targeting' ? 'core' : ''}"
        style="width:${layout.size}px;height:${layout.size}px"
        onclick="window.station.purchaseSkillNode('${node.id}')"
        aria-label="${node.title}"
        aria-disabled="${state.canPurchase ? 'false' : 'true'}"
        ${state.canPurchase ? '' : 'disabled'}
      >
        <span class="skill-graph-glyph">${getNodeGlyph(node, state)}</span>
      </button>
      ${renderTooltip(node, state, skillTree)}
    </div>
  `;
}

export function renderSkillTreePanel(skillTree, pan = { x: 0, y: 0 }) {
  const nodes = skillTree.getNodes();
  const zoomPercent = Math.round((pan.zoom ?? 1) * 100);

  return `
    <div class="skill-tree-toolbar">
      <div class="skill-tree-zoom-controls" aria-label="Skill tree zoom controls">
        <button type="button" class="skill-tree-zoom-btn" onclick="window.station.zoomSkillTree(-1)" aria-label="Zoom out">−</button>
        <button type="button" class="skill-tree-zoom-level" onclick="window.station.fitSkillTree()" aria-label="Fit skill tree to viewport">${zoomPercent}%</button>
        <button type="button" class="skill-tree-zoom-btn" onclick="window.station.zoomSkillTree(1)" aria-label="Zoom in">+</button>
      </div>
    </div>

    <div class="skill-tree-graph-shell">
      <div class="skill-tree-viewport" data-skill-tree-viewport>
        <div
          class="skill-tree-graph ${pan.dragging ? 'dragging' : ''}"
          data-skill-tree-graph
          style="--graph-width:${GRAPH_WIDTH}px;--graph-height:${GRAPH_HEIGHT}px;transform:translate3d(${pan.x ?? 0}px, ${pan.y ?? 0}px, 0) scale(${pan.zoom ?? 1})"
        >
          <div class="skill-tree-backdrop"></div>
          <div class="skill-tree-core-ring"></div>
          ${renderConnections(skillTree)}
          ${nodes.map((node) => renderNodeButton(node, skillTree)).join('')}
        </div>
      </div>
      <div class="skill-tree-legend">
        <div class="legend-item"><span class="legend-swatch available"></span> Available</div>
        <div class="legend-item"><span class="legend-swatch purchased"></span> Purchased</div>
        <div class="legend-item"><span class="legend-swatch locked"></span> Hidden / locked</div>
      </div>
    </div>
  `;
}
