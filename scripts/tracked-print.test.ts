import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { classifyPrintProduct } from "../lib/print-products.ts";
import { normalizePrintLineProperties } from "../lib/print-line-properties.ts";
import { provisionTrackedPrintOrder, type TrackedPrintDependencies } from "../lib/tracked-print.ts";
import { resolveAccountAccess } from "../lib/account-access.ts";

const registry = [{ sku: "POSTCARD-4X6", materialType: "Postcard", defaultTrackingAvailable: true }];
const line = (overrides: Record<string, unknown> = {}) => ({ id: "line-1", sku: "POSTCARD-4X6", product_id: "p1", title: "Postcards", quantity: 1, properties: [], ...overrides });
const order = (item = line(), overrides: Record<string, unknown> = {}) => ({ id: "order-1", name: "#1001", email: "buyer@example.com", customer: { id: "customer-1", email: "buyer@example.com" }, line_items: [item], ...overrides });

function harness(options: { existingCustomer?: boolean; rejectExisting?: boolean } = {}) {
  const items = new Map<string, any>(); const qrs = new Map<string, string>(); const activities = new Set<string>();
  let authCustomers = 0;
  const dependencies: TrackedPrintDependencies = {
    async findCustomer() { return options.existingCustomer ? { id: "customer-db-1" } : null; },
    async ensureNeutralCustomer() { authCustomers++; return { id: "customer-db-1" }; },
    async upsertPrintItem(input) { const key = `${input.shopify_order_id}:${input.shopify_line_item_id}`; const previous = items.get(key); const value = { ...input, id: previous?.id || `item-${items.size + 1}` }; items.set(key, value); return { id: value.id, provisioning_status: String(value.provisioning_status) }; },
    async provisionQr(input) {
      if (options.rejectExisting && input.existingQrCodeId) throw new Error("selected QR is unavailable");
      if (!qrs.has(input.printOrderItemId)) qrs.set(input.printOrderItemId, input.existingQrCodeId || `qr-${qrs.size + 1}`);
      const included = [...qrs.values()].filter((id) => id.startsWith("qr-")).length;
      return { qrCodeId: qrs.get(input.printOrderItemId)!, includedQrAllowance: included };
    },
    async recordActivity(input) { activities.add(input.idempotencyKey); },
    async markAttention(orderId, reason) { for (const [key, item] of items) if (item.id === orderId) items.set(key, { ...item, provisioning_status: "needs_attention", attention_reason: reason }); },
  };
  return { dependencies, items, qrs, activities, get authCustomers() { return authCustomers; } };
}

test("trusted SKU is eligible and title-only or customer properties are insufficient", () => {
  assert.equal(classifyPrintProduct({ sku: "postcard-4x6" }, registry).eligible, true);
  assert.equal(classifyPrintProduct({ title: "Postcards" }, registry).eligible, false);
  assert.equal(classifyPrintProduct({ sku: "UNKNOWN", title: "Postcards" }, registry).eligible, false);
});

test("property parser normalizes canonical values, aliases, and capitalization", () => {
  assert.equal(normalizePrintLineProperties({ "Tracking Mode": "New Included Code" }).trackingMode, "new_included_code");
  assert.equal(normalizePrintLineProperties({ tracking: "USE EXISTING CODE" }).trackingMode, "existing_code");
  assert.equal(normalizePrintLineProperties({ tracking: "No Tracking" }).trackingMode, "none");
});

test("property parser validates destinations and extracts existing QR IDs", () => {
  assert.equal(normalizePrintLineProperties({ "Destination URL": "https://example.com/a" }).validDestination, true);
  assert.equal(normalizePrintLineProperties({ "Destination URL": "javascript:alert(1)" }).validDestination, false);
  assert.equal(normalizePrintLineProperties({ "Existing QR Code ID": "qr-123" }).existingQrCodeId, "qr-123");
  assert.equal("material_type" in normalizePrintLineProperties({ "Material Type": "Fake" }).normalizedProperties, false);
});

