const test = require('node:test');
const assert = require('node:assert');
const { buildInvoice } = require('../src/invoice');

test('tax charged after discount, not before (fixes overcharge) + rounds instead of truncating', () => {
  const result = buildInvoice([{ name: 'book', price: 100, qty: 1 }], { region: 'TX', code: 'WELCOME5' });
  assert.deepStrictEqual(result, { subtotal: 10000, discount: 500, tax: 594, total: 9094 });
});

test('tax rounds half up on an exact half-cent boundary (fixes "one cent too low")', () => {
  const result = buildInvoice([{ name: 'item', price: 12.88, qty: 1 }], { region: 'TX' });
  assert.deepStrictEqual(result, { subtotal: 1288, discount: 0, tax: 81, total: 1369 });
});

test('new percentage discount code SAVE25 rounds half up on an exact half-cent boundary', () => {
  const result = buildInvoice([{ name: 'service', price: 40.02, qty: 1 }], { region: 'OR', code: 'SAVE25' });
  assert.deepStrictEqual(result, { subtotal: 4002, discount: 1001, tax: 0, total: 3001 });
});

test('new percentage discount code SAVE10, lower-cased, is case-insensitive', () => {
  const result = buildInvoice([{ name: 'widget', price: 20.00, qty: 1 }], { region: 'OR', code: 'save10' });
  assert.deepStrictEqual(result, { subtotal: 2000, discount: 200, tax: 0, total: 1800 });
});

test('existing fixed discount code is also case-insensitive', () => {
  const result = buildInvoice([{ name: 'book', price: 30, qty: 1 }], { region: 'OR', code: 'welcome5' });
  assert.deepStrictEqual(result, { subtotal: 3000, discount: 500, tax: 0, total: 2500 });
});

test('unknown code still throws regardless of case', () => {
  assert.throws(
    () => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'nope' }),
    /Unknown discount code/
  );
});
