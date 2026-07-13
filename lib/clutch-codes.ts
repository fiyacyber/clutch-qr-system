export const CLUTCH_CODES_DASHBOARD_URL = "https://qr.clutchprintshop.com";
export const CLUTCH_CODES_SUPPORT_EMAIL = "info@clutchprintshop.com";

export type ClutchCodesPlanCode =
  | "clutch_codes_starter"
  | "clutch_codes_growth"
  | "clutch_codes_pro";

export type ClutchCodesPlan = {
  code: ClutchCodesPlanCode;
  sku: string;
  name: string;
  monthlyPrice: string;
  allowance: number;
};

export const CLUTCH_CODES_PLANS: Record<ClutchCodesPlanCode, ClutchCodesPlan> = {
  clutch_codes_starter: {
    code: "clutch_codes_starter",
    sku: "CLUTCH-CODES-STARTER",
    name: "Clutch Codes Starter",
    monthlyPrice: "$3.99/month",
    allowance: 10,
  },
  clutch_codes_growth: {
    code: "clutch_codes_growth",
    sku: "CLUTCH-CODES-GROWTH",
    name: "Clutch Codes Growth",
    monthlyPrice: "$6.99/month",
    allowance: 30,
  },
  clutch_codes_pro: {
    code: "clutch_codes_pro",
    sku: "CLUTCH-CODES-PRO",
    name: "Clutch Codes Pro",
    monthlyPrice: "$11.99/month",
    allowance: 100,
  },
};

const PLAN_BY_SKU = new Map(
  Object.values(CLUTCH_CODES_PLANS).map((plan) => [plan.sku, plan] as const)
);

const TITLE_FALLBACKS: Array<{ pattern: RegExp; plan: ClutchCodesPlan }> = [
  { pattern: /\bclutch\s+codes?\s+starter\b/i, plan: CLUTCH_CODES_PLANS.clutch_codes_starter },
  { pattern: /\bclutch\s+codes?\s+growth\b/i, plan: CLUTCH_CODES_PLANS.clutch_codes_growth },
  { pattern: /\bclutch\s+codes?\s+pro\b/i, plan: CLUTCH_CODES_PLANS.clutch_codes_pro },
  // Compatibility only: the retired qr_pro code maps to the current 100-code plan.
  { pattern: /^qr[\s_-]*pro(?:\s+subscription)?$/i, plan: CLUTCH_CODES_PLANS.clutch_codes_pro },
];

export type ShopifySubscriptionLineItem = {
  id?: string | number;
  sku?: string | null;
  title?: string | null;
  name?: string | null;
  product_title?: string | null;
  variant_title?: string | null;
  product_id?: string | number | null;
  variant_id?: string | number | null;
  selling_plan_allocation?: Record<string, unknown> | null;
};

export type ShopifyPaidOrder = {
  id?: string | number;
  order_id?: string | number;
  admin_graphql_api_id?: string;
  email?: string | null;
  contact_email?: string | null;
  financial_status?: string | null;
  order_status_url?: string | null;
  subscription_contract_id?: string | number | null;
  subscription_id?: string | number | null;
  customer?: {
    id?: string | number;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  billing_address?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  line_items?: ShopifySubscriptionLineItem[];
  [key: string]: unknown;
};

export type ClutchCodesDetection = {
  plan: ClutchCodesPlan;
  lineItem: ShopifySubscriptionLineItem;
  matchedBy: "sku" | "title_fallback";
};

function lineItemTitle(item: ShopifySubscriptionLineItem) {
  return String(item.product_title || item.title || item.name || item.variant_title || "").trim();
}

export function normalizeClutchCodesPlanCode(value?: string | null): ClutchCodesPlanCode | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "clutch_codes_starter") return normalized;
  if (normalized === "clutch_codes_growth") return normalized;
  if (normalized === "clutch_codes_pro" || normalized === "qr_pro") return "clutch_codes_pro";
  return null;
}

