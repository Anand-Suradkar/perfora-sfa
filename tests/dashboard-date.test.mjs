import test from "node:test";
import assert from "node:assert/strict";
import { dateKeyInTimeZone, todayDateKey, isIncludedInSalesMetrics } from "../app/lib/dashboard-date.mjs";

test("uses India business date instead of UTC date near midnight", () => {
  assert.equal(dateKeyInTimeZone("2026-10-28T20:00:00.000Z"), "2026-10-29");
});

test("handles Date and Firestore-like timestamp inputs", () => {
  const date = new Date("2026-10-29T08:00:00.000Z");
  assert.equal(dateKeyInTimeZone(date), "2026-10-29");
  assert.equal(dateKeyInTimeZone({ toDate: () => date }), "2026-10-29");
  assert.equal(dateKeyInTimeZone({ toMillis: () => date.getTime() }), "2026-10-29");
});

test("returns an empty string for missing or invalid dates", () => {
  assert.equal(dateKeyInTimeZone(null), "");
  assert.equal(dateKeyInTimeZone("not-a-date"), "");
});

test("today key is in YYYY-MM-DD format", () => {
  assert.match(todayDateKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test("draft and cancelled orders are excluded from sales metrics", () => {
  const order = { createdAt: new Date(), items: [] };
  assert.equal(isIncludedInSalesMetrics({ ...order, status: "CREATED" }), true);
  assert.equal(isIncludedInSalesMetrics({ ...order, status: "INVOICED" }), true);
  assert.equal(isIncludedInSalesMetrics({ ...order, status: "DRAFT" }), false);
  assert.equal(isIncludedInSalesMetrics({ ...order, status: "Cancelled" }), false);
  assert.equal(isIncludedInSalesMetrics({ ...order, items: null, status: "CREATED" }), false);
});
