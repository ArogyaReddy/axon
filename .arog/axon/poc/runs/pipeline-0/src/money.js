// Money helpers. All internal amounts are integer cents.
function toCents(dollars) {
  return Math.round(dollars * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// Apply a rate (e.g. 0.0825) to an amount in cents.
function applyRate(cents, rate) {
  return Math.floor(cents * rate + 0.5);
}

module.exports = { toCents, fromCents, applyRate };
