const { CODES } = require('./codes');
const { applyRate } = require('./money');

function lookup(code) {
  const entry = CODES[code.toUpperCase()];
  if (!entry) throw new Error(`Unknown discount code: ${code}`);
  return entry;
}

// Returns the discount in cents for a subtotal in cents. Never more than the subtotal.
function discountFor(subtotalCents, code) {
  if (!code) return 0;
  const entry = lookup(code);
  if (entry.type === 'fixed') return Math.min(entry.amount, subtotalCents);
  if (entry.type === 'percent') return Math.min(applyRate(subtotalCents, entry.rate), subtotalCents);
  throw new Error(`Unsupported code type: ${entry.type}`);
}

module.exports = { discountFor };
