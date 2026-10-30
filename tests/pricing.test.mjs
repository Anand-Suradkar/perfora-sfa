import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billingDiscountPercent,
  calculateOrderPricing,
  round2,
} from '../app/lib/pricing.mjs';

const skuData = [
  { id: 'PER2831', sku: 'PER2831', name: 'Purple Magic Whitening Toothpaste 75gm', mrp: 199, gst: 18, category: 'Toothpaste' },
  { id: 'PER1502', sku: 'PER1502', name: 'Purple Magic Whitening Toothpaste 125gm', mrp: 299, gst: 18, category: 'Toothpaste' },
  { id: 'GST18DEC', sku: 'GST18DEC', name: 'Decimal GST fixture', mrp: 100, gst: 0.18, category: 'Test' },
];

test('market scheme conversion matches Apps Script values', () => {
  assert.equal(billingDiscountPercent(0), 0);
  assert.equal(billingDiscountPercent(5), 6.66);
  assert.equal(billingDiscountPercent(10), 13.33);
});

test('market scheme must be a whole number within the configured limit', () => {
  assert.throws(() => billingDiscountPercent(1.5), /whole number/);
  assert.throws(() => billingDiscountPercent(11), /whole number/);
});

test('single SKU pricing rounds each amount to two decimals', () => {
  const result = calculateOrderPricing([{ sku: 'PER2831', qty: 3 }], skuData, 5);
  const line = result.lineBySku.PER2831;

  assert.equal(line.fixedRateExGst, 126.48);
  assert.equal(line.invoiceBaseExGst, 379.44);
  assert.equal(line.billingDiscountPercent, 6.66);
  assert.equal(line.schemeDiscountExGst, 25.27);
  assert.equal(line.taxableExGst, 354.17);
  assert.equal(line.tax, 63.75);
  assert.equal(line.net, 417.92);
  assert.equal(line.claim, 29.82);
  assert.equal(result.totals.mrpTotal, 597);
  assert.equal(result.totals.invoiceTotal, 417.92);
  assert.equal(result.totals.schemeBenefit, 29.82);
});

test('multiple SKU lines reconcile the ex-GST discount to the rounded order base', () => {
  const cart = [
    { sku: 'PER2831', qty: 3 },
    { sku: 'PER1502', qty: 2 },
  ];
  const result = calculateOrderPricing(cart, skuData, 5);
  const expectedOrderDiscount = round2(result.totals.baseExGst * result.totals.billingPct / 100);
  const sumOfLineDiscounts = round2(result.lines.reduce((sum, line) => sum + line.schemeDiscountExGst, 0));

  assert.equal(sumOfLineDiscounts, expectedOrderDiscount);
  assert.equal(result.lines.length, 2);
  assert.equal(result.totals.qty, 5);
  assert.equal(result.totals.mrpTotal, 1195);
  assert.ok(result.lines.every(line => Number.isFinite(line.net) && Number.isFinite(line.claim)));
});

test('decimal GST fractions normalize to percent, matching Apps Script master handling', () => {
  const result = calculateOrderPricing([{ sku: 'GST18DEC', qty: 1 }], skuData, 0);
  assert.equal(result.lineBySku.GST18DEC.gstPercent, 18);
});

test('invalid SKU and zero quantity are rejected', () => {
  assert.throws(() => calculateOrderPricing([{ sku: 'NO-SUCH-SKU', qty: 1 }], skuData, 0), /SKU is not active or missing/);
  assert.throws(() => calculateOrderPricing([{ sku: 'PER2831', qty: 0 }], skuData, 0), /Quantity must be at least 1/);
});
