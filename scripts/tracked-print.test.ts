import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { classifyPrintProduct } from "../lib/print-products.ts";
import { normalizePrintLineProperties } from "../lib/print-line-properties.ts";
import { provisionTrackedPrintOrder, type TrackedPrintDependencies } from "../lib/tracked-print.ts";
import { resolveAccountAccess } from "../lib/account-access.ts";
import { buildSafeExistingCustomerLinkagePatch, resolveCustomerIdentityRows } from "../lib/tracked-print-supabase.ts";

const registry = [{ sku: "POSTCARD-4X6", materialType: "Postcard", defaultTrackingAvailable: true }];
const line = (overrides: Record<string, unknown> = {}) => ({ id: "line-1", sku: "POSTCARD-4X6", product_id: "p1", title: "Postcards", quantity: 1, properties: [], ...overrides });
const order = (item = line(), overrides: Record<string, unknown> = {}) => ({ id: "order-1", name: "#1001", email: "buyer@example.com", customer: { id: "customer-1", email: "buyer@example.com" }, line_items: [item], ...overrides });

function harness(options: { existingCustomer?: boolean; rejectExisting?: boolean; identityConflict?: boolean; concurrentConflict?: boolean } = {}) {
  const items = new Map<string, any>(); const qrs = new Map<string, string>(); const activities = new Set<string>();
  let authCustomers = 0;
  const dependencies: TrackedPrintDependencies = {
    async resolveCustomer() { return options.identityConflict ? { status: "conflict" } : options.existingCustomer ? { status: "found", customer: { id: "customer-db-1" } } : { status: "not_found" }; },
    async ensureNeutralCustomer() { if (options.concurrentConflict) return { status: "conflict" }; authCustomers++; return { status: "found", customer: { id: "customer-db-1" } }; },
    async findPrintItem(orderId, lineItemId) { return items.get(`${orderId}:${lineItemId}`) || null; },
    async upsertPrintItem(input) {
      const key = `${input.shopify_order_id}:${input.shopify_line_item_id}`; const previous = items.get(key);
      if (previous) {
        const keys = ["customer_id","product_id","variant_id","sku","material_type","quantity","tracking_mode","destination_url","existing_qr_code_id","campaign_name"];
        return { ...previous, immutableMatch: keys.every((field) => (previous[field] ?? null) === (input[field] ?? null)) };
      }
      const value = { ...input, id: `item-${items.size + 1}` }; items.set(key, value); return { ...value, immutableMatch: true };
    },
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

test("customer identity resolver reconciles email and Shopify matches explicitly", () => {
  const emailNoShopify = { id: "email", shopify_customer_id: null };
  const emailSameShopify = { id: "same", shopify_customer_id: "shop-1" };
  const shopifySame = { id: "same", shopify_customer_id: "shop-1" };
  const shopifyOnly = { id: "shopify", shopify_customer_id: "shop-1" };
  assert.deepEqual(resolveCustomerIdentityRows(null, null, "shop-1"), { status: "not_found" });
  assert.equal(resolveCustomerIdentityRows(emailNoShopify, null, "shop-1").status, "found");
  assert.equal(resolveCustomerIdentityRows(emailSameShopify, null, "shop-1").status, "found");
  assert.equal(resolveCustomerIdentityRows(emailSameShopify, null, "shop-2").status, "conflict");
  assert.deepEqual(resolveCustomerIdentityRows(null, shopifyOnly, "shop-1"), { status: "found", customer: shopifyOnly });
  assert.deepEqual(resolveCustomerIdentityRows(emailSameShopify, shopifySame, "shop-1"), { status: "found", customer: emailSameShopify });
  assert.equal(resolveCustomerIdentityRows(emailNoShopify, shopifyOnly, "shop-1").status, "conflict");
  assert.equal(resolveCustomerIdentityRows({ id: "admin", is_admin: true, shopify_customer_id: null }, shopifyOnly, "shop-1").status, "conflict");
});

test("identity conflict is a successful needs-attention result with no side effects", async () => {
  const h = harness({ identityConflict: true });
  const payload = order(line({ properties: { tracking: "new code", destination: "https://example.com" } }));
  const first = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  const second = await provisionTrackedPrintOrder({ payload, webhookEventId: "w2", dependencies: h.dependencies, registry });
  assert.equal((first.results[0] as any).status, "needs_attention"); assert.equal((first.results[0] as any).customerId, undefined);
  const item = [...h.items.values()][0];
  assert.equal(item.customer_id, null); assert.equal(item.attention_reason, "Customer account identifiers require review.");
  assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0); assert.equal(h.items.size, 1);
  assert.equal(h.activities.size, 1); assert.equal((second.results[0] as any).status, "needs_attention");
});

test("concurrent insert conflict reruns identity reconciliation and remains needs attention", async () => {
  const h = harness({ concurrentConflict: true });
  const payload = order(line({ properties: { tracking: "new code", destination: "https://example.com" } }));
  const result = await provisionTrackedPrintOrder({ payload, webhookEventId: "w1", dependencies: h.dependencies, registry });
  assert.equal((result.results[0] as any).status, "needs_attention"); assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0);
  assert.equal([...h.items.values()][0].customer_id, null);
});

