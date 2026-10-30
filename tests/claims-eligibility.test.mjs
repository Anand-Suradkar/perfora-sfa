import test from "node:test";
import assert from "node:assert/strict";
import { isClaimEligibleOrder } from "../app/lib/claim-eligibility.mjs";

test("accepted order with item array is eligible for claims", () => {
  assert.equal(isClaimEligibleOrder({ status: "ACCEPTED", items: [] }), true);
});

test("invoiced and dispatched orders are eligible", () => {
  assert.equal(isClaimEligibleOrder({ status: "INVOICED", items: [] }), true);
  assert.equal(isClaimEligibleOrder({ status: "DISPATCHED", items: [] }), true);
});

test("draft, created, shared and cancelled orders are not claim eligible", () => {
  for (const status of ["DRAFT", "CREATED", "SHARED", "CANCELLED"]) {
    assert.equal(isClaimEligibleOrder({ status, items: [] }), false, status);
  }
});

test("status comparison tolerates case and surrounding whitespace", () => {
  assert.equal(isClaimEligibleOrder({ status: " accepted ", items: [] }), true);
});

test("missing or malformed item arrays are rejected", () => {
  assert.equal(isClaimEligibleOrder({ status: "ACCEPTED" }), false);
  assert.equal(isClaimEligibleOrder({ status: "ACCEPTED", items: null }), false);
});
