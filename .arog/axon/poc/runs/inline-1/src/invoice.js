const { toCents } = require('./money');
const { taxFor } = require('./tax');
const { discountFor } = require('./discount');

// items: [{ name, price (dollars), qty }]
// options: { region, code }
// Returns amounts in cents.
function buildInvoice(items, options = {}) {
  const { region = 'OR', code } = options;
  const subtotal = items.reduce((sum, item) => sum + toCents(item.price) * item.qty, 0);
  const discount = discountFor(subtotal, code);
  const tax = taxFor(subtotal - discount, region);
  const total = subtotal - discount + tax;
  return { subtotal, discount, tax, total };
}

module.exports = { buildInvoice };
