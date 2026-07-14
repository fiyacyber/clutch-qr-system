import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildIncludedDestinationUpdate, parseOrderLinkedDestination, resolveOrderLinkedAccess } from "../lib/order-linked-access.ts";
import { normalizePrintLineProperties, parseStrictIncludedAccessIntent } from "../lib/print-line-properties.ts";
import { validateBusinessKitContracts, matchBusinessKitContract, resolveBusinessKitComponentSelections } from "../lib/business-kit-contracts.ts";
import { TRACKED_PRINT_MATERIAL_TYPES } from "../lib/print-products.ts";
import { analyticsScopeForCode, buildBasicCodeAnalytics, buildBasicAnalyticsCsvRows } from "../lib/order-linked-analytics.ts";
import { toCsv } from "../lib/analytics.ts";

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

test("feature disabled preserves only pre-timestamp legacy management", () => {
  const access = resolveOrderLinkedAccess({ ownsCode: true, isOrderLinkedIncludedCode: true, featureEnabled: false, legacyOrderLinkedAccess: true });
  assert.equal(access.state, "active_included_access");
  for (const timestamps of [
    { accessStartedAt: start },
    { accessExpiresAt: expires },
    { accessStartedAt: "bad", accessExpiresAt: "also-bad" },
    { accessStartedAt: start, accessExpiresAt: expires },
  ]) {
    assert.equal(resolveOrderLinkedAccess({ ownsCode: true, isOrderLinkedIncludedCode: true, featureEnabled: false, legacyOrderLinkedAccess: true, ...timestamps }).state, "view_only");
  }
});

