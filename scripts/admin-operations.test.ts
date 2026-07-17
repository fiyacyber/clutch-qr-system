import assert from "node:assert/strict";
import test from "node:test";
import { formatAdminLabel, formatOrderAge, getAdminStatusTone } from "../lib/admin-operations.ts";

test("admin labels never expose raw enum formatting", () => {
  assert.equal(formatAdminLabel("new_included_code"), "New Included Code");
  assert.equal(formatAdminLabel("ready_for_production"), "Ready for Production");
  assert.equal(formatAdminLabel("needs_attention"), "Needs Attention");
  assert.equal(formatAdminLabel("qr_setup_required"), "QR Setup Required");
  assert.equal(formatAdminLabel("approved"), "Approved");
  assert.equal(formatAdminLabel("qr"), "QR");
  assert.equal(formatAdminLabel("Customer supplied note"), "Customer supplied note");
});

test("admin status tones preserve operational meaning", () => {
  assert.equal(getAdminStatusTone("needs_attention"), "attention");
  assert.equal(getAdminStatusTone("ready_for_production"), "success");
  assert.equal(getAdminStatusTone("in_production"), "warning");
});

test("order age is readable and deterministic", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  assert.equal(formatOrderAge("2026-07-16T11:30:00.000Z", now), "< 1 hour");
  assert.equal(formatOrderAge("2026-07-16T09:00:00.000Z", now), "3 hours");
  assert.equal(formatOrderAge("2026-07-14T12:00:00.000Z", now), "2 days");
});
