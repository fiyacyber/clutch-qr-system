import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildClutchCodesCancellationPatch,
  CLUTCH_CODES_PLANS,
  classifyLegacyAllowance,
  detectClutchCodesSubscription,
  getEffectiveClutchCodesCapacity,
  extractShopifySubscriptionContractId,
  normalizeClutchCodesPlanCode,
  provisionClutchCodesPaidOrder,
  type ClutchCodesCustomerRecord,
  type ClutchCodesProvisioningDependencies,
  type ShopifyPaidOrder,
} from "../lib/clutch-codes.ts";
import { detectExtensionPlan, EXTENSION_COPY } from "../shopify-extensions/clutch-codes-onboarding/src/plans.ts";

const migrationSql = fs.readFileSync(
  new URL("../supabase/migrations/20260712100000_add_clutch_codes_allowances_and_sources.sql", import.meta.url),
  "utf8"
);
const cleanSchemaSql = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const preflightSql = fs.readFileSync(
  new URL("../supabase/preflight/20260712100000_classify_clutch_codes_allowances.sql", import.meta.url),
  "utf8"
);
const contractLifecycleSource = fs.readFileSync(
  new URL("../lib/clutch-codes-supabase.ts", import.meta.url),
  "utf8"
);
const ordersPaidWebhookSource = fs.readFileSync(
  new URL("../app/api/webhooks/shopify/orders-paid/route.ts", import.meta.url),
  "utf8"
);

function orderForSku(sku: string, overrides: Partial<ShopifyPaidOrder> = {}): ShopifyPaidOrder {
  return {
    id: "order-1001",
    financial_status: "paid",
    email: "customer@example.com",
    customer: { id: "shopify-customer-1", email: "customer@example.com", first_name: "Casey" },
    line_items: [{ id: "line-1", sku, title: sku }],
    ...overrides,
  };
}

function createMemoryDependencies({
  customer,
  failProvisioning = false,
}: {
  customer?: (ClutchCodesCustomerRecord & Record<string, any>) | null;
  failProvisioning?: boolean;
} = {}) {
  const state = {
    customers: customer ? [structuredClone(customer)] : [] as Array<ClutchCodesCustomerRecord & Record<string, any>>,
    events: new Set<string>(),
    sent: [] as any[],
    generatedLinks: [] as string[],
    authUsersCreated: 0,
  };

  const dependencies: ClutchCodesProvisioningDependencies = {
    async claimEvent(input) {
      if (state.events.has(input.eventKey)) return "duplicate";
      state.events.add(input.eventKey);
      return "claimed";
    },
    async findCustomer(email, shopifyCustomerId) {
      return state.customers.find(
        (candidate) => candidate.email === email || candidate.shopify_customer_id === shopifyCustomerId
      ) || null;
    },
    async ensureAuthUser() {
      state.authUsersCreated += 1;
      return { authUserId: `auth-${state.authUsersCreated}`, created: true };
    },
    async saveSubscription(input) {
      if (failProvisioning) throw new Error("database unavailable");
      const included = Number(input.existingCustomer?.included_qr_allowance || 0);
      const record = input.existingCustomer || {
        id: `customer-${state.customers.length + 1}`,
        email: input.email,
        included_qr_allowance: 0,
        plan_code: "connect_basic",
      };
      Object.assign(record, {
        auth_user_id: input.authUserId,
        email: input.email,
        shopify_customer_id: input.shopifyCustomerId,
        shopify_order_id: input.shopifyOrderId,
        shopify_line_item_id: input.shopifyLineItemId,
        shopify_subscription_id: input.shopifySubscriptionContractId,
        clutch_codes_plan_code: input.plan.code,
        clutch_codes_subscription_status: "active",
        subscription_qr_limit: input.plan.allowance,
        qr_limit: included + input.plan.allowance,
      });
      if (!input.existingCustomer) state.customers.push(record as any);
      return record as ClutchCodesCustomerRecord;
    },
    async generateSecureAccessUrl(email) {
      const link = `https://project.supabase.co/auth/v1/verify?type=recovery&email=${encodeURIComponent(email)}`;
      state.generatedLinks.push(link);
      return link;
    },
    async reserveWelcomeEmail(customerId, eventKey) {
      const record = state.customers.find((candidate) => candidate.id === customerId)!;
      if (record.clutch_codes_welcome_email_sent_at) return false;
      if (record.clutch_codes_welcome_email_event_key && record.clutch_codes_welcome_email_event_key !== eventKey) {
        return false;
      }
      record.clutch_codes_welcome_email_event_key = eventKey;
      return true;
    },
    async sendAccessEmail(input) {
      state.sent.push(input);
    },
    async markWelcomeEmailSent(customerId) {
      const record = state.customers.find((candidate) => candidate.id === customerId)!;
      record.clutch_codes_welcome_email_sent_at = new Date().toISOString();
    },
    async releaseWelcomeEmail(customerId) {
      const record = state.customers.find((candidate) => candidate.id === customerId)!;
      record.clutch_codes_welcome_email_event_key = null;
    },
    async completeEvent() {},
    async failEvent() {},
  };
  return { state, dependencies };
}

