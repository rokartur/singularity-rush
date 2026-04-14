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

  getMissingZones(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return [];

    return (node.requiredZonesCleared || []).filter((zoneIndex) => !this.meta?.isSectorCompleted?.(zoneIndex));
  }

  getPurchaseBlocker(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || !this.meta) {
      return { code: 'unavailable', node };
    }

    if (this.isPurchased(nodeId)) {
      return { code: 'purchased', node };
    }

    const missingPrerequisites = this.getMissingPrerequisites(nodeId);
    if (missingPrerequisites.length > 0) {
      return { code: 'missing_prerequisites', node, missingPrerequisites };
    }

    const missingZones = this.getMissingZones(nodeId);
    if (missingZones.length > 0) {
      return { code: 'missing_zones', node, missingZones };
    }

    if (!this.meta.canAffordResources(node.cost)) {
      return {
        code: 'missing_resources',
        node,
        missingAmount: Math.max(0, Math.ceil(node.cost - this.meta.resources))
      };
    }

    return null;
  }

  canPurchase(nodeId) {
    return this.getPurchaseBlocker(nodeId) === null;
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
    const blocker = this.getPurchaseBlocker(nodeId);

    return {
      node,
      isPurchased: this.isPurchased(nodeId),
      canPurchase: blocker === null,
      cost: node?.cost ?? Infinity,
      missingPrerequisites: this.getMissingPrerequisites(nodeId),
      missingZones: this.getMissingZones(nodeId),
      blocker
    };
  }
}
