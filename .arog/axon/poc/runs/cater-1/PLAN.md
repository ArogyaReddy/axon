# PLAN.md — Invoice Tax/Discount Bug Fix + SAVE10/SAVE25 Feature

## 1. Root Cause Summary

### Bug 1: Tax computed on pre-discount subtotal (overcharge when a discount code is used)

File: `src/invoice.js`, function `buildInvoice`.

```js
const subtotal = items.reduce((sum, item) => sum + toCents(item.price) * item.qty, 0);
const discount = discountFor(subtotal, code);
const tax = taxFor(subtotal, region);          // <-- BUG: uses `subtotal`, not `subtotal - discount`
const total = subtotal - discount + tax;
```

`taxFor` is called with the raw `subtotal` instead of the discounted subtotal
(`subtotal - discount`). Whenever a discount code is applied, tax is computed
on a larger base than it should be, so the customer is overcharged tax. The
`total` line correctly subtracts `discount` before adding `tax`, but `tax`
itself was computed on the wrong base — the two lines are inconsistent with
each other.

### Bug 2: Rounding uses `Math.floor` (truncation), not round-half-up

File: `src/money.js`, function `applyRate`.

```js
function applyRate(cents, rate) {
  return Math.floor(cents * rate);
}
```

`applyRate` is used both for tax (`src/tax.js: taxFor`) and will be used for
percentage discounts (new feature). `Math.floor` always truncates toward
zero/down, so any fractional-cent result (e.g. `1000 * 0.0725 = 72.5`) is
truncated to `72` instead of being rounded to the nearest cent with ties
rounding up (`73`). This is why "some tax amounts are one cent too low" —
it's not banker's rounding, it's straight truncation, which is biased low
100% of the time there's a nonzero remainder (not just at `.5` ties).

There is currently no round-half-up helper anywhere in the codebase
(`src/money.js` only has `toCents`, `fromCents`, `applyRate`).

### Bug context: discount lookup is case-sensitive and has no percentage type

File: `src/discount.js`.

```js
function lookup(code) {
  const entry = CODES[code];                    // case-sensitive key lookup
  if (!entry) throw new Error(`Unknown discount code: ${code}`);
  return entry;
}

function discountFor(subtotalCents, code) {
  if (!code) return 0;
  const entry = lookup(code);
  if (entry.type === 'fixed') return Math.min(entry.amount, subtotalCents);
  throw new Error(`Unsupported code type: ${entry.type}`);  // no 'percent' handling yet
}
```

This isn't a bug per se yet (no percent codes exist), but it blocks the
SAVE10/SAVE25 feature, and the lookup must be made case-insensitive per the
feature request.

Note: the task description says the thrown error message must be exactly
`"Unknown discount code"`. Current code throws
`` `Unknown discount code: ${code}` ``. The existing test
(`test/invoice.test.js`, "unknown code throws") checks
`assert.throws(..., /Unknown discount code/)`, a substring/regex match, so
keeping the `: ${code}` suffix is compatible with both the existing test and
the feature request's wording (the message *starts with* "Unknown discount
code"). No change to the message format is required, just confirm it is
preserved during refactor.

## 2. Files/Functions To Change

1. **`src/money.js`**
   - Add a new exported helper `roundHalfUp(cents)` (or `roundCents`) that
     implements round-half-up on a fractional-cents float, e.g.:
     `Math.floor(value + 0.5)` for non-negative values (all amounts here are
     non-negative, so this is safe; no need to handle negative-number
     half-up semantics).
   - Change `applyRate(cents, rate)` to use the new helper instead of
     `Math.floor(cents * rate)` directly:
     `return roundHalfUp(cents * rate);`
   - Export `roundHalfUp` alongside `toCents`, `fromCents`, `applyRate`.

2. **`src/invoice.js`**
   - Change `buildInvoice` so tax is computed on the post-discount subtotal:
     ```js
     const subtotal = items.reduce((sum, item) => sum + toCents(item.price) * item.qty, 0);
     const discount = discountFor(subtotal, code);
     const taxableAmount = subtotal - discount;
     const tax = taxFor(taxableAmount, region);
     const total = taxableAmount + tax;
     ```
   - This fixes ordering (discount applied before tax) and removes the
     duplicate/inconsistent subtraction in the `total` line.

