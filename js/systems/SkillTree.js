export class SkillTree {
  constructor(gameState) {
    this.gs = gameState;
    this.data = null;
  }

  loadData(skillData) {
    this.data = skillData;
  }

  getNodes() {
    return this.data?.nodes || [];
  }

  getNode(nodeId) {
    return this.getNodes().find((node) => node.id === nodeId) || null;
  }

  getNodeLevel(nodeId) {
    return this.gs.skillLevels[nodeId] || 0;
  }

  getNodeCost(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return Infinity;
    const level = this.getNodeLevel(nodeId);
    return Math.floor(node.baseCost * Math.pow(node.costScale || 1, level));
  }

  canUnlock(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return false;
    if (this.getNodeLevel(nodeId) >= node.maxLevel) return false;
    if ((this.gs.resources[node.costResource] || 0) < this.getNodeCost(nodeId)) return false;
    for (const req of (node.requires || [])) {
      if (this.getNodeLevel(req) <= 0) return false;
    }
    return true;
  }

  unlock(nodeId) {
    if (!this.canUnlock(nodeId)) return false;
    const node = this.getNode(nodeId);
    const cost = this.getNodeCost(nodeId);
    if (!this.gs.removeResource(node.costResource, cost)) return false;
    this.gs.skillLevels[nodeId] = (this.gs.skillLevels[nodeId] || 0) + 1;
    this.gs.emit('skillUpgraded', {
      nodeId,
      level: this.getNodeLevel(nodeId),
      cost,
      resource: node.costResource
    });
    return true;
  }

  getTotalEffect(effectType) {
    let total = 0;
    for (const node of this.getNodes()) {
      const level = this.getNodeLevel(node.id);
      if (level > 0 && node.effect.type === effectType) {
        total += node.effect.value * level;
      }
    }
    return total;
  }

  getNodeState(nodeId) {
    const node = this.getNode(nodeId);
    const level = this.getNodeLevel(nodeId);
    return {
      node,
      level,
      canUnlock: this.canUnlock(nodeId),
      isOwned: level > 0,
      isMaxed: level >= (node?.maxLevel || 0),
      cost: this.getNodeCost(nodeId)
    };
  }
}
