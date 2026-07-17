import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { canAccessAccountModule, canPerformAccountAction, resolveAccountAccess } from "../lib/account-access.ts";
import { hasActiveProfileEvidence, hasSmartCardSystemQrEvidence } from "../lib/account-evidence.ts";
import { getActiveAccountModule } from "../lib/account-navigation.ts";
import { buildLegacyAdminCustomerUpdate } from "../lib/admin-customer-update.ts";

const baseCustomer = {
  is_admin: false,
  plan: "free_qr",
  plan_code: "free_qr",
  plan_status: "active",
  subscription_status: "active",
  included_qr_allowance: 0,
  subscription_qr_limit: 0,
  qr_limit: 0,
  clutch_codes_plan_code: null,
  clutch_codes_subscription_status: "inactive",
};

function access(overrides: Record<string, unknown> = {}, evidence: Record<string, unknown> = {}) {
  return resolveAccountAccess({ customer: { ...baseCustomer, ...overrides }, ...evidence });
}

test("no-product account has no paid access", () => {
  const result = access();
  assert.equal(result.dashboardVariant, "no-product");
  assert.deepEqual(result.activeProductLabels, []);
  assert.equal(result.canCreateQr, false);
  assert.equal(result.canUseProfileBuilder, false);
  assert.equal(result.canUseAdmin, false);
});

test("Smart Card only grants basic profile tools without campaign creation", () => {
  const result = access({}, { hasSmartCardOrder: true, hasSmartCardSystemQr: true, hasActiveProfile: true });
  assert.equal(result.dashboardVariant, "smart-card");
  assert.equal(result.hasConnectBasic, true);
  assert.equal(result.canUseLeadInbox, true);
  assert.equal(result.canUseProfileBuilder, false);
  assert.equal(result.canCreateQr, false);
  assert.equal(canAccessAccountModule(result, "guided-setup"), true);
});

test("only smart_card system QR records prove Smart Card ownership", () => {
  assert.equal(hasSmartCardSystemQrEvidence({ is_system: true, qr_type: "smart_card" }), true);
  assert.equal(hasSmartCardSystemQrEvidence([{ is_system: true, qr_type: "smart_card" }]), true);
  assert.equal(hasSmartCardSystemQrEvidence([{ is_system: true, qr_type: "tracked_print" }]), false);
  assert.equal(hasSmartCardSystemQrEvidence([{ is_system: true, qr_type: "business_kit" }]), false);
  assert.equal(hasSmartCardSystemQrEvidence([{ is_system: true }]), false);
});

test("only explicitly active profiles count as ownership evidence", () => {
  assert.equal(hasActiveProfileEvidence({ is_active: true }), true);
  assert.equal(hasActiveProfileEvidence([{ is_active: true }]), true);
  assert.equal(hasActiveProfileEvidence({ is_active: false }), false);
  assert.equal(hasActiveProfileEvidence([{ is_active: false }]), false);
  assert.equal(hasActiveProfileEvidence([{ is_active: null }]), false);
  assert.equal(hasActiveProfileEvidence([{}]), false);
  assert.equal(hasActiveProfileEvidence(null), false);
  assert.equal(hasActiveProfileEvidence(undefined), false);
});

test("server and admin apply strict Smart Card and active-profile evidence", () => {
  const serverSource = fs.readFileSync(new URL("../lib/account-access-server.ts", import.meta.url), "utf8");
  const adminSource = fs.readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(serverSource, /\.eq\("is_system", true\)\.eq\("qr_type", "smart_card"\)/);
  assert.match(serverSource, /\.eq\("is_active", true\)/);
  assert.match(adminSource, /hasSmartCardSystemQrEvidence\(c\.qr_codes\)/);
  assert.match(adminSource, /hasActiveProfileEvidence\(c\.profiles\)/);
});

test("Connect+ only grants profile features, not general QR creation", () => {
  const result = access({ plan_code: "connect_plus", plan: "connect_plus" }, { hasActiveProfile: true });
  assert.equal(result.dashboardVariant, "connect-plus");
  assert.equal(result.hasConnectPlus, true);
  assert.equal(result.canUseProfileBuilder, true);
  assert.equal(result.canUseProfileHeatmap, true);
  assert.equal(result.canCreateQr, false);
});