test("normal print creates one item and no customer, QR, or allowance", async () => {
  const h = harness(); const result = await provisionTrackedPrintOrder({ payload: order(), webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(result.processedItems, 1); assert.equal(h.items.size, 1); assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0);
  assert.equal([...h.items.values()][0].provisioning_status, "not_required");
});

for (const quantity of [1, 500]) test(`quantity ${quantity} provisions exactly one included code`, async () => {
  const h = harness();
  const item = line({ quantity, properties: { "Tracking Mode": "new included code", "Destination URL": "https://example.com" } });
  await provisionTrackedPrintOrder({ payload: order(item), webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(h.items.size, 1); assert.equal(h.qrs.size, 1); assert.equal(h.authCustomers, 1);
});

test("same order and line is idempotent across webhook IDs", async () => {
  const h = harness(); const payload = order(line({ properties: { tracking: "new code", destination: "https://example.com" } }));
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry });
  assert.equal(h.items.size, 1); assert.equal(h.qrs.size, 1);
});

test("two eligible line items create two records and two codes", async () => {
  const h = harness(); const properties = { tracking: "new code", destination: "https://example.com" };
  const payload = order(line({ properties }), { line_items: [line({ id: "l1", properties }), line({ id: "l2", properties })] });
  await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(h.items.size, 2); assert.equal(h.qrs.size, 2);
});

test("existing owned code links without a new QR or included allowance", async () => {
  const h = harness({ existingCustomer: true });
  const payload = order(line({ properties: { tracking: "existing code", "existing qr code id": "owned-qr" } }));
  const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal(h.qrs.get("item-1"), "owned-qr"); assert.equal((result.results[0] as any).includedQrAllowance, 0);
});

test("wrong-customer or Smart Card selection is rejected without creating another QR", async () => {
  const h = harness({ existingCustomer: true, rejectExisting: true });
  const payload = order(line({ properties: { tracking: "existing code", "existing qr code id": "unavailable" } }));
  const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal((result.results[0] as any).status, "needs_attention");
  assert.equal(h.qrs.size, 0);
});

test("missing email or invalid destination needs attention without provisioning", async () => {
  for (const payload of [
    order(line({ properties: { tracking: "new code", destination: "https://example.com" } }), { email: "", customer: null }),
    order(line({ properties: { tracking: "new code", destination: "bad" } })),
  ]) {
    const h = harness(); await provisionTrackedPrintOrder({ payload, webhookEventId: "w", dependencies: h.dependencies, registry });
    assert.equal([...h.items.values()][0].provisioning_status, "needs_attention"); assert.equal(h.qrs.size, 0); assert.equal(h.authCustomers, 0);
  }
});

test("tracked print plus Growth resolves capacity 31 without Smart Card or Connect+", () => {
  const access = resolveAccountAccess({ customer: { included_qr_allowance: 1, subscription_qr_limit: 30, clutch_codes_plan_code: "clutch_codes_growth", clutch_codes_subscription_status: "active" }, hasPrintOrders: true, hasTrackedPrint: true, hasIncludedPrintQr: true, usedQrCount: 1 });
  assert.equal(access.dashboardVariant, "combined"); assert.equal(access.effectiveQrCapacity, 31);
  assert.equal(access.hasSmartCard, false); assert.equal(access.hasConnectPlus, false); assert.equal(access.canCreateQr, true);
});

test("tracked-print permissions remain limited to owned-code operations", () => {
  const access = resolveAccountAccess({ customer: { included_qr_allowance: 1 }, hasPrintOrders: true, hasTrackedPrint: true, hasIncludedPrintQr: true, usedQrCount: 1 });
  assert.equal(access.canEditOwnedQr, true); assert.equal(access.canExportQr, true); assert.equal(access.canUseCampaignAnalytics, true);
  assert.equal(access.canCreateQr, false); assert.equal(access.canCustomizeQr, false); assert.equal(access.canUseCampaignHeatmap, false); assert.equal(access.canUseProfileBuilder, false);
});

test("migration contains atomic reconciliation, RLS, protected QR metadata, and no public execution", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260713024450_tracked_print_order_provisioning.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.print_order_items/); assert.match(sql, /create table public\.print_qr_provisionings/);
  assert.match(sql, /create or replace function public\.provision_tracked_print_qr/); assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /revoke all on function public\.provision_tracked_print_qr/); assert.match(sql, /counts_toward_capacity/);
  assert.match(sql, /enable row level security/g);
});

test("orders-paid retains HMAC and email kill-switch paths while integrating tracked print", () => {
  const source = fs.readFileSync(new URL("../app/api/webhooks/shopify/orders-paid/route.ts", import.meta.url), "utf8");
  assert.match(source, /verifyShopifyHmac/); assert.match(source, /SEND_ONBOARDING_EMAILS/); assert.match(source, /provisionClutchCodesPaidOrder/);
  assert.match(source, /provisionTrackedPrintOrder/); assert.match(source, /isSmartCardLineItem/);
});
