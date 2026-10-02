const test = require('node:test');
const assert = require('node:assert');
const { buildInvoice } = require('../src/invoice');

test('no tax region, no code', () => {
  const inv = buildInvoice([{ name: 'pen', price: 2.5, qty: 4 }], { region: 'OR' });
  assert.deepStrictEqual(inv, { subtotal: 1000, discount: 0, tax: 0, total: 1000 });
});

test('fixed code in a no-tax region', () => {
  const inv = buildInvoice([{ name: 'book', price: 30, qty: 1 }], { region: 'OR', code: 'WELCOME5' });
  assert.strictEqual(inv.total, 2500);
});

test('unknown code throws', () => {
  assert.throws(() => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'NOPE' }), /Unknown discount code/);
});

test('tax is charged on the subtotal after a fixed discount, not before', () => {
  const inv = buildInvoice([{ name: 'widget', price: 100, qty: 1 }], { region: 'CA', code: 'WELCOME5' });
  // subtotal 10000, discount 500 -> taxable 9500 * 0.0725 = 688.75 -> rounds to 689
  assert.strictEqual(inv.subtotal, 10000);
  assert.strictEqual(inv.discount, 500);
  assert.strictEqual(inv.tax, 689);
  assert.strictEqual(inv.total, 10000 - 500 + 689);
});

test('tax rounds half up instead of truncating down', () => {
  const inv = buildInvoice([{ name: 'widget', price: 1, qty: 1 }], { region: 'NY' });
  // subtotal 100 * 0.08875 = 8.875 -> floor would give 8 (wrong), half-up gives 9
  assert.strictEqual(inv.tax, 9);
});

test('SAVE10 gives 10% off, case-insensitively, with half-up rounding', () => {
  const inv = buildInvoice([{ name: 'widget', price: 1.25, qty: 1 }], { region: 'OR', code: 'save10' });
  // subtotal 125 * 0.10 = 12.5 -> rounds to 13
  assert.strictEqual(inv.subtotal, 125);
  assert.strictEqual(inv.discount, 13);
  assert.strictEqual(inv.total, 125 - 13);
});

test('SAVE25 gives 25% off, case-insensitively', () => {
  const inv = buildInvoice([{ name: 'widget', price: 10, qty: 1 }], { region: 'OR', code: 'Save25' });
  // subtotal 1000 * 0.25 = 250
  assert.strictEqual(inv.subtotal, 1000);
  assert.strictEqual(inv.discount, 250);
  assert.strictEqual(inv.total, 750);
});

test('fixed codes remain case-insensitive and unknown code still throws', () => {
  const inv = buildInvoice([{ name: 'book', price: 30, qty: 1 }], { region: 'OR', code: 'welcome5' });
  assert.strictEqual(inv.discount, 500);
  assert.throws(() => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'nope' }), /Unknown discount code/);
});
