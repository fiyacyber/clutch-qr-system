import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertAdminCustomerQueriesSucceeded } from "../lib/admin-customer-data.ts";
import {
  buildAdminOrderSearchHref,
  formatAdminLabel,
  formatOrderAge,
  getAdminStatusTone,
} from "../lib/admin-operations.ts";

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

test("global admin search builds a trimmed encoded order destination", () => {
  assert.equal(
    buildAdminOrderSearchHref(" PR15-QA-15001 "),
    "/admin/print-orders?q=PR15-QA-15001"
  );
  assert.equal(
    buildAdminOrderSearchHref("Casey & Riley"),
    "/admin/print-orders?q=Casey+%26+Riley"
  );
  assert.equal(buildAdminOrderSearchHref("   "), "/admin/print-orders");
});

test("customer-management query failures cannot render as an empty state", () => {
  assert.doesNotThrow(() => {
    assertAdminCustomerQueriesSucceeded([
      { name: "customers", error: null },
      { name: "customer groups", error: undefined },
    ]);
  });

  assert.throws(
    () => {
      assertAdminCustomerQueriesSucceeded([
        {
          name: "customers",
          error: {
            code: "42501",
            message: "permission denied for table customer_groups",
          },
        },
      ]);
    },
    /Unable to load required admin customer-management data.*customers: 42501 permission denied for table customer_groups/
  );
});

test("customer_groups permission migration stays service-role only", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260717030659_restore_customer_groups_service_role_privileges.sql",
      import.meta.url
    ),
    "utf8"
  ).toLowerCase();

  assert.match(
    migration,
    /grant all privileges on table public\.customer_groups to service_role;/
  );
  assert.doesNotMatch(migration, /\bto\s+(anon|authenticated)\b/);
  assert.doesNotMatch(migration, /\b(create|alter|drop)\s+policy\b/);
});