export function detectClutchCodesSubscription(
  lineItems: ShopifySubscriptionLineItem[] | null | undefined
): ClutchCodesDetection | null {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const exactMatches: ClutchCodesDetection[] = items.flatMap((lineItem) => {
      const plan = PLAN_BY_SKU.get(String(lineItem.sku || "").trim().toUpperCase());
      return plan ? [{ plan, lineItem, matchedBy: "sku" as const }] : [];
    });

  if (exactMatches.length) {
    return exactMatches.sort((a, b) => b.plan.allowance - a.plan.allowance)[0];
  }

  for (const item of items) {
    const title = lineItemTitle(item);
    const fallback = TITLE_FALLBACKS.find(({ pattern }) => pattern.test(title));
    if (fallback) return { plan: fallback.plan, lineItem: item, matchedBy: "title_fallback" };
  }

  return null;
}

export function getEffectiveClutchCodesCapacity(customer?: {
  included_qr_allowance?: number | null;
  subscription_qr_limit?: number | null;
  qr_limit?: number | null;
} | null) {
  const included = Number(customer?.included_qr_allowance);
  const subscription = Number(customer?.subscription_qr_limit);
  if (Number.isFinite(included) && Number.isFinite(subscription)) {
    return Math.max(0, included) + Math.max(0, subscription);
  }

  const legacy = Number(customer?.qr_limit);
  return Number.isFinite(legacy) ? Math.max(0, legacy) : 0;
}

export function isReliablePaidOrder(payload: ShopifyPaidOrder, topic = "orders/paid") {
  if (topic !== "orders/paid") return false;
  const financialStatus = String(payload.financial_status || "").trim().toLowerCase();
  return !financialStatus || financialStatus === "paid" || financialStatus === "partially_paid";
}

export function extractShopifyOrderId(payload: ShopifyPaidOrder) {
  const value = payload.id || payload.order_id || payload.admin_graphql_api_id;
  return value == null ? null : String(value);
}

export function extractShopifyCustomerId(payload: ShopifyPaidOrder) {
  const value = payload.customer?.id;
  return value == null ? null : String(value);
}

export function extractShopifySubscriptionContractId(
  payload: ShopifyPaidOrder,
  _lineItem?: ShopifySubscriptionLineItem | null
) {
  void payload;
  void _lineItem;
  // orders/paid does not provide a contract ID in the real Shopify Subscriptions
  // payloads captured for this store. Never infer one from similarly named payload
  // fields or selling_plan_allocation. A future verified enrichment must introduce
  // an explicit trusted boundary instead of adding a guessed raw-payload mapping.
  return null;
}

export type LegacyAllowanceEvidence = {
  isAdmin: boolean;
  plan?: string | null;
  planCode?: string | null;
  subscriptionStatus?: string | null;
  hasShopifySubscriptionId: boolean;
  hasPaidClutchCodesOrder: boolean;
  qrLimit: number;
  existingQrCount: number;
  confirmedCardOrderCount: number;
};

export function classifyLegacyAllowance(evidence: LegacyAllowanceEvidence) {
  const normalizedPlan = String(evidence.planCode || evidence.plan || "").toLowerCase();
  const activePaidQrSubscription =
    evidence.hasShopifySubscriptionId &&
    String(evidence.subscriptionStatus || "").toLowerCase() === "active" &&
    ["qr_pro", "qr_pro_plus", "agency"].includes(normalizedPlan);
  const includedAllowance = Math.max(0, Math.trunc(evidence.confirmedCardOrderCount || 0));

  if (evidence.isAdmin) {
    return {
      classification: "admin_preserve" as const,
      reviewRequired: false,
      includedQrAllowance: 0,
      subscriptionQrLimit: 0,
    };
  }

  if (activePaidQrSubscription) {
    return {
      classification: includedAllowance
        ? ("active_paid_subscription_plus_confirmed_card" as const)
        : ("active_paid_subscription" as const),
      reviewRequired: false,
      includedQrAllowance: includedAllowance,
      subscriptionQrLimit: Math.max(0, Math.trunc(evidence.qrLimit || 0)),
    };
  }

  if (includedAllowance > 0) {
    return {
      classification: "confirmed_card_allowance" as const,
      reviewRequired: false,
      includedQrAllowance: includedAllowance,
      subscriptionQrLimit: 0,
    };
  }

  let classification = "manual_review_no_entitlement_source" as
    | "manual_review_no_entitlement_source"
    | "manual_review_paid_order_without_contract"
    | "manual_review_existing_qr_without_source"
    | "manual_review_legacy_paid_plan_without_subscription_id";
  if (evidence.hasPaidClutchCodesOrder) classification = "manual_review_paid_order_without_contract";
  else if (evidence.existingQrCount > 0) classification = "manual_review_existing_qr_without_source";
  else if (["qr_pro", "qr_pro_plus", "agency"].includes(normalizedPlan)) {
    classification = "manual_review_legacy_paid_plan_without_subscription_id";
  }

  return {
    classification,
    reviewRequired: true,
    includedQrAllowance: 0,
    subscriptionQrLimit: 0,
  };
}