for (const [label, code, price, allowance] of [
  ["Starter", "clutch_codes_starter", "$3.99/month", 10],
  ["Growth", "clutch_codes_growth", "$6.99/month", 30],
  ["Pro", "clutch_codes_pro", "$11.99/month", 100],
] as const) {
  test(`${label} only grants canonical Clutch Codes access`, () => {
    const result = access({
      clutch_codes_plan_code: code,
      clutch_codes_subscription_status: "active",
      subscription_qr_limit: allowance,
      qr_limit: allowance,
    });
    assert.equal(result.dashboardVariant, "clutch-codes");
    assert.equal(result.clutchCodesPlanName, `Clutch Codes ${label}`);
    assert.equal(result.clutchCodesPrice, price);
    assert.equal(result.subscriptionQrAllowance, allowance);
    assert.equal(result.effectiveQrCapacity, allowance);
    assert.equal(result.canCreateQr, true);
    assert.equal(result.hasConnectPlus, false);
    assert.equal(result.canUseProfileBuilder, false);
    assert.equal(result.canUseProfileHeatmap, false);
  });
}

test("tracked print only allows owned-code operations without unrelated creation", () => {
  const result = access({ included_qr_allowance: 3, qr_limit: 3 }, {
    hasPrintOrders: true,
    hasTrackedPrint: true,
    hasIncludedPrintQr: true,
    includedPrintQrCount: 3,
  });
  assert.equal(result.dashboardVariant, "print-order");
  assert.equal(result.canEditOwnedQr, true);
  assert.equal(result.canExportQr, true);
  assert.equal(result.canUseCampaignAnalytics, true);
  assert.equal(result.canCreateQr, false);
});

test("included allowance alone does not infer Business Kit or print ownership", () => {
  const result = access({ included_qr_allowance: 4, qr_limit: 4 });
  assert.equal(result.hasIncludedPrintQr, false);
  assert.equal(result.hasBusinessKit, false);
  assert.equal(result.canCreateQr, false);
  assert.equal(result.warnings.length, 1);
});

test("Business Kit evidence enables included material code access", () => {
  const result = access({ included_qr_allowance: 2 }, {
    hasBusinessKit: true,
    hasPrintOrders: true,
    hasIncludedPrintQr: true,
    materialTypes: ["Business Cards", "Flyers"],
  });
  assert.equal(result.dashboardVariant, "business-kit");
  assert.equal(result.canViewPrintOrders, true);
  assert.equal(result.canEditOwnedQr, true);
  assert.equal(result.canCreateQr, false);
});

test("Smart Card plus Connect+ unions only those product features", () => {
  const result = access({ plan_code: "connect_plus" }, { hasSmartCardOrder: true, hasActiveProfile: true });
  assert.equal(result.dashboardVariant, "combined");
  assert.equal(result.canUseProfileBuilder, true);
  assert.equal(result.canUseLeadInbox, true);
  assert.equal(result.canCreateQr, false);
});

test("tracked print plus Starter adds included and subscription capacity", () => {
  const result = access({
    included_qr_allowance: 3,
    subscription_qr_limit: 10,
    clutch_codes_plan_code: "clutch_codes_starter",
    clutch_codes_subscription_status: "active",
  }, { hasTrackedPrint: true, hasPrintOrders: true, hasIncludedPrintQr: true, usedQrCount: 2 });
  assert.equal(result.dashboardVariant, "combined");
  assert.equal(result.effectiveQrCapacity, 13);
  assert.equal(result.remainingQrCapacity, 11);
  assert.equal(result.canCreateQr, true);
});

test("Business Kit plus Growth preserves both products", () => {
  const result = access({
    included_qr_allowance: 3,
    subscription_qr_limit: 30,
    clutch_codes_plan_code: "clutch_codes_growth",
    clutch_codes_subscription_status: "active",
  }, { hasBusinessKit: true, hasPrintOrders: true, hasIncludedPrintQr: true });
  assert.equal(result.dashboardVariant, "combined");
  assert.deepEqual(result.activeProductLabels, ["Clutch Codes Growth", "Business Kit"]);
  assert.equal(result.effectiveQrCapacity, 33);
});

