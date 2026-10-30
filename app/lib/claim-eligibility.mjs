/**
 * Claim visibility eligibility aligned to the supplied Apps Script getClaims().
 * This is a UI/data-selection helper only; Firestore Security Rules must enforce
 * access server-side before the application is used with real business data.
 */
export const CLAIM_ELIGIBLE_ORDER_STATUSES = Object.freeze([
  "ACCEPTED",
  "INVOICED",
  "DISPATCHED",
]);

const ELIGIBLE_STATUSES = new Set(CLAIM_ELIGIBLE_ORDER_STATUSES);

export function isClaimEligibleOrder(order) {
  const status = String(order?.status ?? "").trim().toUpperCase();
  return ELIGIBLE_STATUSES.has(status) && Array.isArray(order?.items);
}
