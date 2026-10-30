/**
 * Perfora SFA pricing parity engine.
 * Mirrors Apps Script Code.gs v4.3.5 billingDiscountPct_(), buildLines_(), calc_(),
 * finalizeLineAmounts_(), and sumLines_().
 *
 * Keep all money rounding here so the catalogue, cart, order record and claims use
 * the same rules. This is still client-side calculation; authoritative server-side
 * validation must be added before production use.
 */

export const DEFAULT_FIXED_MARGIN_PERCENT = 25;
export const DEFAULT_MAX_MARKET_SCHEME_PERCENT = 10;

export const round2 = (value) =>
  Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100;

export function normalizeGstPercent(value) {
  let gst = Number(value) || 0;
  if (gst > 0 && gst <= 1) gst *= 100;
  return gst;
}

export function billingDiscountPercent(
  marketSchemePercent,
  fixedMarginPercent = DEFAULT_FIXED_MARGIN_PERCENT,
  maxMarketSchemePercent = DEFAULT_MAX_MARKET_SCHEME_PERCENT,
) {
  const fixed = Number(fixedMarginPercent);
  const market = Number(marketSchemePercent);
  const max = Number(maxMarketSchemePercent);
  const denominator = 100 - fixed;

  if (!Number.isFinite(fixed) || fixed < 0 || fixed >= 100) {
    throw new Error("Fixed retailer margin must be between 0% and less than 100%.");
  }
  if (!(denominator > 0)) {
    throw new Error("Fixed retailer margin must be below 100%.");
  }
  if (!Number.isInteger(market) || market < 0 || market > max) {
    throw new Error(`Market scheme must be a whole number from 0% to ${max}%.`);
  }
  if (market === 0) return 0;

  // Apps Script deliberately truncates the displayed/applied discount to 2 decimals.
  return Math.floor((market * 100 / denominator) * 100 + 1e-8) / 100;
}

function getSkuId(sku) {
  return String(sku?.sku ?? sku?.id ?? "").trim();
}

function finalizeLine(line) {
  line.taxableExGst = round2(line.invoiceBaseExGst - line.schemeDiscountExGst);
  line.tax = round2(line.taxableExGst * line.gstPercent / 100);
  line.net = round2(line.taxableExGst + line.tax);
  line.claim = round2(line.schemeDiscountExGst * (1 + line.gstPercent / 100));
  line.claimExGst = line.schemeDiscountExGst;

  // Compatibility aliases used by the existing cart UI.
  line.baseExGst = line.invoiceBaseExGst;
  line.mrpTotal = line.mrpValueInclGst;
  line.billingPct = line.billingDiscountPercent;
  return line;
}

/**
 * Calculate the complete cart at once. Calculating the whole order is important:
 * Apps Script allocates any sub-cent rounding remainder to the largest SKU line
 * within each market-scheme group so the SKU claims reconcile to the order total.
 */