export function extractCheckoutEmail(payload: ShopifyPaidOrder) {
  return String(
    payload.customer?.email ||
      payload.email ||
      payload.contact_email ||
      payload.billing_address?.email ||
      ""
  )
    .trim()
    .toLowerCase();
}

export function extractCustomerFirstName(payload: ShopifyPaidOrder) {
  return String(payload.customer?.first_name || payload.billing_address?.first_name || "").trim();
}

export function buildClutchCodesEventKey({
  topic,
  orderId,
  lineItemId,
  planCode,
}: {
  topic: string;
  orderId: string;
  lineItemId?: string | null;
  planCode: ClutchCodesPlanCode;
}) {
  return ["clutch-codes", topic, orderId, lineItemId || "subscription", planCode].join(":");
}

export type ClutchCodesCustomerRecord = {
  id: string;
  auth_user_id?: string | null;
  email: string;
  included_qr_allowance?: number | null;
  subscription_qr_limit?: number | null;
  qr_limit?: number | null;
  clutch_codes_plan_code?: string | null;
  clutch_codes_welcome_email_sent_at?: string | null;
  clutch_codes_welcome_email_event_key?: string | null;
};

export type ClutchCodesEventInput = {
  eventKey: string;
  webhookEventId: string;
  topic: string;
  orderId: string;
  lineItemId: string | null;
  subscriptionContractId: string | null;
  plan: ClutchCodesPlan;
  payload: ShopifyPaidOrder;
};

export type ClutchCodesProvisioningDependencies = {
  claimEvent(input: ClutchCodesEventInput): Promise<"claimed" | "duplicate">;
  findCustomer(email: string, shopifyCustomerId: string | null): Promise<ClutchCodesCustomerRecord | null>;
  ensureAuthUser(email: string, firstName: string): Promise<{ authUserId: string; created: boolean }>;
  saveSubscription(input: {
    existingCustomer: ClutchCodesCustomerRecord | null;
    authUserId: string;
    email: string;
    firstName: string;
    plan: ClutchCodesPlan;
    shopifyCustomerId: string | null;
    shopifyOrderId: string;
    shopifyLineItemId: string | null;
    shopifySubscriptionContractId: string | null;
  }): Promise<ClutchCodesCustomerRecord>;
  generateSecureAccessUrl(email: string): Promise<string>;
  reserveWelcomeEmail(customerId: string, eventKey: string): Promise<boolean>;
  sendAccessEmail(input: {
    to: string;
    firstName: string;
    plan: ClutchCodesPlan;
    accessUrl: string;
    manageSubscriptionUrl: string | null;
    idempotencyKey: string;
  }): Promise<void>;
  markWelcomeEmailSent(customerId: string, eventKey: string): Promise<void>;
  releaseWelcomeEmail(customerId: string, eventKey: string): Promise<void>;
  completeEvent(eventKey: string, input: { customerId: string; emailSent: boolean }): Promise<void>;
  failEvent(eventKey: string, errorMessage: string): Promise<void>;
};

export type ClutchCodesProvisioningResult = {
  qualified: boolean;
  duplicate?: boolean;
  skippedReason?: string;
  planCode?: ClutchCodesPlanCode;
  customerId?: string;
  emailSent?: boolean;
  existingCustomer?: boolean;
  authUserCreated?: boolean;
  effectiveCapacity?: number;
};

