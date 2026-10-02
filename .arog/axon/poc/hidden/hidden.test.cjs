// Hidden acceptance tests. Never shown to any approach. Run against each result.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const ROOT = process.env.TARGET;
const { buildInvoice } = require(path.join(ROOT, 'src/invoice'));

test('H1 tax is charged on the discounted amount', () => {
  const inv = buildInvoice([{ name: 'a', price: 100, qty: 1 }], { region: 'TX', code: 'LOYAL20' });
  assert.strictEqual(inv.discount, 2000);
  assert.strictEqual(inv.tax, 500); // 8000 * 0.0625
  assert.strictEqual(inv.total, 8500);
});
test('H2 tax rounds half up to the cent', () => {
  const inv = buildInvoice([{ name: 'a', price: 9.99, qty: 1 }], { region: 'CA' }); // 999*0.0725 = 72.4275 -> 72
  assert.strictEqual(inv.tax, 72);
  const inv2 = buildInvoice([{ name: 'b', price: 19.99, qty: 1 }], { region: 'NY' }); // 1999*0.08875 = 177.41 -> 177
  assert.strictEqual(inv2.tax, 177);
  const inv3 = buildInvoice([{ name: 'c', price: 0.98, qty: 1 }], { region: 'TX' }); // 98*0.0625 = 6.125 -> 6
  assert.strictEqual(inv3.tax, 6);
  const inv4 = buildInvoice([{ name: 'd', price: 2.2, qty: 1 }], { region: 'TX' }); // 220*0.0625 = 13.75 -> 14
  assert.strictEqual(inv4.tax, 14);
});
test('H3 SAVE10 takes 10 percent off', () => {
  const inv = buildInvoice([{ name: 'a', price: 50, qty: 2 }], { region: 'OR', code: 'SAVE10' });
  assert.strictEqual(inv.discount, 1000);
  assert.strictEqual(inv.total, 9000);
});
test('H4 SAVE25 with tax after discount', () => {
  const inv = buildInvoice([{ name: 'a', price: 40, qty: 1 }], { region: 'TX', code: 'SAVE25' });
  assert.strictEqual(inv.discount, 1000);
  assert.strictEqual(inv.tax, 188); // 3000 * 0.0625 = 187.5 -> 188
  assert.strictEqual(inv.total, 3188);
});
test('H5 codes are case-insensitive', () => {
  const a = buildInvoice([{ name: 'a', price: 50, qty: 1 }], { region: 'OR', code: 'save10' });
  const b = buildInvoice([{ name: 'a', price: 50, qty: 1 }], { region: 'OR', code: 'Welcome5' });
  assert.strictEqual(a.discount, 500);
  assert.strictEqual(b.discount, 500);
});
test('H6 percent discount rounds half up to the cent', () => {
  const inv = buildInvoice([{ name: 'a', price: 0.15, qty: 1 }], { region: 'OR', code: 'SAVE10' }); // 1.5 -> 2
  assert.strictEqual(inv.discount, 2);
});
test('H7 existing behaviour kept', () => {
  assert.throws(() => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'NOPE' }), /Unknown discount code/);
  const inv = buildInvoice([{ name: 'a', price: 3, qty: 1 }], { region: 'OR', code: 'LOYAL20' });
  assert.strictEqual(inv.discount, 300);
  assert.strictEqual(inv.total, 0);
});