export function calculateOrderPricing(
  cart,
  skuList,
  marketSchemePercent,
  fixedMarginPercent = DEFAULT_FIXED_MARGIN_PERCENT,
  maxMarketSchemePercent = DEFAULT_MAX_MARKET_SCHEME_PERCENT,
) {
  const marketPct = Number(marketSchemePercent ?? 0);
  const billingPct = billingDiscountPercent(marketPct, fixedMarginPercent, maxMarketSchemePercent);
  const skuById = new Map((Array.isArray(skuList) ? skuList : []).map((sku) => [getSkuId(sku), sku]));
  const merged = new Map();

  for (const cartItem of Array.isArray(cart) ? cart : []) {
    const skuId = String(cartItem?.sku ?? cartItem?.skuId ?? "").trim();
    const sku = skuById.get(skuId);
    if (!sku) throw new Error(`SKU is not active or missing from the master: ${skuId || "(blank)"}.`);

    const qty = Math.floor(Number(cartItem?.qty));
    if (!(qty >= 1)) throw new Error(`Quantity must be at least 1 for ${sku.name || skuId}.`);

    const mrp = Number(sku.mrp) || 0;
    if (!(mrp > 0)) throw new Error(`MRP must be greater than zero for ${sku.name || skuId}.`);

    const key = `${skuId}|${marketPct}`;
    const current = merged.get(key);
    if (current) current.qty += qty;
    else merged.set(key, { sku, skuId, qty, marketPct });
  }

  const lines = Array.from(merged.values()).map(({ sku, skuId, qty, marketPct: pct }) => {
    const mrpEach = Number(sku.mrp) || 0;
    const gst = normalizeGstPercent(sku.gst);
    const mrpValueInclGst = round2(qty * mrpEach);
    const fixedMarginValueInclGst = round2(mrpValueInclGst * Number(fixedMarginPercent) / 100);
    const fixedRateExGst = round2((mrpEach * (100 - Number(fixedMarginPercent)) / 100) / (1 + gst / 100));
    const invoiceBaseExGst = round2(fixedRateExGst * qty);
    const pctForLine = billingDiscountPercent(pct, fixedMarginPercent, maxMarketSchemePercent);
    const schemeDiscountExGst = round2(invoiceBaseExGst * pctForLine / 100);

    return {
      skuId,
      sku,
      qty,
      marketSchemePercent: pct,
      mrpEach,
      gstPercent: gst,
      mrpValueInclGst,
      fixedMarginValueInclGst,
      fixedRateExGst,
      invoiceBaseExGst,
      billingDiscountPercent: pctForLine,
      schemeDiscountExGst,
      taxableExGst: 0,
      tax: 0,
      net: 0,
      claim: 0,
      claimExGst: 0,
    };
  });

  // Same allocation/reconciliation algorithm as Apps Script buildLines_().
  const groups = new Map();
  for (const line of lines) {
    const key = String(line.marketSchemePercent);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }

  for (const [schemeKey, group] of groups) {
    const schemePct = Number(schemeKey);
    const groupBillingPct = billingDiscountPercent(schemePct, fixedMarginPercent, maxMarketSchemePercent);
    const baseTotal = round2(group.reduce((sum, line) => sum + line.invoiceBaseExGst, 0));
    const targetDiscount = round2(baseTotal * groupBillingPct / 100);
    const adjustmentLine = group.reduce(
      (largest, line) => (!largest || line.invoiceBaseExGst > largest.invoiceBaseExGst ? line : largest),
      null,
    );

    let allocated = 0;
    for (const line of group) {
      line.schemeDiscountExGst = line === adjustmentLine
        ? 0
        : round2(line.invoiceBaseExGst * groupBillingPct / 100);
      allocated = round2(allocated + line.schemeDiscountExGst);
    }
    if (adjustmentLine) {
      adjustmentLine.schemeDiscountExGst = round2(Math.max(0, targetDiscount - allocated));
    }
    group.forEach(finalizeLine);
  }

  const totals = {
    qty: 0,
    mrpTotal: 0,
    fixedMarginValue: 0,
    baseExGst: 0,
    schemeBenefit: 0,
    schemeBenefitExGst: 0,
    taxableExGst: 0,
    tax: 0,
    invoiceTotal: 0,
    skuCount: lines.length,
    billingPct,
  };

  for (const line of lines) {
    totals.qty += line.qty;
    totals.mrpTotal = round2(totals.mrpTotal + line.mrpValueInclGst);
    totals.fixedMarginValue = round2(totals.fixedMarginValue + line.fixedMarginValueInclGst);
    totals.baseExGst = round2(totals.baseExGst + line.invoiceBaseExGst);
    totals.schemeBenefit = round2(totals.schemeBenefit + line.claim);
    totals.schemeBenefitExGst = round2(totals.schemeBenefitExGst + line.claimExGst);
    totals.taxableExGst = round2(totals.taxableExGst + line.taxableExGst);
    totals.tax = round2(totals.tax + line.tax);
    totals.invoiceTotal = round2(totals.invoiceTotal + line.net);
  }

  const lineBySku = Object.fromEntries(lines.map((line) => [line.skuId, line]));
  return { lines, lineBySku, totals };
}