3. **`src/discount.js`**
   - Make `lookup(code)` case-insensitive: normalize the incoming code
     (e.g. `code.toUpperCase()`) before indexing into `CODES`, since all
     existing `CODES` keys (`WELCOME5`, `LOYAL20`) and the new ones
     (`SAVE10`, `SAVE25`) are uppercase.
   - Add handling for `entry.type === 'percent'` in `discountFor`:
     ```js
     if (entry.type === 'percent') {
       return Math.min(applyRate(subtotalCents, entry.rate), subtotalCents);
     }
     ```
     (import `applyRate` from `./money`). `applyRate` now round-half-up's
     the result, satisfying the "percentage-based discount amounts must
     round half up" requirement. The `Math.min(..., subtotalCents)` guard
     preserves the "never more than the subtotal" invariant, protecting
     against a pathological `>100%` rate.
   - Preserve the thrown error for unknown codes (message starting with
     `"Unknown discount code"`), only changing the lookup key to be
     case-normalized, not the error text/behavior for missing codes.

4. **`src/codes.js`**
   - Add two new entries using a `percent` type with a `rate` field
     consistent with `src/tax.js`'s rate convention (fraction 0–1):
     ```js
     SAVE10: { type: 'percent', rate: 0.10 },
     SAVE25: { type: 'percent', rate: 0.25 },
     ```
   - Keep existing `WELCOME5` / `LOYAL20` fixed entries unchanged (keys
     remain uppercase; case-insensitivity is handled in `discount.js`'s
     lookup normalization, not by duplicating keys here).

## 3. Plan: Tax-After-Discount Ordering

- Compute `subtotal` (unchanged).
- Compute `discount = discountFor(subtotal, code)` (discount is still based
  on the *original* subtotal — this is correct and typical: discount codes
  apply to the sticker subtotal, not to a tax-inclusive amount).
- Compute `taxableAmount = subtotal - discount`.
- Compute `tax = taxFor(taxableAmount, region)` — tax now calculated on the
  discounted amount.
- Compute `total = taxableAmount + tax` (equivalent to
  `subtotal - discount + tax`, but now `tax` itself is correct because it
  was derived from `taxableAmount`).
- No change needed to `taxFor`/`taxRate` signatures — they already accept a
  cents amount and region; only the caller-side base amount changes.

## 4. Plan: Round-Half-Up Helper

- New helper in `src/money.js`:
  ```js
  function roundHalfUp(value) {
    return Math.floor(value + 0.5);
  }
  ```
  - All values passed to this helper in this codebase are non-negative
    (cents amounts times non-negative rates), so the simple
    `Math.floor(value + 0.5)` form is sufficient and avoids
    negative-number half-up edge cases entirely. No need for a sign-aware
    implementation given current usage.
- Apply it inside `applyRate(cents, rate)`, replacing `Math.floor(cents * rate)`:
  ```js
  function applyRate(cents, rate) {
    return roundHalfUp(cents * rate);
  }
  ```
  Since both `taxFor` (tax) and the new percent-discount branch in
  `discountFor` route through `applyRate`, this single change fixes
  rounding for both tax amounts and percentage-based discount amounts, per
  the requirement.
- Export `roundHalfUp` from `src/money.js` in case `discount.js` or tests
  need it directly (optional, but keeps it available/testable in
  isolation).

## 5. Plan: SAVE10 / SAVE25 + Case-Insensitive Lookup

- `src/codes.js`: add `SAVE10` (`{ type: 'percent', rate: 0.10 }`) and
  `SAVE25` (`{ type: 'percent', rate: 0.25 }`) to `CODES`.
- `src/discount.js`:
  - `lookup(code)`: look up `CODES[code.toUpperCase()]` instead of
    `CODES[code]`.
  - `discountFor`: add a `percent` branch (see section 2, item 3) that
    computes `applyRate(subtotalCents, entry.rate)` and clamps to
    `subtotalCents` via `Math.min`.
  - Fixed-type branch (`entry.type === 'fixed'`) stays exactly as-is
    (`Math.min(entry.amount, subtotalCents)`), so existing `WELCOME5` /
    `LOYAL20` behavior is unchanged other than now also being matched
    case-insensitively (e.g. `"welcome5"` now also works — this is a
    superset of prior behavior, not a breaking change).
  - Unknown codes (after uppercasing) still fall through to
    `if (!entry) throw new Error('Unknown discount code: ' + code)` —
    message still starts with `"Unknown discount code"`.