test("neutral linkage patches never include protected commerce fields", () => {
  for (const plan of ["clutch_codes_starter", "clutch_codes_growth", "connect_plus", "admin"]) {
    const existing = { id: "c1", plan, plan_code: plan, is_admin: plan === "admin", included_qr_allowance: 7, subscription_qr_limit: 30, qr_limit: 37 };
    const patch = buildSafeExistingCustomerLinkagePatch(existing, { authUserId: "auth", shopifyCustomerId: "shopify", shopifyOrderId: "order" });
    assert.deepEqual(patch, { auth_user_id: "auth", shopify_customer_id: "shopify", shopify_order_id: "order" });
    for (const protectedField of ["plan","plan_code","is_admin","included_qr_allowance","subscription_qr_limit","qr_limit","clutch_codes_plan_code","clutch_codes_subscription_status"]) assert.equal(protectedField in patch, false);
  }
});

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

test("immutable replay differences are preserved and reported once", async () => {
  for (const changed of [
    { tracking: "none", destination: "https://example.com" },
    { tracking: "new code", destination: "https://changed.example.com" },
    { tracking: "existing code", "existing qr code id": "changed-qr" },
  ]) {
    const h = harness(); const original = order(line({ properties: { tracking: "new code", destination: "https://example.com" } }));
    await provisionTrackedPrintOrder({ payload: original, webhookEventId: "w1", dependencies: h.dependencies, registry });
    const replay = order(line({ properties: changed }));
    const first = await provisionTrackedPrintOrder({ payload: replay, webhookEventId: "w2", dependencies: h.dependencies, registry });
    const second = await provisionTrackedPrintOrder({ payload: replay, webhookEventId: "w3", dependencies: h.dependencies, registry });
    assert.equal((first.results[0] as any).discrepancy, true); assert.equal((second.results[0] as any).discrepancy, true);
    assert.equal(h.qrs.size, 1); assert.equal(h.activities.has("tracked-print:order-1:line-1:discrepancy"), true);
  }
});

test("an identical pending item resumes provisioning without rewriting inputs", async () => {
  const h = harness({ existingCustomer: true });
  const properties = { tracking: "new code", destination: "https://example.com" };
  h.items.set("order-1:line-1", {
    id: "item-1", customer_id: "customer-db-1", product_id: "p1", variant_id: null,
    sku: "POSTCARD-4X6", material_type: "Postcard", quantity: 1, tracking_mode: "new_included_code",
    destination_url: "https://example.com/", existing_qr_code_id: null, campaign_name: null,
    provisioning_status: "pending", attention_reason: null,
  });
  const result = await provisionTrackedPrintOrder({ payload: order(line({ properties })), webhookEventId: "w2", dependencies: h.dependencies, registry });
  assert.equal((result.results[0] as any).status, "completed"); assert.equal(h.qrs.size, 1);
});

test("tracking availability is trusted and cannot be overridden by properties", async () => {
  const disabledRegistry = [{ sku: "POSTCARD-4X6", materialType: "Postcard", defaultTrackingAvailable: false }];
  const plain = harness();
  await provisionTrackedPrintOrder({ payload: order(), webhookEventId: "w1", dependencies: plain.dependencies, registry: disabledRegistry });
  assert.equal([...plain.items.values()][0].provisioning_status, "not_required");
  for (const properties of [
    { tracking: "new code", destination: "https://example.com" },
    { tracking: "existing code", "existing qr code id": "owned" },
  ]) {
    const h = harness({ existingCustomer: true });
    await provisionTrackedPrintOrder({ payload: order(line({ properties })), webhookEventId: "w", dependencies: h.dependencies, registry: disabledRegistry });
    const item = [...h.items.values()][0];
    assert.equal(item.provisioning_status, "needs_attention"); assert.equal(item.attention_reason, "QR tracking is not available for this product configuration.");
    assert.equal(h.authCustomers, 0); assert.equal(h.qrs.size, 0);
  }
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

test("corrective migration preserves all QR types and strict existing-code eligibility", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260713031044_correct_tracked_print_safety.sql", import.meta.url), "utf8");
  for (const type of ["url","connect_profile","text","wifi","email","sms","image","pdf","vcard","smart_card","tracked_print","business_kit"]) assert.match(sql, new RegExp(`'${type}'`));
  for (const predicate of ["q.is_system = false","q.capacity_source = 'subscription'","q.counts_toward_capacity = true","q.customer_can_edit_destination = true","q.is_active = true"]) assert.match(sql, new RegExp(predicate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("neutral customer implementation uses paginated Auth lookup and insert-conflict reuse", () => {
  const source = fs.readFileSync(new URL("../lib/tracked-print-supabase.ts", import.meta.url), "utf8");
  assert.match(source, /for \(let page = 1; page <= 100; page\+\+\)/);
  assert.doesNotMatch(source, /\.or\(/); assert.doesNotMatch(source, /from\("customers"\)\.upsert/);
  assert.match(source, /error\.code !== "23505"/); assert.match(source, /resolveCustomerIdentity/);
  assert.ok(source.indexOf('from("customers").insert(neutral)') < source.lastIndexOf("ensureAuthUser(admin, normalizedEmail, name)"));
});

test("production trusted registry defaults to no eligible products", () => {
  assert.equal(classifyPrintProduct({ sku: "POSTCARD-4X6" }, []).eligible, false);
});

test("orders-paid retains HMAC and email kill-switch paths while integrating tracked print", () => {
  const source = fs.readFileSync(new URL("../app/api/webhooks/shopify/orders-paid/route.ts", import.meta.url), "utf8");
  assert.match(source, /verifyShopifyHmac/); assert.match(source, /SEND_ONBOARDING_EMAILS/); assert.match(source, /provisionClutchCodesPaidOrder/);
  assert.match(source, /provisionTrackedPrintOrder/); assert.match(source, /isSmartCardLineItem/);
});