test("Connect+ plus Pro does not conflate campaign and profile heatmaps", () => {
  const result = access({
    plan_code: "connect_plus",
    clutch_codes_plan_code: "clutch_codes_pro",
    clutch_codes_subscription_status: "active",
    subscription_qr_limit: 100,
  }, { hasActiveProfile: true });
  assert.equal(result.dashboardVariant, "combined");
  assert.equal(result.canCreateQr, true);
  assert.equal(result.canUseProfileBuilder, true);
  assert.equal(result.canUseProfileHeatmap, true);
  assert.equal(result.canUseCampaignHeatmap, false);
});

test("Smart Card plus Connect+ plus Pro unions all three explicit products", () => {
  const result = access({
    plan_code: "connect_plus",
    clutch_codes_plan_code: "clutch_codes_pro",
    clutch_codes_subscription_status: "active",
    subscription_qr_limit: 100,
  }, { hasSmartCardOrder: true, hasActiveProfile: true });
  assert.deepEqual(result.activeProductLabels, ["Smart Business Card", "Clutch Connect+", "Clutch Codes Pro"]);
  assert.equal(result.dashboardVariant, "combined");
});

test("admin alone is unrestricted and unlimited", () => {
  const result = access({ is_admin: true, plan: "admin", plan_code: "admin" });
  assert.equal(result.dashboardVariant, "admin");
  assert.equal(result.effectiveQrCapacity, null);
  assert.equal(result.remainingQrCapacity, null);
  assert.equal(result.canCreateQr, true);
  assert.equal(result.canUseCampaignHeatmap, true);
  assert.equal(result.canUseAdmin, true);
  assert.equal(Object.values(result.modules).every((state) => state === "enabled" || state === "hidden"), true);
});

test("admin remains unrestricted when legacy subscription status is cancelled", () => {
  const result = access({ is_admin: true, plan: "admin", plan_code: "admin", subscription_status: "cancelled" });
  assert.equal(result.canUseAdmin, true);
  assert.equal(result.canCreateQr, true);
  assert.equal(result.canUseCampaignHeatmap, true);
  assert.equal(result.effectiveQrCapacity, null);
});

test("cancelled Clutch Codes locks subscription features", () => {
  const result = access({
    clutch_codes_plan_code: "clutch_codes_starter",
    clutch_codes_subscription_status: "cancelled",
    subscription_qr_limit: 0,
  });
  assert.equal(result.hasClutchCodes, false);
  assert.equal(result.canCreateQr, false);
});

test("past-due Connect+ locks profile upgrades", () => {
  const result = access({ plan_code: "connect_plus", plan_status: "past_due" }, { hasActiveProfile: true });
  assert.equal(result.hasConnectPlus, false);
  assert.equal(result.canUseProfileBuilder, false);
});

test("used capacity equal to total capacity blocks new creation", () => {
  const result = access({
    subscription_qr_limit: 10,
    clutch_codes_plan_code: "clutch_codes_starter",
    clutch_codes_subscription_status: "active",
  }, { usedQrCount: 10 });
  assert.equal(result.remainingQrCapacity, 0);
  assert.equal(result.canCreateQr, false);
});

test("locked direct module access is denied", () => {
  const result = access({}, { hasSmartCardOrder: true, hasActiveProfile: true });
  assert.equal(result.modules["profile-builder"], "locked");
  assert.equal(canAccessAccountModule(result, "profile-builder"), false);
  assert.equal(canAccessAccountModule(result, "guided-setup"), true);
});

test("legacy admin Save preserves split allowances and Clutch Codes fields", () => {
  const update = buildLegacyAdminCustomerUpdate({
    company_name: "Updated",
    plan_code: "connect_plus",
    included_qr_allowance: 7,
    subscription_qr_limit: 30,
    clutch_codes_plan_code: "clutch_codes_growth",
    clutch_codes_subscription_status: "active",
  });
  assert.equal(update.company_name, "Updated");
  assert.equal(update.plan_code, "connect_plus");
  assert.equal("included_qr_allowance" in update, false);
  assert.equal("subscription_qr_limit" in update, false);
  assert.equal("clutch_codes_plan_code" in update, false);
  assert.equal("clutch_codes_subscription_status" in update, false);
});

