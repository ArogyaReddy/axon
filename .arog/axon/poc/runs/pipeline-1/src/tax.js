const { applyRate } = require('./money');

const RATES = {
  CA: 0.0725,
  TX: 0.0625,
  NY: 0.08875,
  OR: 0,
};

function taxRate(region) {
  if (!(region in RATES)) throw new Error(`Unknown region: ${region}`);
  return RATES[region];
}

function taxFor(cents, region) {
  return applyRate(cents, taxRate(region));
}

module.exports = { taxFor, taxRate, RATES };