for (const [label, sku, expected] of [
  ["Starter", "CLUTCH-CODES-STARTER", 10],
  ["Growth", "CLUTCH-CODES-GROWTH", 30],
  ["Pro", "CLUTCH-CODES-PRO", 100],
] as const) {
  test(`${label} provisions ${expected} subscription codes`, async () => {
    const { state, dependencies } = createMemoryDependencies();
    const result = await provisionClutchCodesPaidOrder({
      payload: orderForSku(sku),
      webhookEventId: `event-${label}`,
      dependencies,
    });
    assert.equal(result.effectiveCapacity, expected);
    assert.equal(state.customers[0].subscription_qr_limit, expected);
  });
}

test("included and subscription allowances combine without changing included capacity", async () => {
  const existing = {
    id: "customer-existing",
    email: "customer@example.com",
    auth_user_id: "auth-existing",
    included_qr_allowance: 7,
    subscription_qr_limit: 0,
    qr_limit: 7,
    plan_code: "connect_basic",
  };
  const { state, dependencies } = createMemoryDependencies({ customer: existing });
  const result = await provisionClutchCodesPaidOrder({
    payload: orderForSku("CLUTCH-CODES-GROWTH"),
    webhookEventId: "event-combined",
    dependencies,
  });
  assert.equal(state.customers[0].included_qr_allowance, 7);
  assert.equal(result.effectiveCapacity, 37);
  assert.equal(getEffectiveClutchCodesCapacity(state.customers[0]), 37);
});

test("duplicate webhook does not grant capacity twice", async () => {
  const { state, dependencies } = createMemoryDependencies();
  const payload = orderForSku("CLUTCH-CODES-STARTER");
  await provisionClutchCodesPaidOrder({ payload, webhookEventId: "event-duplicate", dependencies });
  const duplicate = await provisionClutchCodesPaidOrder({ payload, webhookEventId: "event-duplicate", dependencies });
  assert.equal(duplicate.duplicate, true);
  assert.equal(state.customers[0].subscription_qr_limit, 10);
  assert.equal(state.sent.length, 1);
});

test("duplicate webhook does not resend the access email", async () => {
  const { state, dependencies } = createMemoryDependencies();
  const payload = orderForSku("CLUTCH-CODES-GROWTH", { id: "order-email-idempotency" });
  await provisionClutchCodesPaidOrder({ payload, webhookEventId: "event-email-1", dependencies });
  await provisionClutchCodesPaidOrder({ payload, webhookEventId: "event-email-2", dependencies });
  assert.equal(state.sent.length, 1);
  assert.equal(state.customers[0].clutch_codes_welcome_email_sent_at != null, true);
});

test("existing customer is updated instead of duplicated", async () => {
  const { state, dependencies } = createMemoryDependencies({
    customer: {
      id: "existing-id",
      email: "customer@example.com",
      auth_user_id: "auth-existing",
      included_qr_allowance: 2,
      plan_code: "connect_basic",
    },
  });
  const result = await provisionClutchCodesPaidOrder({
    payload: orderForSku("CLUTCH-CODES-PRO"),
    webhookEventId: "event-existing",
    dependencies,
  });
  assert.equal(result.existingCustomer, true);
  assert.equal(state.customers.length, 1);
  assert.equal(state.customers[0].id, "existing-id");
});

