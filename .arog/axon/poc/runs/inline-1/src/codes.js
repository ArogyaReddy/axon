// Discount codes. Fixed codes take a flat amount (in cents) off the subtotal.
// Percent codes take a percentage (0-1) off the subtotal. Codes are looked
// up case-insensitively.
const CODES = {
  WELCOME5: { type: 'fixed', amount: 500 },
  LOYAL20: { type: 'fixed', amount: 2000 },
  SAVE10: { type: 'percent', rate: 0.1 },
  SAVE25: { type: 'percent', rate: 0.25 },
};

module.exports = { CODES };
