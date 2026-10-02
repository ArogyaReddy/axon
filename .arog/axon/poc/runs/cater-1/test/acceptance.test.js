const test = require('node:test');
const assert = require('node:assert');
const { buildInvoice } = require('../src/invoice');

// T1 — Fixed discount + tax must apply tax AFTER discount (regression test for Bug 1)
test('T1: WELCOME5 fixed discount in NY computes tax on post-discount subtotal', () => {
  const inv = buildInvoice([{ name: 'widget', price: 100.00, qty: 1 }], { region: 'NY', code: 'WELCOME5' });
  assert.deepStrictEqual(inv, { subtotal: 10000, discount: 500, tax: 843, total: 10343 });
});

// T2 — Round-half-up exact tie, no discount (regression test for Bug 2)
test('T2: CA tax exact .5 tie rounds half up, not down', () => {
  const inv = buildInvoice([{ name: 'gadget', price: 10.00, qty: 1 }], { region: 'CA' });
  assert.deepStrictEqual(inv, { subtotal: 1000, discount: 0, tax: 73, total: 1073 });
});

// T3 — SAVE10 percentage discount, case-insensitive lowercase input, with tax (compounding rounding)
test('T3: SAVE10 (lowercase "save10") percentage discount with compounding rounding', () => {
  const inv = buildInvoice([{ name: 'item', price: 10.05, qty: 1 }], { region: 'CA', code: 'save10' });
  assert.deepStrictEqual(inv, { subtotal: 1005, discount: 101, tax: 66, total: 970 });
});

test('T3b: SAVE10 is case-insensitive — "SAVE10" matches "save10" result', () => {
  const upper = buildInvoice([{ name: 'item', price: 10.05, qty: 1 }], { region: 'CA', code: 'SAVE10' });
  assert.deepStrictEqual(upper, { subtotal: 1005, discount: 101, tax: 66, total: 970 });
});

test('T3c: SAVE10 is case-insensitive — "Save10" matches "save10" result', () => {
  const mixed = buildInvoice([{ name: 'item', price: 10.05, qty: 1 }], { region: 'CA', code: 'Save10' });
  assert.deepStrictEqual(mixed, { subtotal: 1005, discount: 101, tax: 66, total: 970 });
});

// T4 — SAVE25 percentage discount, mixed-case input, no-tax region
test('T4: SaVe25 mixed-case percentage discount in no-tax OR region', () => {
  const inv = buildInvoice(
    [{ name: 'a', price: 10.00, qty: 1 }, { name: 'b', price: 10.00, qty: 1 }],
    { region: 'OR', code: 'SaVe25' }
  );
  assert.deepStrictEqual(inv, { subtotal: 2000, discount: 500, tax: 0, total: 1500 });
});

// T5 — Existing fixed code still works unchanged, now also case-insensitively (LOYAL20)
test('T5: lowercase "loyal20" fixed discount still works (case-insensitive) in no-tax region', () => {
  const inv = buildInvoice([{ name: 'bulk', price: 50.00, qty: 1 }], { region: 'OR', code: 'loyal20' });
  assert.deepStrictEqual(inv, { subtotal: 5000, discount: 2000, tax: 0, total: 3000 });
});

test('T5b: existing uppercase WELCOME5 fixed code in no-tax region remains unaffected', () => {
  const inv = buildInvoice([{ name: 'book', price: 30, qty: 1 }], { region: 'OR', code: 'WELCOME5' });
  assert.deepStrictEqual(inv, { subtotal: 3000, discount: 500, tax: 0, total: 2500 });
});

// T6 — Unknown code still throws with expected message
test('T6: unknown code "NOPE" still throws Unknown discount code', () => {
  assert.throws(() => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'NOPE' }), /Unknown discount code/);
});

test('T6b: unknown lowercase code "nope" still throws Unknown discount code', () => {
  assert.throws(() => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'nope' }), /Unknown discount code/);
});

test('T6c: "save99" (not a real code) still throws Unknown discount code, not matched by uppercasing', () => {
  assert.throws(() => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'save99' }), /Unknown discount code/);
});

// T7 — Fixed discount larger than subtotal still clamps (no negative taxable amount)
test('T7: LOYAL20 fixed discount exceeding subtotal clamps to subtotal, taxable amount never negative', () => {
  const inv = buildInvoice([{ name: 'cheap', price: 5.00, qty: 1 }], { region: 'NY', code: 'LOYAL20' });
  assert.deepStrictEqual(inv, { subtotal: 500, discount: 500, tax: 0, total: 0 });
});
