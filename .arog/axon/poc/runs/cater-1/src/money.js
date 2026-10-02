// Money helpers. All internal amounts are integer cents.
function toCents(dollars) {
  return Math.round(dollars * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// Round-half-up a fractional-cents value (non-negative values only).
function roundHalfUp(value) {
  return Math.floor(value + 0.5);
}

// Apply a rate (e.g. 0.0825) to an amount in cents.
function applyRate(cents, rate) {
  return roundHalfUp(cents * rate);
}

module.exports = { toCents, fromCents, applyRate, roundHalfUp };
