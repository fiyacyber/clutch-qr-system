import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { isEmailConfigured, sendTransactionalEmail } from "@/lib/email";
import { buildOnboardingEmailTemplate } from "@/lib/email-templates";
import { PLAN_DEFINITIONS, type CanonicalPlanCode, type SupportedPlanCode, normalizePlanCode } from "@/lib/plans";

type ProvisioningPlan = Exclude<CanonicalPlanCode, "admin">;
type OnboardingEmailPlanCode = Exclude<SupportedPlanCode, "admin">;

export type ShopifyWebhookTopic =
  | "orders/paid"
  | "checkouts/create"
  | "checkouts/update"
  | "subscriptions/create"
  | "subscriptions/update"
  | "subscriptions/cancelled"
  | "app_subscriptions/create"
  | "app_subscriptions/update"
  | "app_subscriptions/cancelled"
  | string;

export type ShopifyProvisioningResult = {
  qualified: boolean;
  email?: string;
  planCode?: ProvisioningPlan;
  customerId?: string;
  authUserId?: string;
  temporaryPassword?: string;
  emailSent?: boolean;
  emailError?: string;
  existingCustomer?: boolean;
  skippedReason?: string;
};

const CONNECT_BASIC_PRODUCT_KEYWORDS = [
  "smart business card",
  "clutch smart business card",
  "nfc business card",
  "clutch connect card",
  "digital business card",
  "business kit",
  "starter kit",
  "growth kit",
  "qualifying print order",
  "clutch connect",
  "connect hosting",
];

const CONNECT_PLUS_PRODUCT_KEYWORDS = [
  "clutch connect+",
  "clutch connect plus",
  "connect+",
  "connect plus",
  "connect subscription",
  "clutch connect subscription",
  "advanced profile",
  "premium profile",
  "profile builder upgrade",
  "lead inbox upgrade",
];

const QR_PRO_PRODUCT_KEYWORDS = [
  "qr pro",
  "qr-pro",
  "qrpro",
  "qr pro subscription",
  "dynamic qr subscription",
  "qr campaign tracking",
  "100 qr codes",
  "qr tracking plan",
  "qr analytics plan",
];

const AGENCY_PRODUCT_KEYWORDS = [
  "agency",
  "agency plan",
  "agency kit",
  "custom kit",
  "multi-client",
  "client reporting",
  "250 qr codes",
  "high volume qr",
  "custom onboarding",
];

const QR_PRO_TRIAL_KEYWORDS = [
  "qr pro trial",
  "30 days qr pro",
  "30 day qr pro",
  "qr pro included",
  "includes qr pro",
];

const FREE_QR_MINIMUM_CENTS = 4500;
const MIN_TEMP_PASSWORD_LENGTH = 16;
const CLUTCH_CONNECT_TRIAL_DAYS = 30;

function isTrialPurchaseTopic(topic: ShopifyWebhookTopic) {
  return topic === "orders/paid";
}

function isCheckoutTopic(topic: ShopifyWebhookTopic) {
  return topic.startsWith("checkouts/");
}