test("new customer receives a secure setup link", async () => {
  const { state, dependencies } = createMemoryDependencies();
  await provisionClutchCodesPaidOrder({
    payload: orderForSku("CLUTCH-CODES-STARTER"),
    webhookEventId: "event-secure-link",
    dependencies,
  });
  assert.match(state.sent[0].accessUrl, /supabase\.co\/auth\/v1\/verify/);
  assert.equal(state.generatedLinks.length, 1);
});

test("unknown SKU grants no Clutch Codes subscription", async () => {
  const { state, dependencies } = createMemoryDependencies();
  const result = await provisionClutchCodesPaidOrder({
    payload: orderForSku("UNRELATED-SKU"),
    webhookEventId: "event-unknown",
    dependencies,
  });
  assert.equal(result.qualified, false);
  assert.equal(state.customers.length, 0);
  assert.equal(state.sent.length, 0);
});

test("failed provisioning sends no success email", async () => {
  const { state, dependencies } = createMemoryDependencies({ failProvisioning: true });
  await assert.rejects(
    provisionClutchCodesPaidOrder({
      payload: orderForSku("CLUTCH-CODES-STARTER"),
      webhookEventId: "event-failure",
      dependencies,
    }),
    /database unavailable/
  );
  assert.equal(state.sent.length, 0);
});

test("Clutch Codes entitlement does not grant or replace Clutch Connect+", async () => {
  const { state, dependencies } = createMemoryDependencies({
    customer: {
      id: "basic-customer",
      email: "customer@example.com",
      auth_user_id: "auth-basic",
      included_qr_allowance: 1,
      plan_code: "connect_basic",
    },
  });
  await provisionClutchCodesPaidOrder({
    payload: orderForSku("CLUTCH-CODES-GROWTH"),
    webhookEventId: "event-no-connect-plus",
    dependencies,
  });
  assert.equal(state.customers[0].plan_code, "connect_basic");
  assert.equal(state.customers[0].clutch_codes_plan_code, "clutch_codes_growth");
});

test("Smart Business Card orders remain outside the Clutch Codes pipeline", () => {
  assert.equal(detectClutchCodesSubscription([{ sku: "SMART-CARD", title: "Smart Business Card" }]), null);
});

test("cancellation clears only subscription capacity", () => {
  const customer = {
    id: "customer-cancel",
    email: "cancel@example.com",
    included_qr_allowance: 6,
    subscription_qr_limit: 100,
    qr_limit: 106,
  };
  const patch = buildClutchCodesCancellationPatch(customer);
  assert.equal(patch.subscription_qr_limit, 0);
  assert.equal(patch.qr_limit, 6);
  assert.equal(customer.included_qr_allowance, 6);
});

test("extension renders only for the three canonical SKUs", () => {
  for (const plan of Object.values(CLUTCH_CODES_PLANS)) {
    assert.equal(detectExtensionPlan([{ merchandise: { sku: plan.sku } }])?.sku, plan.sku);
  }
  assert.equal(detectExtensionPlan([{ merchandise: { sku: "SMART-CARD" } }]), null);
  assert.equal(detectExtensionPlan([{ merchandise: { sku: "CLUTCH-CONNECT-PLUS" } }]), null);
});

test("legacy qr_pro normalizes to the current Pro compatibility plan", () => {
  assert.equal(normalizeClutchCodesPlanCode("qr_pro"), "clutch_codes_pro");
});

test("new Clutch Codes customer insert is compatible with canonical plan constraints", () => {
  const supported = [
    "free_qr",
    "connect_basic",
    "connect_plus",
    "qr_pro",
    "qr_pro_plus",
    "agency",
    "admin",
  ];
  for (const plan of supported) {
    assert.match(migrationSql, new RegExp(`['\"]${plan}['\"]`));
    assert.match(cleanSchemaSql, new RegExp(`['\"]${plan}['\"]`));
  }
  assert.match(migrationSql, /values\s*\([\s\S]*'connect_basic',\s*'connect_basic',\s*0,\s*0[\s\S]*\)/i);
});