test("timed access requires finite exact 90-day timestamps and a started window", () => {
  for (const changed of [
    { accessStartedAt: "invalid" },
    { accessExpiresAt: "invalid" },
    { accessExpiresAt: "2026-03-31T23:59:59.999Z" },
    { accessStartedAt: "2026-01-01T00:00:00.001Z" },
    { accessStartedAt: "2026-12-01T00:00:00.000Z", accessExpiresAt: "2027-03-01T00:00:00.000Z" },
  ]) {
    assert.equal(resolveOrderLinkedAccess({ ...base, ...changed, now: new Date("2026-02-01T00:00:00.000Z") }).state, "expired_included_access");
  }
  const leapStart = "2024-02-29T12:00:00.000Z";
  const leapExpiry = new Date(Date.parse(leapStart) + 90 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(resolveOrderLinkedAccess({ ...base, accessStartedAt: leapStart, accessExpiresAt: leapExpiry, now: new Date("2024-03-10T07:00:00.000Z") }).state, "active_included_access");
  const dstStart = "2026-03-08T06:59:59.000Z";
  const dstExpiry = new Date(Date.parse(dstStart) + 90 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(resolveOrderLinkedAccess({ ...base, accessStartedAt: dstStart, accessExpiresAt: dstExpiry, now: new Date("2026-03-08T07:00:00.000Z") }).state, "active_included_access");
});

test("only canonical new-code opt-in is accepted and unknown values fail closed", () => {
  assert.equal(normalizePrintLineProperties({ "Tracking Mode": "new_included_code", "Clutch Codes Access": "included_90_days" }).clutchCodesAccessOptIn, true);
  for (const [mode, value] of [["existing_code", "included_90_days"], ["none", "included_90_days"], ["new_included_code", "trial"], ["new_included_code", ""]]) {
    assert.equal(normalizePrintLineProperties({ "Tracking Mode": mode, "Clutch Codes Access": value }).clutchCodesAccessOptIn, false);
  }
});

test("strict entitlement parser rejects aliases, casing, whitespace, duplicates, nulls, arrays, and objects", () => {
  assert.equal(parseStrictIncludedAccessIntent([
    { name: "Tracking Mode", value: "new_included_code" },
    { name: "Clutch Codes Access", value: "included_90_days" },
  ]).optIn, true);
  for (const properties of [
    [{ name: "tracking mode", value: "new_included_code" }, { name: "Clutch Codes Access", value: "included_90_days" }],
    [{ name: "Tracking Mode", value: "NEW_INCLUDED_CODE" }, { name: "Clutch Codes Access", value: "included_90_days" }],
    [{ name: "Tracking Mode", value: " new_included_code" }, { name: "Clutch Codes Access", value: "included_90_days" }],
    [{ name: "Tracking Mode", value: "new_included_code" }, { name: "Tracking Mode", value: "new_included_code" }, { name: "Clutch Codes Access", value: "included_90_days" }],
    [{ name: "Tracking Mode", value: null }, { name: "Clutch Codes Access", value: "included_90_days" }],
    [{ name: "Tracking Mode", value: ["new_included_code"] }, { name: "Clutch Codes Access", value: "included_90_days" }],
    [{ name: "Tracking Mode", value: { value: "new_included_code" } }, { name: "Clutch Codes Access", value: "included_90_days" }],
    [{ name: "Tracking Mode", value: "existing_code" }, { name: "Clutch Codes Access", value: "included_90_days" }],
  ]) assert.equal(parseStrictIncludedAccessIntent(properties).optIn, false);
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
  assert.equal(matchBusinessKitContract("123", "STARTER-KIT", parsed.contracts)?.components.reduce((sum, item) => sum + item.codeCount, 0), 2);
  assert.equal(matchBusinessKitContract("123", "starter-kit", parsed.contracts), null);
  assert.equal(matchBusinessKitContract("123", "WRONG", parsed.contracts), null);
  const selections = resolveBusinessKitComponentSelections(parsed.contracts[0], {
    "Kit Tracking: Cards": "new_included_code",
    "Kit Tracking: Flyers": "unknown",
  });
  assert.equal(selections.filter((item) => item.timedAccessEligible).length, 1);
  assert.equal(selections[1].trackingMode, "none");
});

test("Business Kit registry rejects duplicate contracts, component IDs, property names, and coercive values", () => {
  const baseContract = { productId: "123", sku: "KIT", kitType: "starter", components: [
    { componentId: "cards", materialType: "business_card", codeCount: 1, trackingPropertyName: "Cards Tracking" },
  ] };
  assert.ok(validateBusinessKitContracts([baseContract, baseContract]).errors.length);
  assert.ok(validateBusinessKitContracts([{ ...baseContract, components: [baseContract.components[0], baseContract.components[0]] }]).errors.length);
  assert.ok(validateBusinessKitContracts([{ ...baseContract, components: [baseContract.components[0], { ...baseContract.components[0], componentId: "flyer" }] }]).errors.length);
  assert.ok(validateBusinessKitContracts([{ ...baseContract, components: [{ ...baseContract.components[0], codeCount: "1" }] }]).errors.length);
});

test("basic analytics exposes only aggregate code data and explicit scope", () => {
  const access = resolveOrderLinkedAccess({ ...base, now: new Date("2026-02-01T00:00:00.000Z") });
  assert.equal(analyticsScopeForCode({ hasPaidAnalytics: false, codeAccess: access }), "basic_code");
  assert.equal(analyticsScopeForCode({ hasPaidAnalytics: true, codeAccess: access }), "full_account");
  assert.equal(analyticsScopeForCode({ isAdmin: true, hasPaidAnalytics: false, codeAccess: access }), "admin");
  const basic = buildBasicCodeAnalytics({ id: "qr-1", name: "Campaign" }, [
    { qr_code_id: "qr-1", created_at: "2026-01-02T23:59:59.000Z" },
    { qr_code_id: "qr-1", created_at: "2026-01-03T00:00:00.000Z" },
  ]);
  assert.deepEqual(Object.keys(basic).sort(), ["code", "firstScanAt", "lastScanAt", "scansByUtcDay", "scope", "totalScans"].sort());
  assert.deepEqual(basic.scansByUtcDay, [{ date: "2026-01-02", count: 1 }, { date: "2026-01-03", count: 1 }]);
  assert.equal(JSON.stringify(basic).includes("ip_hash"), false);
});

test("CSV serializer neutralizes formulas before standards-compliant escaping", () => {
  const csv = toCsv([{ name: "=HYPERLINK(\"bad\")", plus: "  +SUM(1,2)", minus: "-1+2", at: "@cmd", tab: "\tcmd", cr: "\rcmd", safe: "Campaign", quoted: "a, \"quote\"\nand line" }]);
  for (const unsafe of ["=HYPERLINK", "+SUM", "-1+2", "@cmd", "\tcmd", "\rcmd"]) assert.equal(csv.includes(`,${unsafe}`), false);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /"a, ""quote""\nand line"/);
  assert.equal(buildBasicAnalyticsCsvRows([{ id: "qr-1", name: "Campaign" }], []).some((row) => "ip_hash" in row), false);
});

test("included destination validation accepts only strict credential-free http and https URLs", () => {
  assert.equal(parseOrderLinkedDestination("https://example.com/path"), "https://example.com/path");
  assert.deepEqual(buildIncludedDestinationUpdate("https://example.com/path"), { destination_url: "https://example.com/path" });
  assert.deepEqual(Object.keys(buildIncludedDestinationUpdate("https://example.com") || {}), ["destination_url"]);
  for (const value of ["", " example.com", "example.com", "ftp://example.com", "javascript:alert(1)", "https://u:p@example.com", "//example.com", "not a url"]) {
    assert.equal(parseOrderLinkedDestination(value), null);
  }
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

test("source-aware forward migration keeps Business Kit provisioning atomic and service-only", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260714190244_add_order_linked_print_source_type.sql", import.meta.url), "utf8");
  assert.match(sql, /p_source_type not in \('tracked_print', 'business_kit'\)/i);
  assert.match(sql, /p_source_type, v_access/i);
  assert.match(sql, /revoke all on function .* from public, anon, authenticated/i);
});