## 6. Edge Cases To Consider

- **Case-insensitivity for existing fixed codes**: `"welcome5"`,
  `"Welcome5"`, `"WELCOME5"` must all resolve to the same fixed $5.00
  discount. Verify `discountFor` output is identical (500 cents) regardless
  of input casing.
- **Case-insensitivity for new percent codes**: `"save10"`, `"Save10"`,
  `"SAVE10"` must all resolve to a 10% discount; same for SAVE25.
- **Unknown code error message**: must still throw and the message must
  still start with (or equal, depending on strictness of final
  requirement) `"Unknown discount code"`. Confirm existing test regex
  `/Unknown discount code/` still passes, and that casing normalization
  does not swallow genuinely-unknown codes (e.g. `"save99"` must still
  throw, not silently match).
- **No code provided**: `discountFor(subtotalCents, undefined)` must still
  return `0` without attempting `.toUpperCase()` on `undefined` — the
  existing `if (!code) return 0;` guard in `discountFor` must remain before
  any case-normalization/lookup call.
- **Percentage discount larger than subtotal is impossible by construction**
  for SAVE10/SAVE25 (max 25% < 100%), but the `Math.min(amount, subtotal)`
  clamp should still be applied defensively/consistently with the fixed-code
  path, and to guard against any future high-percentage or misconfigured
  code.
- **Discount reduces taxable amount to zero or near-zero**: if a fixed
  discount (e.g. LOYAL20 = $20.00) exceeds the subtotal, `taxableAmount`
  must not go negative — `discountFor` already clamps fixed discounts via
  `Math.min(entry.amount, subtotalCents)`, so `subtotal - discount >= 0`
  always holds; confirm this invariant continues to hold after the percent
  branch is added (it does, since percent-of-subtotal with rate <= 1 can
  never exceed subtotal, and the `Math.min` clamp is a defensive backstop).
- **Compounding rounding at two stages**: when both a percentage discount
  and tax apply, rounding happens twice (once in the discount calc, once in
  the tax calc on the already-rounded post-discount integer-cent subtotal).
  Because `taxableAmount` is always re-derived as an integer number of cents
  (`subtotal - discount`, both integers), this is fine — there's no
  fractional-cent carry-through bug, but tests should explicitly cover a
  case where the percent discount itself has a `.5`-cent tie (e.g. subtotal
  = 1005 cents, SAVE10 -> 100.5 -> rounds up to 101) *and* the resulting
  taxable amount then has tax applied, to confirm no double-counting or
  compounding error.
- **Exact `.5` tie rounding direction**: must round up (toward larger cent
  value), not to even (banker's rounding) and not down (truncation). Needs
  an explicit test where the fractional part is exactly `0.5`.
- **OR region (0% tax) with a discount**: ensures tax-after-discount change
  doesn't break the zero-tax path (tax should remain 0 regardless of
  discount).
- **`total` invariant**: `total === subtotal - discount + tax` must hold
  for all cases, with `tax` now computed on `subtotal - discount` rather
  than `subtotal`.

## 7. Concrete Test Cases (inputs -> expected cent values)

All values in cents unless noted; `buildInvoice(items, options)` returns
`{ subtotal, discount, tax, total }` in cents.

### T1 — Fixed discount + tax must apply tax AFTER discount (regression test for Bug 1)
- Input: `items = [{ name: 'widget', price: 100.00, qty: 1 }]`,
  `options = { region: 'NY', code: 'WELCOME5' }`
- subtotal = 10000
- discount = 500 (fixed WELCOME5)
- taxable amount = 10000 - 500 = 9500
- NY rate = 0.08875 -> 9500 * 0.08875 = 843.125 -> round half up -> **tax = 843**
- total = 9500 + 843 = **9843**
- Expected: `{ subtotal: 10000, discount: 500, tax: 843, total: 9843 }`
- (Contrast with current buggy behavior: tax computed on 10000 ->
  10000*0.08875=887.5 -> floor -> 887; buggy total = 10000-500+887 = 10387.
  The fix must produce 9843, not 10387 and not 9887.)

### T2 — Round-half-up exact tie, no discount (regression test for Bug 2)
- Input: `items = [{ name: 'gadget', price: 10.00, qty: 1 }]`,
  `options = { region: 'CA' }` (no code)
