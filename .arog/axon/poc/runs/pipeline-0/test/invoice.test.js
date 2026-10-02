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