test("clean schema starts with zero included and subscription allowance", () => {
  assert.match(cleanSchemaSql, /included_qr_allowance integer not null default 0/i);
  assert.match(cleanSchemaSql, /subscription_qr_limit integer not null default 0/i);
  assert.doesNotMatch(cleanSchemaSql, /included_qr_allowance integer not null default 10/i);
});

test("legacy paid-looking capacity without a contract ID is not made permanent included capacity", () => {
  const result = classifyLegacyAllowance({
    isAdmin: false,
    plan: "qr_pro",
    planCode: "qr_pro",
    subscriptionStatus: "active",
    hasShopifySubscriptionId: false,
    hasPaidClutchCodesOrder: true,
    qrLimit: 100,
    existingQrCount: 3,
    confirmedCardOrderCount: 0,
  });
  assert.equal(result.reviewRequired, true);
  assert.equal(result.includedQrAllowance, 0);
  assert.equal(result.subscriptionQrLimit, 0);
  assert.equal(result.classification, "manual_review_paid_order_without_contract");
  assert.doesNotMatch(
    migrationSql,
    /set\s+included_qr_allowance\s*=\s*greatest\s*\(\s*coalesce\s*\(\s*qr_limit/i
  );
});

test("ambiguous legacy rows are surfaced for manual review", () => {
  const result = classifyLegacyAllowance({
    isAdmin: false,
    plan: "qr_pro_plus",
    planCode: "qr_pro_plus",
    subscriptionStatus: "active",
    hasShopifySubscriptionId: false,
    hasPaidClutchCodesOrder: false,
    qrLimit: 60,
    existingQrCount: 0,
    confirmedCardOrderCount: 0,
  });
  assert.equal(result.reviewRequired, true);
  assert.match(result.classification, /^manual_review_/);
  assert.match(migrationSql, /clutch_codes_allowance_migration_audit/);
  assert.match(migrationSql, /audit\.review_required\s*=\s*false/i);
  assert.match(preflightSql, /review_required/);
});

test("extension confirms the order without claiming dashboard provisioning succeeded", () => {
  assert.equal(EXTENSION_COPY.heading, "Your Clutch Codes order is confirmed");
  assert.equal(
    EXTENSION_COPY.body,
    "We’re preparing your dashboard access using the email entered during checkout."
  );
  assert.doesNotMatch(`${EXTENSION_COPY.heading} ${EXTENSION_COPY.body}`, /dashboard access is ready/i);
});

test("unverified order fields do not create a false subscription contract linkage", () => {
  const payload = orderForSku("CLUTCH-CODES-PRO", {
    subscription_contract_id: "gid://shopify/SubscriptionContract/unverified",
    subscription_id: "also-unverified",
    line_items: [
      {
        id: "line-1",
        sku: "CLUTCH-CODES-PRO",
        selling_plan_allocation: { subscription_contract_id: "still-unverified" },
      },
    ],
  });
  assert.equal(extractShopifySubscriptionContractId(payload, payload.line_items?.[0]), null);
});

test("all subscription-contract lifecycle processing stays disabled behind one proof flag", () => {
  assert.match(contractLifecycleSource, /ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS/);
  assert.doesNotMatch(contractLifecycleSource, /ENABLE_CLUTCH_CODES_CONTRACT_UPDATES/);
  assert.match(
    contractLifecycleSource,
    /if\s*\(!lifecycleEnabled\)\s*\{[\s\S]*All contract lifecycle handling is disabled/
  );
});

test("transient orders-paid persistence failures return a retryable server error", () => {
  for (const errorMessage of [
    "Webhook id lookup failed.",
    "Failed to store webhook idempotency record.",
    "Failed to upsert shopify_orders.",
    "Failed to insert card_orders.",
  ]) {
    const escaped = errorMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      ordersPaidWebhookSource,
      new RegExp(`${escaped}[\\s\\S]{0,800}status:\\s*500`),
      `${errorMessage} must allow Shopify to retry`
    );
  }
});
