// Money helpers. All internal amounts are integer cents.
function toCents(dollars) {
  return Math.round(dollars * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// Rounds a fractional cent amount half up to the nearest whole cent.
// A small epsilon guards against floating-point results that land just
// under an exact .5 boundary (e.g. 100 * 0.08875 === 8.875 but some
// rate/amount combos come out as 8.499999999999998).
function roundHalfUp(value) {
  return Math.floor(value + 0.5 + 1e-9);
}

// Apply a rate (e.g. 0.0825) to an amount in cents.
function applyRate(cents, rate) {
  return roundHalfUp(cents * rate);
}

module.exports = { toCents, fromCents, applyRate, roundHalfUp };
