import test from "node:test";
import assert from "node:assert/strict";
import { getOrderVisitAction } from "../app/lib/order-visit.mjs";

test("draft saves do not create or complete visits", () => {
  assert.equal(getOrderVisitAction({ isDraft: true, isEdit: false, hasOpenVisit: false }), "skip");
  assert.equal(getOrderVisitAction({ isDraft: true, isEdit: true, hasOpenVisit: true }), "skip");
});

test("new submitted order completes an already open visit", () => {
  assert.equal(getOrderVisitAction({ isDraft: false, isEdit: false, hasOpenVisit: true }), "complete-existing");
});

test("new submitted order creates a visit when no visit is open", () => {
  assert.equal(getOrderVisitAction({ isDraft: false, isEdit: false, hasOpenVisit: false }), "create-and-complete");
});

test("editing an order completes an open visit but does not invent a new call", () => {
  assert.equal(getOrderVisitAction({ isDraft: false, isEdit: true, hasOpenVisit: true }), "complete-existing");
  assert.equal(getOrderVisitAction({ isDraft: false, isEdit: true, hasOpenVisit: false }), "skip");
});