- subtotal = 1000
- discount = 0
- CA rate = 0.0725 -> 1000 * 0.0725 = 72.5 exactly -> round half up -> **tax = 73**
- total = 1000 + 73 = **1073**
- Expected: `{ subtotal: 1000, discount: 0, tax: 73, total: 1073 }`
- (Current buggy `Math.floor` would yield tax = 72, total = 1072 — this test
  pins the round-half-up requirement precisely at a `.5` boundary.)

### T3 — SAVE10 percentage discount, case-insensitive lowercase input, with tax (compounding rounding)
- Input: `items = [{ name: 'item', price: 10.05, qty: 1 }]`,
  `options = { region: 'CA', code: 'save10' }` (lowercase)
- subtotal = 1005
- SAVE10 rate 0.10 -> 1005 * 0.10 = 100.5 exactly -> round half up -> **discount = 101**
- taxable amount = 1005 - 101 = 904
- CA rate 0.0725 -> 904 * 0.0725 = 65.54 -> round half up -> **tax = 66**
- total = 904 + 66 = **970**
- Expected: `{ subtotal: 1005, discount: 101, tax: 66, total: 970 }`
- Also assert this result is identical when `code: 'SAVE10'` or
  `code: 'Save10'` is used instead, proving case-insensitivity.

### T4 — SAVE25 percentage discount, mixed-case input, no-tax region
- Input: `items = [{ name: 'a', price: 10.00, qty: 1 }, { name: 'b', price: 10.00, qty: 1 }]`,
  `options = { region: 'OR', code: 'SaVe25' }`
- subtotal = 2000
- SAVE25 rate 0.25 -> 2000 * 0.25 = 500 exactly -> **discount = 500**
- taxable amount = 2000 - 500 = 1500
- OR rate = 0 -> **tax = 0**
- total = 1500 + 0 = **1500**
- Expected: `{ subtotal: 2000, discount: 500, tax: 0, total: 1500 }`

### T5 — Existing fixed code still works unchanged, now also case-insensitively (LOYAL20)
- Input: `items = [{ name: 'bulk', price: 50.00, qty: 1 }]`,
  `options = { region: 'OR', code: 'loyal20' }` (lowercase form of existing code)
- subtotal = 5000
- LOYAL20 fixed amount = 2000 -> **discount = 2000**
- taxable amount = 5000 - 2000 = 3000
- OR rate = 0 -> **tax = 0**
- total = 3000
- Expected: `{ subtotal: 5000, discount: 2000, tax: 0, total: 3000 }`
- This also implicitly covers "existing fixed-amount discount codes must
  continue to work exactly as before" by comparing against the current
  passing test `fixed code in a no-tax region` (WELCOME5, uppercase),
  which must remain unaffected: subtotal 3000, discount 500, tax 0,
  total 2500.

### T6 — Unknown code still throws with expected message
- Input: `buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'NOPE' })`
- Expected: throws an `Error` whose message matches `/Unknown discount code/`
  (existing test in `test/invoice.test.js` already covers this; confirm it
  still passes unmodified after adding case-insensitive uppercasing, and
  optionally add `{ code: 'nope' }` / `{ code: 'save99' }` as additional
  unknown-code variants to confirm uppercasing doesn't cause false
  positives).

### T7 — Fixed discount larger than subtotal still clamps (no negative taxable amount)
- Input: `items = [{ name: 'cheap', price: 5.00, qty: 1 }]`,
  `options = { region: 'NY', code: 'LOYAL20' }`
- subtotal = 500
- LOYAL20 fixed amount = 2000, clamped by `Math.min(2000, 500)` -> **discount = 500**
- taxable amount = 500 - 500 = 0
- NY rate -> 0 * 0.08875 = 0 -> **tax = 0**
- total = **0**
- Expected: `{ subtotal: 500, discount: 500, tax: 0, total: 0 }`
- Confirms discount-exceeds-subtotal edge case produces zero tax, not
  negative tax or a negative taxable base.

## 8. Out of Scope / Not Changed

- `src/tax.js` (`taxFor`, `taxRate`, `RATES`) requires no logic changes —
  it already delegates rounding to `applyRate`, which is being fixed
  centrally in `src/money.js`. Only its caller (`src/invoice.js`) changes
  what amount it's invoked with.
- `toCents` / `fromCents` in `src/money.js` are unrelated to this bug (they
  convert dollars<->cents, not apply rates) and need no change.
