import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveOrderLinkedAccess } from "../lib/order-linked-access.ts";
import { normalizePrintLineProperties } from "../lib/print-line-properties.ts";
import { validateBusinessKitContracts, matchBusinessKitContract, resolveBusinessKitComponentSelections } from "../lib/business-kit-contracts.ts";
import { TRACKED_PRINT_MATERIAL_TYPES } from "../lib/print-products.ts";

const start = "2026-01-01T00:00:00.000Z";
const expires = "2026-04-01T00:00:00.000Z";
const base = { ownsCode: true, isOrderLinkedIncludedCode: true, provisioningStatus: "completed", accessStartedAt: start, accessExpiresAt: expires, featureEnabled: true };

test("included access is active before, expired exactly at, and expired after its timestamp", () => {
  assert.equal(resolveOrderLinkedAccess({ ...base, now: new Date("2026-03-31T23:59:59.999Z") }).state, "active_included_access");
  assert.equal(resolveOrderLinkedAccess({ ...base, now: new Date(expires) }).state, "expired_included_access");
  assert.equal(resolveOrderLinkedAccess({ ...base, now: new Date("2026-04-01T00:00:00.001Z") }).state, "expired_included_access");
});

test("expired access is view-only while redirect remains outside the resolver", () => {
  const access = resolveOrderLinkedAccess({ ...base, now: new Date(expires) });
  assert.equal(access.canView, true);
  assert.equal(access.canEditDestination, false);
  assert.equal(access.canViewBasicAnalytics, false);
  assert.equal(access.canExportBasicAnalytics, false);
  assert.equal(access.canDelete, false);
});

test("paid subscription and admin override management without making included code deletable", () => {
  const paid = resolveOrderLinkedAccess({ ...base, hasActivePaidSubscription: true, now: new Date(expires) });
  assert.equal(paid.state, "paid_subscription_access");
  assert.equal(paid.canEditDestination, true);
  assert.equal(paid.canDelete, false);
  assert.equal(resolveOrderLinkedAccess({ ...base, isAdmin: true }).state, "admin");
});

test("unrelated and other-customer codes receive no included rights", () => {
  assert.equal(resolveOrderLinkedAccess({ ...base, ownsCode: false }).state, "denied");
  assert.equal(resolveOrderLinkedAccess({ ...base, isOrderLinkedIncludedCode: false }).state, "view_only");
});

test("feature disabled preserves legacy order-linked management and does not require timestamps", () => {
  const access = resolveOrderLinkedAccess({ ownsCode: true, isOrderLinkedIncludedCode: true, featureEnabled: false, legacyOrderLinkedAccess: true });
  assert.equal(access.state, "active_included_access");
});

test("only canonical new-code opt-in is accepted and unknown values fail closed", () => {
  assert.equal(normalizePrintLineProperties({ "Tracking Mode": "new_included_code", "Clutch Codes Access": "included_90_days" }).clutchCodesAccessOptIn, true);
  for (const [mode, value] of [["existing_code", "included_90_days"], ["none", "included_90_days"], ["new_included_code", "trial"], ["new_included_code", ""]]) {
    assert.equal(normalizePrintLineProperties({ "Tracking Mode": mode, "Clutch Codes Access": value }).clutchCodesAccessOptIn, false);
  }
});

test("all approved physical material types are supported by trusted print registry", () => {
  for (const type of ["business_card", "flyer", "postcard", "door_hanger", "brochure", "banner", "yard_sign", "other_print"]) {
    assert.ok(TRACKED_PRINT_MATERIAL_TYPES.includes(type as any));
  }
});

test("Business Kits fail closed without exact trusted product, SKU, and component contract", () => {
  assert.equal(matchBusinessKitContract("1", "KIT", []), null);
  const value = [{ productId: "123", sku: "STARTER-KIT", kitType: "starter", components: [
    { componentId: "cards", materialType: "business_card", codeCount: 1, trackingPropertyName: "Kit Tracking: Cards" },
    { componentId: "flyers", materialType: "flyer", codeCount: 1, trackingPropertyName: "Kit Tracking: Flyers" },
  ] }];
  const parsed = validateBusinessKitContracts(value);
  assert.equal(parsed.errors.length, 0);
  assert.equal(matchBusinessKitContract("123", "starter-kit", parsed.contracts)?.components.reduce((sum, item) => sum + item.codeCount, 0), 2);
  assert.equal(matchBusinessKitContract("123", "WRONG", parsed.contracts), null);
  const selections = resolveBusinessKitComponentSelections(parsed.contracts[0], {
    "Kit Tracking: Cards": "new_included_code",
    "Kit Tracking: Flyers": "unknown",
  });
  assert.equal(selections.filter((item) => item.timedAccessEligible).length, 1);
  assert.equal(selections[1].trackingMode, "none");
});

test("all customer-facing enforcement surfaces call the centralized per-code resolver", () => {
  for (const file of [
    "../app/api/qr/update/route.ts",
    "../app/api/analytics/export/route.ts",
    "../app/api/analytics/qr/route.ts",
    "../app/api/analytics/qr/[qrId]/route.ts",
    "../app/api/analytics/summary/route.ts",
    "../app/portal/qr/page.tsx",
    "../app/portal/qr/[qrId]/edit/page.tsx",
    "../app/portal/analytics/page.tsx",
    "../app/portal/analytics/[qrId]/page.tsx",
    "../app/portal/print-orders/[id]/page.tsx",
    "../app/portal/page.tsx",
  ]) {
    assert.match(fs.readFileSync(new URL(file, import.meta.url), "utf8"), /loadOrderLinkedQrAccess/);
  }
  assert.doesNotMatch(fs.readFileSync(new URL("../app/qr/[slug]/route.ts", import.meta.url), "utf8"), /loadOrderLinkedQrAccess/);
});

test("migration stores immutable 90-day grant only on completed included provisioning", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260714142802_add_order_linked_90_day_access.sql", import.meta.url), "utf8");
  assert.match(sql, /clutch_codes_access_opt_in boolean not null default false/i);
  assert.match(sql, /platform_access_expires_at = platform_access_started_at \+ interval '90 days'/i);
  assert.match(sql, /provisioning_status = 'completed'/i);
  assert.match(sql, /access_type = 'included_permanent'/i);
  assert.match(sql, /before insert or update/i);
});
