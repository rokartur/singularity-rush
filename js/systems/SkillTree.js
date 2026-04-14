export class SkillTree {
  constructor(metaState = null) {
    this.meta = metaState;
    this.data = null;
  }

  bindMetaState(metaState) {
    this.meta = metaState;
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

  isPurchased(nodeId) {
    return this.meta?.isSkillNodePurchased?.(nodeId) || false;
  }

  getPurchasedNodes() {
    return this.getNodes().filter((node) => this.isPurchased(node.id));
  }

  getNodeCost(nodeId) {
    return this.getNode(nodeId)?.cost ?? Infinity;
  }

  getMissingPrerequisites(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return [];

    return (node.prerequisites || []).filter((prerequisiteId) => !this.isPurchased(prerequisiteId));
  }

  canPurchase(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || !this.meta) return false;
    if (this.isPurchased(nodeId)) return false;
    if (!this.meta.canAffordResources(node.cost)) return false;
    if (this.getMissingPrerequisites(nodeId).length > 0) return false;

    const requiredZones = node.requiredZonesCleared || [];
    if (requiredZones.some((zoneIndex) => !this.meta.isSectorCompleted(zoneIndex))) {
      return false;
    }

    return true;
  }

  purchase(nodeId) {
    if (!this.canPurchase(nodeId)) return false;

    const node = this.getNode(nodeId);
    if (!node || !this.meta?.spendResources(node.cost)) return false;

    this.meta.addPurchasedSkillNode(nodeId);

    if (node.effectType === 'unlock_weapon') {
      this.meta.unlockWeapon(node.effectValue);
    }

    if (node.effectType === 'unlock_module') {
      this.meta.unlockModule(node.effectValue);
    }

    if (node.effectType === 'unlock_system') {
      this.meta.unlockSystem(node.effectValue);
    }

    this.meta.emit('skillTreeChanged', { nodeId, node });
    return true;
  }

  getTotalEffect(statKey) {
    return this.getPurchasedNodes().reduce((total, node) => {
      if (node.effectType !== 'stat' || node.effectKey !== statKey) {
        return total;
      }

      return total + (node.effectValue || 0);
    }, 0);
  }

  getUnlockedContentIds(effectType) {
    return this.getPurchasedNodes()
      .filter((node) => node.effectType === effectType)
      .map((node) => node.effectValue);
  }

  getNodeState(nodeId) {
    const node = this.getNode(nodeId);
    return {
      node,
      isPurchased: this.isPurchased(nodeId),
      canPurchase: this.canPurchase(nodeId),
      cost: node?.cost ?? Infinity,
      missingPrerequisites: this.getMissingPrerequisites(nodeId)
    };
  }
}