test("account navigation chooses exactly one pathname and query-aware active module", () => {
  const visible = [
    "overview", "print-orders", "smart-card", "clutch-connect", "guided-setup", "profile-builder",
    "lead-inbox", "profile-analytics", "qr-codes", "campaign-analytics", "campaign-heatmap",
    "subscription", "settings", "admin",
  ] as const;
  const params = (value = "") => new URLSearchParams(value);
  assert.equal(getActiveAccountModule("/portal", params(), [...visible]), "overview");
  assert.equal(getActiveAccountModule("/portal", params("section=print-orders"), [...visible]), "print-orders");
  assert.equal(getActiveAccountModule("/portal/analytics", params("tab=profile"), [...visible]), "profile-analytics");
  assert.equal(getActiveAccountModule("/portal/analytics", params("tab=campaign"), [...visible]), "campaign-analytics");
  assert.equal(getActiveAccountModule("/portal/subscription", params(), [...visible]), "subscription");
  assert.equal(getActiveAccountModule("/portal/qr/abc/edit", params(), [...visible]), "qr-codes");
  assert.equal(getActiveAccountModule("/admin/customers", params(), [...visible]), "admin");
  assert.equal(getActiveAccountModule("/portal/connect", params(), [...visible]), "smart-card");
});

test("behavioral access boundaries match product ownership", () => {
  const noProduct = access();
  const smartCard = access({}, { hasSmartCardOrder: true });
  const connectPlus = access({ plan: "connect_plus", plan_code: "connect_plus" });
  const starterBelowLimit = access({
    clutch_codes_plan_code: "clutch_codes_starter",
    clutch_codes_subscription_status: "active",
    subscription_qr_limit: 10,
  }, { usedQrCount: 9 });
  const starterAtLimit = access({
    clutch_codes_plan_code: "clutch_codes_starter",
    clutch_codes_subscription_status: "active",
    subscription_qr_limit: 10,
  }, { usedQrCount: 10 });
  const trackedPrint = access({ included_qr_allowance: 1 }, {
    hasTrackedPrint: true,
    hasPrintOrders: true,
    hasIncludedPrintQr: true,
  });

  assert.equal(canPerformAccountAction(noProduct, "create-qr"), false);
  assert.equal(canPerformAccountAction(smartCard, "create-qr"), false);
  assert.equal(canPerformAccountAction(connectPlus, "create-qr"), false);
  assert.equal(canPerformAccountAction(starterBelowLimit, "create-qr"), true);
  assert.equal(canPerformAccountAction(starterAtLimit, "create-qr"), false);
  assert.equal(canPerformAccountAction(trackedPrint, "edit-owned-qr", { ownsRecord: true }), true);
  assert.equal(canPerformAccountAction(trackedPrint, "edit-owned-qr", { ownsRecord: false }), false);
  assert.equal(canPerformAccountAction(trackedPrint, "create-qr"), false);
  assert.equal(canPerformAccountAction(starterBelowLimit, "profile-builder"), false);
  assert.equal(canPerformAccountAction(smartCard, "profile-builder"), false);
  assert.equal(canPerformAccountAction(connectPlus, "profile-builder"), true);
  assert.equal(canPerformAccountAction(noProduct, "admin"), false);
  assert.equal(canPerformAccountAction(noProduct, "campaign-heatmap"), false);
  assert.equal(canPerformAccountAction(access({ is_admin: true }), "campaign-heatmap"), true);
});

test("direct paid routes and APIs use server-side account access gates", () => {
  const gatedSources = [
    "../app/portal/create/page.tsx",
    "../app/portal/qr/page.tsx",
    "../app/portal/qr/[qrId]/edit/page.tsx",
    "../app/portal/analytics/page.tsx",
    "../app/portal/analytics/[qrId]/page.tsx",
    "../app/portal/heatmap/page.tsx",
    "../app/portal/connect/build/page.tsx",
    "../app/portal/connect/leads/page.tsx",
    "../app/api/qr/create/route.ts",
    "../app/api/qr/update/route.ts",
    "../app/api/analytics/summary/route.ts",
    "../app/api/analytics/qr/route.ts",
    "../app/api/analytics/qr/[qrId]/route.ts",
    "../app/api/analytics/connect/route.ts",
    "../app/api/analytics/export/route.ts",
  ];
  for (const sourcePath of gatedSources) {
    const source = fs.readFileSync(new URL(sourcePath, import.meta.url), "utf8");
    assert.match(source, /loadAccountAccess/);
  }
});
