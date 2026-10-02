// Discount codes. Fixed codes take a flat amount (in cents) off the subtotal.
const CODES = {
  WELCOME5: { type: 'fixed', amount: 500 },
  LOYAL20: { type: 'fixed', amount: 2000 },
  SAVE10: { type: 'percent', rate: 0.10 },
  SAVE25: { type: 'percent', rate: 0.25 },
};

module.exports = { CODES };
