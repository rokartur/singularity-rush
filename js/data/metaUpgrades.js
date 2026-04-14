export default {
  tiers: {
    common:    { weight: 50, priceMult: 1.0 },
    uncommon:  { weight: 30, priceMult: 1.5 },
    rare:      { weight: 15, priceMult: 2.5 },
    epic:      { weight: 4,  priceMult: 4.0 },
    legendary: { weight: 1,  priceMult: 8.0 }
  },
  shopSize: 5,
  freeRerollsPerDay: 1,
  rerollCostResource: 'nickel',
  rerollCostBase: 30,
  rerollCostScale: 1.4
};
