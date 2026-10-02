const test = require('node:test');
const assert = require('node:assert');
const { buildInvoice } = require('../src/invoice');

test("tax rounds half up instead of truncating (regression for 'one cent too low')", () => {
  const invoice = buildInvoice([{ name: 'item', price: 2.00, qty: 1 }], { region: 'TX' });
  // 200 * 0.0625 = 12.5 -> rounds up to 13, not floored to 12
  assert.deepStrictEqual(invoice, { subtotal: 200, discount: 0, tax: 13, total: 213 });
});

test("fixed discount applied before tax (regression for 'overcharged on tax')", () => {
  const invoice = buildInvoice([{ name: 'widget', price: 100.00, qty: 1 }], { region: 'CA', code: 'WELCOME5' });
  // tax computed on 9500 (10000-500): 9500*0.0725=688.75 -> rounds to 689
  assert.deepStrictEqual(invoice, { subtotal: 10000, discount: 500, tax: 689, total: 10189 });
});

test("percentage discount SAVE10 reduces taxable base, with half-up rounding on tax", () => {
  const invoice = buildInvoice([{ name: 'widget', price: 100.00, qty: 1 }], { region: 'CA', code: 'SAVE10' });
  // discount = 10000*0.10 = 1000; tax on 9000: 9000*0.0725=652.5 -> rounds to 653
  assert.deepStrictEqual(invoice, { subtotal: 10000, discount: 1000, tax: 653, total: 9653 });
});

test("percentage discount SAVE25 is case-insensitive (lowercase code), no tax region", () => {
  const invoice = buildInvoice([{ name: 'gadget', price: 50.00, qty: 1 }], { region: 'OR', code: 'save25' });
  // 'save25' matches SAVE25 case-insensitively: 5000*0.25=1250
  assert.deepStrictEqual(invoice, { subtotal: 5000, discount: 1250, tax: 0, total: 3750 });
});

test("fixed discount code is also case-insensitive (lowercase code)", () => {
  const invoice = buildInvoice([{ name: 'book', price: 30.00, qty: 1 }], { region: 'OR', code: 'welcome5' });
  assert.deepStrictEqual(invoice, { subtotal: 3000, discount: 500, tax: 0, total: 2500 });
});

test("unknown discount code still throws (existing behavior preserved)", () => {
  assert.throws(
    () => buildInvoice([{ name: 'x', price: 1, qty: 1 }], { code: 'NOPE' }),
    /Unknown discount code/
  );
});