export async function provisionClutchCodesPaidOrder({
  payload,
  webhookEventId,
  dependencies,
  topic = "orders/paid",
}: {
  payload: ShopifyPaidOrder;
  webhookEventId: string;
  dependencies: ClutchCodesProvisioningDependencies;
  topic?: string;
}): Promise<ClutchCodesProvisioningResult> {
  if (!isReliablePaidOrder(payload, topic)) {
    return { qualified: false, skippedReason: "Clutch Codes access requires a reliable paid order event." };
  }

  const detection = detectClutchCodesSubscription(payload.line_items);
  if (!detection) {
    return { qualified: false, skippedReason: "No canonical Clutch Codes subscription SKU was found." };
  }

  const email = extractCheckoutEmail(payload);
  const orderId = extractShopifyOrderId(payload);
  if (!email || !orderId) {
    return { qualified: false, skippedReason: "The paid order is missing its checkout email or Shopify order ID." };
  }

  const lineItemId = detection.lineItem.id == null ? null : String(detection.lineItem.id);
  const subscriptionContractId = extractShopifySubscriptionContractId(payload, detection.lineItem);
  const eventKey = buildClutchCodesEventKey({
    topic,
    orderId,
    lineItemId,
    planCode: detection.plan.code,
  });
  const claimed = await dependencies.claimEvent({
    eventKey,
    webhookEventId,
    topic,
    orderId,
    lineItemId,
    subscriptionContractId,
    plan: detection.plan,
    payload,
  });

  if (claimed === "duplicate") {
    return { qualified: true, duplicate: true, planCode: detection.plan.code, emailSent: false };
  }

  try {
    const existingCustomer = await dependencies.findCustomer(email, extractShopifyCustomerId(payload));
    const firstName = extractCustomerFirstName(payload);
    const auth = existingCustomer?.auth_user_id
      ? { authUserId: existingCustomer.auth_user_id, created: false }
      : await dependencies.ensureAuthUser(email, firstName);
    const customer = await dependencies.saveSubscription({
      existingCustomer,
      authUserId: auth.authUserId,
      email,
      firstName,
      plan: detection.plan,
      shopifyCustomerId: extractShopifyCustomerId(payload),
      shopifyOrderId: orderId,
      shopifyLineItemId: lineItemId,
      shopifySubscriptionContractId: subscriptionContractId,
    });

    let emailSent = false;
    if (!customer.clutch_codes_welcome_email_sent_at) {
      const reserved = await dependencies.reserveWelcomeEmail(customer.id, eventKey);
      if (reserved) {
        try {
          const accessUrl = await dependencies.generateSecureAccessUrl(email);
          const managementUrl = String(payload.subscription_management_url || "").trim() || null;
          await dependencies.sendAccessEmail({
            to: email,
            firstName,
            plan: detection.plan,
            accessUrl,
            manageSubscriptionUrl: managementUrl,
            idempotencyKey: `clutch-codes-welcome-${eventKey}`,
          });
          await dependencies.markWelcomeEmailSent(customer.id, eventKey);
          emailSent = true;
        } catch (error) {
          await dependencies.releaseWelcomeEmail(customer.id, eventKey);
          throw error;
        }
      }
    }

    await dependencies.completeEvent(eventKey, { customerId: customer.id, emailSent });
    return {
      qualified: true,
      planCode: detection.plan.code,
      customerId: customer.id,
      emailSent,
      existingCustomer: Boolean(existingCustomer),
      authUserCreated: auth.created,
      effectiveCapacity: getEffectiveClutchCodesCapacity(customer),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Clutch Codes provisioning error.";
    await dependencies.failEvent(eventKey, message);
    throw error;
  }
}

export function buildClutchCodesCancellationPatch(customer: ClutchCodesCustomerRecord) {
  const includedAllowance = Math.max(0, Number(customer.included_qr_allowance || 0));
  return {
    subscription_qr_limit: 0,
    clutch_codes_subscription_status: "cancelled",
    qr_limit: includedAllowance,
  };
}