function isSubscriptionTopic(topic: ShopifyWebhookTopic) {
  return topic.includes("subscription");
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function normalizeMoneyToCents(value: unknown) {
  if (typeof value === "number") return Math.round(value * 100);
  const parsed = Number(String(value || "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function getLineItems(payload: any) {
  return Array.isArray(payload?.line_items)
    ? payload.line_items
    : Array.isArray(payload?.lineItems)
      ? payload.lineItems
      : [];
}

function itemText(item: any) {
  return [
    item?.title,
    item?.name,
    item?.product_title,
    item?.variant_title,
    item?.sku,
    item?.product_id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildPayloadSearchText(payload: any) {
  const lineItems = getLineItems(payload);
  const payloadText = [
    payload?.name,
    payload?.title,
    payload?.product_title,
    payload?.variant_title,
    payload?.subscription_name,
    payload?.plan_name,
    payload?.line_item?.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return `${lineItems.map(itemText).join(" ")} ${payloadText}`.toLowerCase();
}

function getOrderTotalCents(payload: any) {
  return normalizeMoneyToCents(
    payload?.total_price ||
      payload?.totalPrice ||
      payload?.current_total_price ||
      payload?.subtotal_price ||
      payload?.total_line_items_price
  );
}

function getShopifyCustomerId(payload: any) {
  const id =
    payload?.customer?.id ||
    payload?.customer_id ||
    payload?.customerId ||
    payload?.admin_graphql_api_customer_id ||
    payload?.customer?.admin_graphql_api_id;
  return id ? String(id) : null;
}

function getShopifyOrderId(payload: any) {
  const id = payload?.id || payload?.order_id || payload?.orderId || payload?.admin_graphql_api_id;
  return id ? String(id) : null;
}

function getShopifySubscriptionId(payload: any) {
  const id =
    payload?.subscription_id ||
    payload?.subscriptionId ||
    payload?.admin_graphql_api_id ||
    payload?.id;
  return id ? String(id) : null;
}

export function getWebhookEventId(req: Request, payload: any) {
  return (
    req.headers.get("x-shopify-event-id") ||
    req.headers.get("x-shopify-webhook-id") ||
    payload?.admin_graphql_api_id ||
    payload?.id ||
    crypto.randomUUID()
  ).toString();
}

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) throw new Error("SHOPIFY_WEBHOOK_SECRET is not configured.");
  if (!hmacHeader) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader);

  if (digestBuffer.length !== headerBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}

export function detectPlanFromShopifyPayload(payload: any): ProvisioningPlan | null {
  const lineText = buildPayloadSearchText(payload);

  // Priority: Agency > QR Pro > Connect+ > Connect Basic > no qualifying plan.
  if (includesKeyword(lineText, AGENCY_PRODUCT_KEYWORDS)) return "agency";
  if (includesKeyword(lineText, QR_PRO_PRODUCT_KEYWORDS)) return "qr_pro";
  if (includesKeyword(lineText, CONNECT_PLUS_PRODUCT_KEYWORDS)) return "connect_plus";
  if (includesKeyword(lineText, CONNECT_BASIC_PRODUCT_KEYWORDS)) return "connect_basic";

  if (getOrderTotalCents(payload) >= FREE_QR_MINIMUM_CENTS) return "connect_basic";
  return null;
}

function hasExplicitQrProTrialAccess(payload: any) {
  return includesKeyword(buildPayloadSearchText(payload), QR_PRO_TRIAL_KEYWORDS);
}

export function normalizeSubscriptionStatus(topic: ShopifyWebhookTopic, payload: any) {
  const status = String(
    payload?.subscription_status ||
      payload?.status ||
      payload?.financial_status ||
      "active"
  ).toLowerCase();

  if (topic.includes("cancel")) return "cancelled";
  if (["cancelled", "canceled", "past_due", "unpaid", "active"].includes(status)) return status;
  if (status === "paid") return "active";
  return "active";
}

export function generateTemporaryPassword() {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?";
  const all = upper + lower + digits + symbols;

  const getRandom = (chars: string) => chars[crypto.randomInt(0, chars.length)];
  const passwordChars = [
    getRandom(upper),
    getRandom(lower),
    getRandom(digits),
    getRandom(symbols),
  ];

  while (passwordChars.length < MIN_TEMP_PASSWORD_LENGTH) {
    passwordChars.push(getRandom(all));
  }

  return passwordChars.sort(() => crypto.randomInt(0, 3) - 1).join("");
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 1000) break;
  }

  return null;
}

async function createOrFindAuthUser(admin: SupabaseClient, email: string, temporaryPassword: string) {
  const created = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (!created.error) return created.data.user?.id || null;

  if (!created.error.message?.toLowerCase().includes("already")) {
    throw created.error;
  }

  return findAuthUserByEmail(admin, email);
}

export async function sendCustomerOnboardingEmail({
  email,
  temporaryPassword,
  planCode,
  idempotencyKey,
  trialEndsAt,
}: {
  email: string;
  temporaryPassword: string;
  planCode: OnboardingEmailPlanCode;
  idempotencyKey: string;
  trialEndsAt?: string | null;
}) {
  const portalUrl = process.env.CLUTCH_QR_BASE_URL || "https://qr.clutchprintshop.com";
  const loginUrl = `${portalUrl}/login?email=${encodeURIComponent(email)}`;
  const normalizedPlanCode = normalizePlanCode(planCode) as CanonicalPlanCode;
  const plan = PLAN_DEFINITIONS[normalizedPlanCode];

  const introByPlan: Record<ProvisioningPlan, string> = {
    connect_basic:
      "Your order includes a free Clutch Connect Basic profile. Use it with your NFC card, QR code, or social bio.",
    connect_plus:
      "Your Clutch Connect+ account is ready. You now have access to advanced profile customization, lead capture, and profile analytics.",
    qr_pro:
      "Your QR Pro account is ready. You can create and track up to 100 dynamic QR codes for print and marketing campaigns.",
    agency:
      "Your Agency account is ready. You have access to higher QR limits, advanced reporting, and client/campaign management tools.",
  };

  const subjectByPlan: Record<ProvisioningPlan, string> = {
    connect_basic: "Welcome to Clutch Connect Basic",
    connect_plus: "Welcome to Clutch Connect+",
    qr_pro: "Welcome to QR Pro",
    agency: "Welcome to Clutch Agency",
  };

  const trialCopy = trialEndsAt
    ? ` You also have temporary QR Pro trial access through ${new Date(trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
    : "";

  const intro = `${introByPlan[normalizedPlanCode as ProvisioningPlan]}${trialCopy}`;
  const message = buildOnboardingEmailTemplate({
    email,
    temporaryPassword,
    planName: plan.name,
    intro,
    loginUrl,
    trialEndsAt,
  });

  if (isEmailConfigured()) {
    await sendTransactionalEmail({
      to: email,
      subject: subjectByPlan[normalizedPlanCode as ProvisioningPlan],
      text: message.text,
      html: message.html,
      idempotencyKey,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("ONBOARDING EMAIL (DEV):", message.text);
    return;
  }

  throw new Error("Email configuration is missing.");
}

function shouldUpgradePlan(existingCustomer: any, nextPlanCode: ProvisioningPlan) {
  if (!existingCustomer) return true;
  if (existingCustomer.is_admin || normalizePlanCode(existingCustomer.plan_code || existingCustomer.plan) === "admin") return false;

  const currentPlan = normalizePlanCode(existingCustomer.plan_code || existingCustomer.plan) as CanonicalPlanCode;
  const rank: Record<CanonicalPlanCode, number> = {
    connect_basic: 1,
    connect_plus: 2,
    qr_pro: 3,
    agency: 4,
    admin: 5,
  };

  return rank[nextPlanCode] >= (rank[currentPlan] || rank.connect_basic);
}

export async function provisionCustomerFromShopify({
  admin,
  topic,
  payload,
}: {
  admin: SupabaseClient;
  topic: ShopifyWebhookTopic;
  payload: any;
}): Promise<ShopifyProvisioningResult> {
  if (isCheckoutTopic(topic)) {
    return { qualified: false, skippedReason: "Checkout is not paid yet; waiting for orders/paid." };
  }

  const purchaseQualifiesForTrial = isTrialPurchaseTopic(topic) && hasExplicitQrProTrialAccess(payload);
  const detectedPlan = detectPlanFromShopifyPayload(payload);
  if (!detectedPlan) return { qualified: false, skippedReason: "No qualifying Clutch Connect or QR plan was found." };

  const email = String(payload?.email || payload?.customer?.email || payload?.billing_address?.email || "")
    .trim()
    .toLowerCase();

  if (!email) return { qualified: false, skippedReason: "Missing checkout/order email." };

  const { data: existingCustomer, error: lookupError } = await admin
    .from("customers")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const planCode = shouldUpgradePlan(existingCustomer, detectedPlan)
    ? detectedPlan
    : (normalizePlanCode(existingCustomer?.plan_code || existingCustomer?.plan) as ProvisioningPlan);
  const plan = PLAN_DEFINITIONS[planCode];
  const temporaryPassword = generateTemporaryPassword();
  const authUserId =
    existingCustomer?.auth_user_id ||
    (await createOrFindAuthUser(admin, email, temporaryPassword));

  if (!authUserId) throw new Error(`Unable to create or find Supabase auth user for ${email}.`);

  const shopifyOrderId = getShopifyOrderId(payload);
  const shopifySubscriptionId = getShopifySubscriptionId(payload);
  const subscriptionStatus = normalizeSubscriptionStatus(topic, payload);
  const subscriptionConverted = isSubscriptionTopic(topic) && subscriptionStatus === "active";
  const firstName = String(payload?.customer?.first_name || payload?.billing_address?.first_name || "").trim() || null;
  const lastName = String(payload?.customer?.last_name || payload?.billing_address?.last_name || "").trim() || null;
  const companyName =
    String(payload?.customer?.default_address?.company || payload?.billing_address?.company || "").trim() ||
    existingCustomer?.company_name ||
    null;
  const shouldSetPassword = !existingCustomer;
  const now = new Date().toISOString();
  const hasExistingTrial = Boolean(existingCustomer?.trial_started_at || existingCustomer?.trial_ends_at);
  const shouldStartTrial = purchaseQualifiesForTrial && !hasExistingTrial && existingCustomer?.trial_status !== "converted";
  const trialStartedAt = shouldStartTrial
    ? now
    : existingCustomer?.trial_started_at || null;
  const trialEndsAt = shouldStartTrial
    ? addDays(new Date(now), CLUTCH_CONNECT_TRIAL_DAYS).toISOString()
    : existingCustomer?.trial_ends_at || null;
  const trialStatus = subscriptionConverted
    ? "converted"
    : shouldStartTrial
      ? "active"
      : existingCustomer?.trial_status || "none";

  const customerPayload = {
    auth_user_id: authUserId,
    email,
    first_name: firstName || existingCustomer?.first_name || null,
    last_name: lastName || existingCustomer?.last_name || null,
    company_name: companyName,
    shopify_customer_id: getShopifyCustomerId(payload) || existingCustomer?.shopify_customer_id || null,
    shopify_order_id: shopifyOrderId || existingCustomer?.shopify_order_id || null,
    shopify_subscription_id: shopifySubscriptionId || existingCustomer?.shopify_subscription_id || null,
    plan: planCode,
    plan_code: planCode,
    qr_limit: plan.qrLimit,
    subscription_status: subscriptionStatus,
    plan_status: subscriptionStatus === "cancelled" ? "canceled" : subscriptionStatus,
    must_change_password: shouldSetPassword ? true : Boolean(existingCustomer?.must_change_password),
    temp_password_created_at: shouldSetPassword ? now : existingCustomer?.temp_password_created_at || null,
    onboarding_status: shouldSetPassword ? "invited" : existingCustomer?.onboarding_status || "active",
    onboarding_email_sent_at: shouldSetPassword ? now : existingCustomer?.onboarding_email_sent_at || null,
    trial_started_at: trialStartedAt,
    trial_ends_at: trialEndsAt,
    trial_status: trialStatus,
    updated_at: now,
  };

  let customerId = existingCustomer?.id as string | undefined;
  if (existingCustomer) {
    const { error } = await admin
      .from("customers")
      .update(customerPayload)
      .eq("id", existingCustomer.id);
    if (error) throw error;
  } else {
    const { data, error } = await admin
      .from("customers")
      .insert(customerPayload)
      .select("id")
      .single();
    if (error) throw error;
    customerId = data.id;
  }

  let emailSent = false;
  let emailError: string | undefined;

  if (shouldSetPassword) {
    try {
      await sendCustomerOnboardingEmail({
        email,
        temporaryPassword,
        planCode,
        idempotencyKey: `shopify-onboarding-${shopifyOrderId || shopifySubscriptionId || email}`,
        trialEndsAt: shouldStartTrial ? trialEndsAt : null,
      });
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Onboarding email failed.";
      console.error("Onboarding email failed", emailError);
      await admin
        .from("customers")
        .update({
          onboarding_status: "needs_help",
          onboarding_note: emailError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);
    }
  }

  return {
    qualified: true,
    email,
    planCode,
    customerId,
    authUserId,
    temporaryPassword: shouldSetPassword ? temporaryPassword : undefined,
    emailSent,
    emailError,
    existingCustomer: Boolean(existingCustomer),
  };
}

export function getShopifyIds(payload: any) {
  return {
    orderId: getShopifyOrderId(payload),
    subscriptionId: getShopifySubscriptionId(payload),
    customerId: getShopifyCustomerId(payload),
  };
}
