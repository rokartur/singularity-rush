import { formatNumber } from '../utils/Math.js';
import offerPoolData from '../data/shopOfferPool.js';
import resourcesData from '../data/resources.js';

const TIER_COLORS = {
  common: '#8a8a8a',
  uncommon: '#50c878',
  rare: '#009dff',
  epic: '#9b59b6',
  legendary: '#ff6b35'
};

const TIER_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary'
};

export function renderShopPanel(metaState, gameState, shop) {
  const offers = metaState.shopOffers;
  if (!offers || offers.length === 0) return '<div class="shop-empty">Loading shop...</div>';

  const rerollCost = shop.rerollCost(metaState);
  const canRerollFree = metaState.shopRerollsFree > 0;
  const canRerollPaid = (gameState.resources[metaState?.rerollCostResource ?? 'nickel'] || 0) >= rerollCost;

  return `
    <div class="shop-header">
      <span class="shop-title">OUTPOST SHOP</span>
      <button class="shop-reroll-btn ${canRerollFree || canRerollPaid ? '' : 'disabled'}"
              onclick="window.station.rerollShop()"
              ${canRerollFree || canRerollPaid ? '' : 'disabled'}>
        ${canRerollFree ? 'FREE' : `${rerollCost} ${resourcesData.resources[shop.config.rerollCostResource]?.name || 'Nickel'}`}
        REROLL
      </button>
    </div>
    <div class="shop-offers">
      ${offers.map((offer, i) => renderOfferCard(offer, i, metaState, gameState)).join('')}
    </div>
  `;
}

function renderOfferCard(offer, index, metaState, gameState) {
  if (offer.purchased) {
    return `
      <div class="offer-card purchased">
        <div class="offer-card-inner">
          <span class="offer-sold">SOLD</span>
        </div>
      </div>
    `;
  }

  const resName = resourcesData.resources[offer.price.resource]?.name || offer.price.resource;
  const canAfford = (gameState.resources[offer.price.resource] || 0) >= offer.price.amount;
  const tierColor = TIER_COLORS[offer.tier] || '#8a8a8a';

  return `
    <div class="offer-card ${offer.tier}" style="border-color: ${tierColor};">
      <div class="offer-card-inner">
        <div class="offer-tier" style="color: ${tierColor};">${TIER_LABELS[offer.tier] || offer.tier}</div>
        <div class="offer-name">${offer.name}</div>
        <div class="offer-desc">${offer.description}</div>
        <div class="offer-category">${offer.category.toUpperCase()}</div>
        <button class="offer-buy-btn ${canAfford ? '' : 'disabled'}"
                onclick="window.station.buyOffer(${index})"
                ${canAfford ? '' : 'disabled'}>
          ${formatNumber(offer.price.amount)} ${resName}
        </button>
      </div>
    </div>
  `;
}
