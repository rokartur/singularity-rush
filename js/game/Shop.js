import offerPoolData from '../data/shopOfferPool.js';
import metaUpgradesConfig from '../data/metaUpgrades.js';

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pickWeighted(rng, items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export class Shop {
  constructor(offerPool, config) {
    this.offerPool = offerPool;
    this.config = config || metaUpgradesConfig;
  }

  generateOffers(metaState, sectorIndex, seed) {
    const rng = seededRandom(seed ?? Date.now());
    const tierWeights = this.config.tiers;
    const count = this.config.shopSize;
    const offers = [];

    const tierEntries = Object.entries(tierWeights).map(([tier, data]) => ({
      tier,
      weight: data.weight
    }));

    const sectorMultiplier = 1 + (sectorIndex || 0) * 0.3;

    for (let i = 0; i < count; i++) {
      const tierPick = pickWeighted(rng, tierEntries);
      const eligible = this.offerPool.filter(o => o.tier === tierPick.tier);
      if (eligible.length === 0) continue;

      const template = eligible[Math.floor(rng() * eligible.length)];
      const tierConfig = tierWeights[tierPick.tier];
      const priceRange = template.priceRange;
      const priceRoll = priceRange.min + rng() * (priceRange.max - priceRange.min);
      const price = Math.ceil(priceRoll * tierConfig.priceMult * sectorMultiplier);

      const effectValue = template.effect.value;
      const description = template.description.replace('{target}', String(template.target ?? '')).replace('{value}', String(effectValue != null ? Math.round(effectValue * 100) : ''));

      offers.push({
        uid: `${template.id}_${i}_${Date.now()}`,
        templateId: template.id,
        name: template.name,
        description,
        category: template.category,
        tier: tierPick.tier,
        effect: { ...template.effect },
        price: { resource: priceRange.resource, amount: price },
        purchased: false,
        soldOut: false
      });
    }

    return offers;
  }

  canPurchase(metaState, gameState, offerIndex) {
    const offer = metaState.shopOffers[offerIndex];
    if (!offer || offer.purchased || offer.soldOut) return false;
    const have = gameState.resources[offer.price.resource] || 0;
    return have >= offer.price.amount;
  }

  purchase(metaState, gameState, offerIndex) {
    if (!this.canPurchase(metaState, gameState, offerIndex)) return { success: false, reason: 'cannot_afford' };

    const offer = metaState.shopOffers[offerIndex];
    const spent = gameState.removeResource(offer.price.resource, offer.price.amount);
    if (!spent) return { success: false, reason: 'resource_deduction_failed' };

    offer.purchased = true;

    if (offer.effect.type === 'grant_resource') {
      gameState.addResource(offer.effect.resource, offer.effect.value);
    } else if (offer.effect.type === 'grant_reroll') {
      metaState.shopRerollsFree += offer.effect.value;
    } else {
      metaState.addBuff({
        name: offer.name,
        tier: offer.tier,
        effect: { ...offer.effect }
      });
    }

    metaState.emit('offerPurchased', { offerIndex, offer });
    return { success: true };
  }

  reroll(metaState, gameState) {
    if (metaState.shopRerollsFree > 0) {
      metaState.shopRerollsFree--;
    } else {
      const cost = Math.floor(
        this.config.rerollCostBase *
        Math.pow(this.config.rerollCostScale, metaState.shopRerollsPaid)
      );
      const res = this.config.rerollCostResource;
      if ((gameState.resources[res] || 0) < cost) {
        return { success: false, reason: 'cannot_afford_reroll' };
      }
      gameState.removeResource(res, cost);
      metaState.shopRerollsPaid++;
    }

    metaState.shopSeed = (metaState.shopSeed * 16807 + 13) % 2147483647;
    metaState.shopOffers = this.generateOffers(metaState, metaState.selectedSectorIndex, metaState.shopSeed);
    metaState.emit('shopRerolled', {});
    return { success: true };
  }

  rerollCost(metaState) {
    return Math.floor(
      this.config.rerollCostBase *
      Math.pow(this.config.rerollCostScale, metaState.shopRerollsPaid)
    );
  }
}
