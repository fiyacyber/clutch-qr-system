import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDefaultProfileSlug, normalizeSlug } from "@/lib/connect";
import { buildAppQrUrl, buildConnectPublicProfileUrl, getAppBaseUrl } from "@/lib/connect-urls";
import { sendTransactionalEmail } from "@/lib/email";
import { buildSmartCardSetupEmailTemplate } from "@/lib/email-templates";
import { buildSetupForgotPasswordPath } from "@/lib/onboarding-routing";
import { provisionClutchCodesPaidOrder, type ShopifyPaidOrder } from "@/lib/clutch-codes";
import { createClutchCodesSupabaseDependencies } from "@/lib/clutch-codes-supabase";

export const runtime = "nodejs";

type ShopifyLineItemProperty = {
  name?: string;
  key?: string;
  value?: unknown;
};

type ShopifyLineItem = {
  id?: number | string;
  sku?: string;
  product_id?: number | string;
  variant_id?: number | string;
  title?: string;
  product_title?: string;
  variant_title?: string;
  handle?: string;
  properties?: ShopifyLineItemProperty[] | Record<string, unknown> | null;
};

type ShopifyOrderPayload = {
  id?: number | string;
  order_id?: number | string;
  name?: string;
  order_number?: number | string;
  billing_address?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  } | null;
  shipping_address?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  } | null;
  customer?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  email?: string;
  phone?: string;
  total_price?: number | string;
  financial_status?: string;
  order_status_url?: string;
  line_items?: ShopifyLineItem[];
};

const DEFAULT_SMART_CARD_TITLE_ALLOWLIST = [
  "smart business card",
  "metal smart business card",
  "clutch smart business card",
  "clutch connect card",
];

const DEFAULT_SMART_CARD_HANDLE_ALLOWLIST = [
  "clutch-connect-card",
  "smart-business-card",
  "metal-smart-business-card",
];

function getSupabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  try {
    return url ? new URL(url).host : "missing";
  } catch {
    return "invalid";
  }
}

function createWebhookSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Server storage configuration is missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseCsvEnv(name: string): string[] {
  return String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getGuidedSetupAccessUrl(email?: string) {
  const appBase = (process.env.CLUTCH_APP_BASE_URL || "https://qr.clutchprintshop.com").replace(/\/$/, "");
  return `${appBase}${buildSetupForgotPasswordPath({ email })}`;
}

function getPortalOrdersLoginUrl(email?: string, shopifyOrderId?: string | null) {
  const appBase = (process.env.CLUTCH_APP_BASE_URL || "https://qr.clutchprintshop.com").replace(/\/$/, "");
  const nextPath = shopifyOrderId ? `/portal?order=${encodeURIComponent(shopifyOrderId)}` : "/portal";
  const withEmail = email ? `&email=${encodeURIComponent(email)}` : "";
  return `${appBase}/login?next=${encodeURIComponent(nextPath)}${withEmail}`;
}

function pickFirst(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function extractCustomerEmail(payload: ShopifyOrderPayload) {
  return pickFirst(
    payload.customer?.email,
    payload.email,
    payload.billing_address?.email,
    payload.shipping_address?.email
  ).toLowerCase();
}

function extractCustomerName(payload: ShopifyOrderPayload) {
  const firstLast = [
    payload.customer?.first_name || payload.billing_address?.first_name || payload.shipping_address?.first_name,
    payload.customer?.last_name || payload.billing_address?.last_name || payload.shipping_address?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return pickFirst(
    firstLast,
    payload.customer?.name,
    payload.billing_address?.name,
    payload.shipping_address?.name
  );
}

function extractCustomerPhone(payload: ShopifyOrderPayload) {
  return pickFirst(
    payload.customer?.phone,
    payload.phone,
    payload.billing_address?.phone,
    payload.shipping_address?.phone
  );
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null as string | null, lastName: null as string | null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function isColumnMissingError(error: any) {
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return text.includes("column") && text.includes("does not exist");
}

function isCheckConstraintError(error: any) {
  return String(error?.code || "") === "23514";
}

async function findAuthUserByEmail(admin: ReturnType<typeof createWebhookSupabaseClient>, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (match?.id) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function ensureAuthUserForEmail(
  admin: ReturnType<typeof createWebhookSupabaseClient>,
  email: string,
  customerName: string
) {
  const existingAuthUserId = await findAuthUserByEmail(admin, email);
  if (existingAuthUserId) {
    return { authUserId: existingAuthUserId, created: false };
  }

  const metadata = customerName ? { full_name: customerName } : undefined;
  const createResult = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!createResult.error && createResult.data.user?.id) {
    return { authUserId: createResult.data.user.id, created: true };
  }

  const message = String(createResult.error?.message || "").toLowerCase();
  if (message.includes("already") || message.includes("exists")) {
    const foundId = await findAuthUserByEmail(admin, email);
    return { authUserId: foundId, created: false };
  }

  // Fallback path for projects that require a password at create time.
  const randomPassword = `${crypto.randomBytes(18).toString("base64url")}Aa1!`;
  const withPassword = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomPassword,
    user_metadata: metadata,
  });

  if (!withPassword.error && withPassword.data.user?.id) {
    return { authUserId: withPassword.data.user.id, created: true };
  }

  throw withPassword.error || createResult.error || new Error("Failed to create auth user.");
}

async function generateSetupLink(
  admin: ReturnType<typeof createWebhookSupabaseClient>,
  email: string
) {
  const fallback = getGuidedSetupAccessUrl(email);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: fallback,
    },
  });

  if (error) {
    console.warn("orders-paid setup link generation failed", { message: error.message });
    return fallback;
  }

  return data?.properties?.action_link || fallback;
}

async function updateOptionalCustomerFields(
  admin: ReturnType<typeof createWebhookSupabaseClient>,
  customerId: string
) {
  const optionalUpdates: Array<Record<string, any>> = [
    { account_status: "active" },
    { guided_setup_required: true },
    { setup_step: 1 },
  ];

  for (const update of optionalUpdates) {
    const { error } = await admin.from("customers").update(update).eq("id", customerId);
    if (error && !isColumnMissingError(error)) {
      console.warn("orders-paid optional customer field update skipped", {
        field: Object.keys(update)[0],
        code: error.code,
        message: error.message,
      });
    }
  }

  const welcomeSentTry = await admin
    .from("customers")
    .update({ onboarding_status: "welcome_sent" })
    .eq("id", customerId);

  if (welcomeSentTry.error && isCheckConstraintError(welcomeSentTry.error)) {
    await admin.from("customers").update({ onboarding_status: "invited" }).eq("id", customerId);
  }
}

async function findOrCreateCustomer(
  admin: ReturnType<typeof createWebhookSupabaseClient>,
  {
    email,
    authUserId,
    customerName,
    businessName,
    shopifyCustomerId,
    shopifyOrderId,
  }: {
    email: string;
    authUserId: string;
    customerName: string;
    businessName: string | null;
    shopifyCustomerId: string | null;
    shopifyOrderId: string;
  }
) {
  const { firstName, lastName } = splitName(customerName);
  const byAuth = await admin.from("customers").select("*").eq("auth_user_id", authUserId).maybeSingle();
  if (byAuth.error) throw byAuth.error;

  const byEmail = byAuth.data
    ? { data: null, error: null }
    : await admin.from("customers").select("*").eq("email", email).maybeSingle();
  if (byEmail.error) throw byEmail.error;

  const existing = byAuth.data || byEmail.data;

  if (existing) {
    const patch: Record<string, any> = {
      auth_user_id: existing.auth_user_id || authUserId,
      email,
      shopify_customer_id: existing.shopify_customer_id || shopifyCustomerId,
      shopify_order_id: existing.shopify_order_id || shopifyOrderId,
      subscription_status: existing.subscription_status || "active",
      plan_status: existing.plan_status || "active",
    };

    if (!existing.first_name && firstName) patch.first_name = firstName;
    if (!existing.last_name && lastName) patch.last_name = lastName;
    if (!existing.company_name && businessName) patch.company_name = businessName;

    const { error } = await admin.from("customers").update(patch).eq("id", existing.id);
    if (error) throw error;

    await updateOptionalCustomerFields(admin, existing.id);
    return { customerId: existing.id as string, existing: true };
  }

  const planCandidates = [
    { plan: "connect_basic", plan_code: "connect_basic" },
    { plan: "free_qr", plan_code: "free_qr" },
    { plan: "qr_pro", plan_code: "qr_pro" },
  ];

  let inserted: any = null;
  for (const candidate of planCandidates) {
    const { data, error } = await admin
      .from("customers")
      .insert({
        auth_user_id: authUserId,
        email,
        first_name: firstName,
        last_name: lastName,
        company_name: businessName,
        shopify_customer_id: shopifyCustomerId,
        shopify_order_id: shopifyOrderId,
        plan: candidate.plan,
        plan_code: candidate.plan_code,
        subscription_status: "active",
        plan_status: "active",
        onboarding_status: "invited",
      })
      .select("id")
      .single();

    if (!error) {
      inserted = data;
      break;
    }

    if (!isCheckConstraintError(error)) {
      throw error;
    }
  }

  if (!inserted?.id) {
    const fallbackInsert = await admin
      .from("customers")
      .insert({
        auth_user_id: authUserId,
        email,
        first_name: firstName,
        last_name: lastName,
        company_name: businessName,
        shopify_customer_id: shopifyCustomerId,
        shopify_order_id: shopifyOrderId,
        subscription_status: "active",
        plan_status: "active",
        onboarding_status: "invited",
      })
      .select("id")
      .single();

    if (fallbackInsert.error) throw fallbackInsert.error;
    inserted = fallbackInsert.data;
  }

  await updateOptionalCustomerFields(admin, inserted.id);
  return { customerId: inserted.id as string, existing: false };
}

async function ensureDraftProfile(
  admin: ReturnType<typeof createWebhookSupabaseClient>,
  {
    customerId,
    customerName,
    businessName,
    title,
    phone,
    email,
  }: {
    customerId: string;
    customerName: string;
    businessName: string | null;
    title: string | null;
    phone: string | null;
    email: string;
  }
) {
  const existing = await admin
    .from("profiles")
    .select("id, slug, is_active, business_name, contact_name, title, phone, email")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id && existing.data.is_active) {
    return {
      profileId: existing.data.id as string,
      profileSlug: String(existing.data.slug || "") || null,
      created: false,
    };
  }

  if (existing.data?.id) {
    const patch: Record<string, any> = {};
    if (!existing.data.business_name && businessName) patch.business_name = businessName;
    if (!existing.data.contact_name && customerName) patch.contact_name = customerName;
    if (!existing.data.title && title) patch.title = title;
    if (!existing.data.phone && phone) patch.phone = phone;
    if (!existing.data.email && email) patch.email = email;

    if (Object.keys(patch).length) {
      await admin.from("profiles").update(patch).eq("id", existing.data.id);
    }

    return {
      profileId: existing.data.id as string,
      profileSlug: String(existing.data.slug || "") || null,
      created: false,
    };
  }

  const baseRaw = businessName || customerName || email.split("@")[0] || "clutch-connect";
  const baseSlug = normalizeSlug(baseRaw) || buildDefaultProfileSlug(baseRaw);

  let profileId: string | null = null;
  let profileSlug: string | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${crypto.randomBytes(2).toString("hex")}`;
    const slug = `${baseSlug}${suffix}`.slice(0, 64);
    const { data, error } = await admin
      .from("profiles")
      .insert({
        customer_id: customerId,
        business_name: businessName,
        contact_name: customerName || null,
        title,
        phone,
        email,
        slug,
        is_active: false,
      })
      .select("id")
      .single();

    if (!error) {
      profileId = data.id as string;
      profileSlug = slug;
      break;
    }

    if (error.code !== "23505") {
      throw error;
    }
  }

  if (!profileId) {
    const lookup = await admin.from("profiles").select("id, slug").eq("customer_id", customerId).maybeSingle();
    if (lookup.error) throw lookup.error;
    profileId = (lookup.data?.id as string) || null;
    profileSlug = String(lookup.data?.slug || "") || null;
  }

  return { profileId, profileSlug, created: Boolean(profileId) };
}

function toLower(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function verifyShopifyHmac(rawBody: string, headerHmac: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("SHOPIFY_WEBHOOK_SECRET is not configured.");
  }

  if (!headerHmac) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(headerHmac);

  if (digestBuffer.length !== headerBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}

function normalizeOrderId(payload: ShopifyOrderPayload): string {
  const id = payload.id || payload.order_id;
  return id ? String(id) : "";
}

function normalizeOrderNumber(payload: ShopifyOrderPayload): string | null {
  if (payload.name) return String(payload.name);
  if (payload.order_number !== undefined && payload.order_number !== null) {
    return String(payload.order_number);
  }
  return null;
}

function buildSmartCardDestinationUrl(profileSlug?: string | null) {
  if (profileSlug) {
    return buildConnectPublicProfileUrl(String(profileSlug));
  }
  const appBase = getAppBaseUrl();
  return `${appBase}/portal/connect/setup`;
}

function toSlugToken(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return normalized || fallback;
}

function buildSmartCardSlug(orderNumber?: string | null) {
  const shortId = crypto.randomBytes(3).toString("hex");
  const orderToken = toSlugToken(String(orderNumber || ""), "order");
  return `smart-card-${orderToken}-${shortId}`;
}

function buildSmartCardPublicUrls(slug?: string | null) {
  if (!slug) {
    return {
      qrUrl: null,
      qrPngUrl: null,
      qrSvgUrl: null,
      nfcUrl: null,
    };
  }

  const qrUrl = buildAppQrUrl(slug);

  return {
    qrUrl,
    qrPngUrl: `${qrUrl}?format=png`,
    qrSvgUrl: `${qrUrl}?format=svg`,
    nfcUrl: qrUrl,
  };
}

type SmartCardQrDiagnostics = {
  created: boolean;
  reused: boolean;
  qrCodeId: string | null;
  slug: string | null;
  qrUrl: string | null;
  qrPngUrl: string | null;
  qrSvgUrl: string | null;
  nfcUrl: string | null;
  destinationUrlSet: boolean;
};

async function ensureSystemSmartCardQr(
  admin: ReturnType<typeof createWebhookSupabaseClient>,
  {
    customerId,
    cardOrderId,
    shopifyOrderId,
    shopifyOrderNumber,
    profileId,
    profileSlug,
  }: {
    customerId: string;
    cardOrderId: string | null;
    shopifyOrderId: string;
    shopifyOrderNumber: string | null;
    profileId: string | null;
    profileSlug: string | null;
  }
): Promise<SmartCardQrDiagnostics> {
  const destinationUrl = buildSmartCardDestinationUrl(profileSlug);
  let existingQr: any = null;

  if (cardOrderId) {
    const existingByCardOrder = await admin
      .from("qr_codes")
      .select("id, slug, destination_url, profile_id, connect_profile_id, card_order_id, qr_type, is_system, name")
      .eq("card_order_id", cardOrderId)
      .maybeSingle();

    if (!existingByCardOrder.error && existingByCardOrder.data) {
      existingQr = existingByCardOrder.data;
    }
  }

  if (!existingQr) {
    const byOrderId = await admin
      .from("card_orders")
      .select("id")
      .eq("customer_id", customerId)
      .eq("shopify_order_id", shopifyOrderId)
      .limit(5);

    let matchingCardOrders = byOrderId.data || [];
    if (!matchingCardOrders.length && shopifyOrderNumber) {
      const byOrderNumber = await admin
        .from("card_orders")
        .select("id")
        .eq("customer_id", customerId)
        .eq("shopify_order_number", shopifyOrderNumber)
        .limit(5);
      matchingCardOrders = byOrderNumber.data || [];
    }

    const cardOrderIds = (matchingCardOrders || []).map((row: any) => row.id).filter(Boolean);
    if (cardOrderIds.length) {
      const existingByOrder = await admin
        .from("qr_codes")
        .select("id, slug, destination_url, profile_id, connect_profile_id, card_order_id, qr_type, is_system, name")
        .eq("customer_id", customerId)
        .eq("qr_type", "smart_card")
        .in("card_order_id", cardOrderIds)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!existingByOrder.error && existingByOrder.data) {
        existingQr = existingByOrder.data;
      }
    }
  }

  if (existingQr?.id) {
    const patch: Record<string, any> = {};
    if (existingQr.name !== "Smart Card Profile") patch.name = "Smart Card Profile";
    if (existingQr.is_system !== true) patch.is_system = true;
    if (existingQr.qr_type !== "smart_card") patch.qr_type = "smart_card";
    if (existingQr.destination_url !== destinationUrl) patch.destination_url = destinationUrl;
    if (!existingQr.card_order_id && cardOrderId) patch.card_order_id = cardOrderId;
    if (profileId && existingQr.profile_id !== profileId) patch.profile_id = profileId;
    if (profileId && existingQr.connect_profile_id !== profileId) patch.connect_profile_id = profileId;
    patch.is_active = true;

    if (Object.keys(patch).length) {
      await admin.from("qr_codes").update(patch).eq("id", existingQr.id);
    }

    const urls = buildSmartCardPublicUrls(existingQr.slug || null);

    return {
      created: false,
      reused: true,
      qrCodeId: String(existingQr.id || null),
      slug: String(existingQr.slug || null),
      qrUrl: urls.qrUrl,
      qrPngUrl: urls.qrPngUrl,
      qrSvgUrl: urls.qrSvgUrl,
      nfcUrl: urls.nfcUrl,
      destinationUrlSet: true,
    };
  }

  let created: any = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = buildSmartCardSlug(shopifyOrderNumber || shopifyOrderId);
    const insertPayload: Record<string, any> = {
      customer_id: customerId,
      card_order_id: cardOrderId,
      name: "Smart Card Profile",
      qr_type: "smart_card",
      is_system: true,
      is_active: true,
      slug,
      destination_url: destinationUrl,
      profile_id: profileId,
      connect_profile_id: profileId,
    };

    const insertResult = await admin
      .from("qr_codes")
      .insert(insertPayload)
      .select("id, slug")
      .single();

    if (!insertResult.error) {
      created = insertResult.data;
      break;
    }

    if (insertResult.error.code !== "23505") {
      throw insertResult.error;
    }
  }

  const urls = buildSmartCardPublicUrls(created?.slug || null);

  return {
    created: Boolean(created?.id),
    reused: false,
    qrCodeId: created?.id || null,
    slug: created?.slug || null,
    qrUrl: urls.qrUrl,
    qrPngUrl: urls.qrPngUrl,
    qrSvgUrl: urls.qrSvgUrl,
    nfcUrl: urls.nfcUrl,
    destinationUrlSet: Boolean(created?.id),
  };
}

function normalizePropertyMap(
  properties: ShopifyLineItemProperty[] | Record<string, unknown> | null | undefined
): Record<string, string> {
  const output: Record<string, string> = {};

  if (Array.isArray(properties)) {
    for (const entry of properties) {
      const key = String(entry?.name || entry?.key || "").trim();
      if (!key) continue;
      output[key] = String(entry?.value ?? "").trim();
    }
    return output;
  }

  if (properties && typeof properties === "object") {
    for (const [key, value] of Object.entries(properties)) {
      if (!key) continue;
      output[String(key).trim()] = String(value ?? "").trim();
    }
  }

  return output;
}

function truthyValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "y", "requested", "on"].includes(normalized);
}

function isSmartCardLineItem(item: ShopifyLineItem): boolean {
  const titleAllowlist = [
    ...DEFAULT_SMART_CARD_TITLE_ALLOWLIST,
    ...parseCsvEnv("SHOPIFY_SMART_CARD_PRODUCT_TITLES"),
  ].map(toLower);

  const handleAllowlist = [
    ...DEFAULT_SMART_CARD_HANDLE_ALLOWLIST,
    ...parseCsvEnv("SHOPIFY_SMART_CARD_PRODUCT_HANDLES"),
  ].map(toLower);

  const productIdAllowlist = parseCsvEnv("SHOPIFY_SMART_CARD_PRODUCT_IDS");
  const variantIdAllowlist = parseCsvEnv("SHOPIFY_SMART_CARD_VARIANT_IDS");

  const title = toLower(item.product_title || item.title);
  const handle = toLower(item.handle);
  const productId = item.product_id ? String(item.product_id) : "";
  const variantId = item.variant_id ? String(item.variant_id) : "";

  const titleMatched = title && titleAllowlist.some((allowed) => title.includes(allowed));
  const handleMatched = handle && handleAllowlist.includes(handle);
  const productIdMatched = productId && productIdAllowlist.includes(productId);
  const variantIdMatched = variantId && variantIdAllowlist.includes(variantId);

  if (productIdAllowlist.length || variantIdAllowlist.length) {
    return Boolean(titleMatched || handleMatched || productIdMatched || variantIdMatched);
  }

  return Boolean(titleMatched || handleMatched);
}

async function findCustomerId(admin: ReturnType<typeof createWebhookSupabaseClient>, payload: ShopifyOrderPayload) {
  const shopifyCustomerId = payload.customer?.id ? String(payload.customer.id) : null;
  const customerEmail = String(payload.customer?.email || payload.email || "")
    .trim()
    .toLowerCase();

  if (shopifyCustomerId) {
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("shopify_customer_id", shopifyCustomerId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  if (customerEmail) {
    const { data } = await admin
      .from("customers")
      .select("id")
      .eq("email", customerEmail)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headerHmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
  const secretFingerprint = secret
    ? crypto.createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 8)
    : "missing";

  let computedHmacLength = 0;
  if (secret) {
    computedHmacLength = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64").length;
  }

  console.info("orders-paid webhook hmac debug", {
    raw_body_bytes: Buffer.byteLength(rawBody, "utf8"),
    received_hmac_length: headerHmac?.length ?? 0,
    computed_hmac_length: computedHmacLength,
    secret_fingerprint_sha256_8: secretFingerprint,
  });

  let hmacValid = false;
  try {
    hmacValid = verifyShopifyHmac(rawBody, headerHmac);
  } catch (error) {
    console.error("orders-paid webhook configuration error", error);
    return NextResponse.json({ ok: false, error: "Webhook secret not configured." }, { status: 500 });
  }

  if (!hmacValid) {
    return NextResponse.json({ ok: false, error: "Invalid HMAC signature." }, { status: 401 });
  }

  const topic = (req.headers.get("x-shopify-topic") || "").toLowerCase();
  if (topic && topic !== "orders/paid") {
    return NextResponse.json({ ok: true, skipped: true, reason: `Unsupported topic: ${topic}` }, { status: 200 });
  }

  const webhookId = req.headers.get("x-shopify-webhook-id")?.trim();
  if (!webhookId) {
    return NextResponse.json({ ok: false, error: "Missing X-Shopify-Webhook-Id header." }, { status: 400 });
  }

  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabaseHost = getSupabaseHost();

  console.info("orders-paid webhook db preflight", {
    service_role_configured: serviceRoleConfigured,
    supabase_host: supabaseHost,
    webhook_id: webhookId,
  });

  let admin: ReturnType<typeof createWebhookSupabaseClient>;
  try {
    admin = createWebhookSupabaseClient();
  } catch (error) {
    console.error("orders-paid webhook supabase client init failed", {
      service_role_configured: serviceRoleConfigured,
      supabase_host: supabaseHost,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, error: "Supabase service role is not configured." }, { status: 500 });
  }

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  // Idempotency check before payload processing.
  const { data: existingWebhookByHeader, error: existingByHeaderError } = await admin
    .from("shopify_webhooks")
    .select("webhook_id")
    .eq("webhook_id", webhookId)
    .maybeSingle();

  if (existingByHeaderError) {
    console.error("orders-paid webhook id lookup failed", {
      service_role_configured: serviceRoleConfigured,
      supabase_host: supabaseHost,
      webhook_id: webhookId,
      code: existingByHeaderError.code,
      message: existingByHeaderError.message,
      details: existingByHeaderError.details,
      hint: existingByHeaderError.hint,
    });

    const isLocal = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        ok: false,
        error: "Webhook id lookup failed.",
        ...(isLocal
          ? {
              diagnostic: {
                code: existingByHeaderError.code,
                message: existingByHeaderError.message,
                details: existingByHeaderError.details,
                hint: existingByHeaderError.hint,
                supabase_host: supabaseHost,
              },
            }
          : {}),
      },
      { status: 200 }
    );
  }

  if (existingWebhookByHeader?.webhook_id) {
    try {
      const clutchCodes = await provisionClutchCodesPaidOrder({
        payload: payload as ShopifyPaidOrder,
        webhookEventId: webhookId,
        dependencies: createClutchCodesSupabaseDependencies(admin),
      });
      return NextResponse.json(
        { ok: true, duplicate: true, webhook_id: webhookId, clutch_codes: clutchCodes },
        { status: 200 }
      );
    } catch (error) {
      console.error("clutch-codes duplicate webhook retry failed", {
        webhook_event_id: webhookId,
        shopify_order_id: normalizeOrderId(payload) || null,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        { ok: false, error: "Clutch Codes provisioning failed.", webhook_id: webhookId },
        { status: 500 }
      );
    }
  }

  const shopDomain = req.headers.get("x-shopify-shop-domain");

  const { error: insertWebhookError } = await admin.from("shopify_webhooks").insert({
    webhook_id: webhookId,
    topic,
    shop_domain: shopDomain,
  });

  if (insertWebhookError) {
    if (insertWebhookError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true, webhook_id: webhookId }, { status: 200 });
    }

    console.error("orders-paid webhook insert failed", insertWebhookError.message);
    return NextResponse.json({ ok: false, error: "Failed to store webhook idempotency record." }, { status: 200 });
  }

  const orderId = normalizeOrderId(payload);
  const orderNumber = normalizeOrderNumber(payload);
  const customerId = await findCustomerId(admin, payload);
  const customerEmail = extractCustomerEmail(payload);

  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "Missing Shopify order id.", webhook_id: webhookId },
      { status: 200 }
    );
  }

  const { error: upsertOrderError } = await admin.from("shopify_orders").upsert(
    {
      shopify_order_id: orderId,
      shopify_order_number: orderNumber,
      customer_id: customerId,
      customer_email: customerEmail || null,
      total_price: payload.total_price !== undefined && payload.total_price !== null
        ? Number(payload.total_price)
        : null,
      financial_status: payload.financial_status || null,
      raw_payload: payload,
    },
    { onConflict: "shopify_order_id" }
  );

  if (upsertOrderError) {
    console.error("orders-paid upsert shopify_orders failed", upsertOrderError.message);
    return NextResponse.json(
      { ok: false, error: "Failed to upsert shopify_orders.", webhook_id: webhookId },
      { status: 200 }
    );
  }

  let clutchCodesProvisioning: Awaited<ReturnType<typeof provisionClutchCodesPaidOrder>>;
  try {
    clutchCodesProvisioning = await provisionClutchCodesPaidOrder({
      payload: payload as ShopifyPaidOrder,
      webhookEventId: webhookId,
      dependencies: createClutchCodesSupabaseDependencies(admin),
    });
    console.info("clutch-codes provisioning completed", {
      webhook_event_id: webhookId,
      shopify_order_id: orderId,
      normalized_plan_code: clutchCodesProvisioning.planCode || null,
      qualified: clutchCodesProvisioning.qualified,
      duplicate: Boolean(clutchCodesProvisioning.duplicate),
      email_sent: Boolean(clutchCodesProvisioning.emailSent),
      effective_capacity: clutchCodesProvisioning.effectiveCapacity ?? null,
    });
  } catch (error) {
    console.error("clutch-codes provisioning failed", {
      webhook_event_id: webhookId,
      shopify_order_id: orderId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { ok: false, error: "Clutch Codes provisioning failed.", webhook_id: webhookId },
      { status: 500 }
    );
  }

  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  const matchingLineItems = lineItems.filter(isSmartCardLineItem);

  let insertedCardOrders = 0;
  let linkedCustomers = 0;
  let createdAuthUsers = 0;
  let sentWelcomeEmails = 0;
  let smartCardQrCreated = 0;
  let smartCardQrReused = 0;
  let destinationUrlSet = 0;
  let latestSmartCardQrSlug: string | null = null;

  const provisionedByEmail = new Map<string, {
    customerId: string;
    existingCustomer: boolean;
    setupUrl: string;
    profileId: string | null;
    profileSlug: string | null;
  }>();

  for (const item of matchingLineItems) {
    const propertyMap = normalizePropertyMap(item.properties);
    const engravingBusinessName = propertyMap["Business Name"] || null;
    const engravingTitle = propertyMap["Title"] || null;
    const engravingPhone = propertyMap["Business Phone Number"] || null;
    const engravingEmail = propertyMap["Business Email"] || null;
    const customDetails = propertyMap["Custom Details"] || propertyMap["Custom details"] || null;

    const explicitEngraving = propertyMap["Engraving Requested"] || propertyMap["engraving_requested"] || "";
    const engravingRequested =
      truthyValue(String(explicitEngraving || "")) ||
      Boolean(engravingBusinessName || engravingTitle || engravingPhone || engravingEmail || customDetails);

    const customerName = [payload.customer?.first_name, payload.customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || extractCustomerName(payload);

    const customerPhone = extractCustomerPhone(payload);

    const { data: insertedCardOrder, error: insertCardOrderError } = await admin
      .from("card_orders")
      .insert({
      customer_id: customerId,
      shopify_order_id: orderId,
      shopify_order_number: orderNumber,
      shopify_customer_id: payload.customer?.id ? String(payload.customer.id) : null,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      product_title: item.product_title || item.title || null,
      variant_title: item.variant_title || null,
      engraving_requested: engravingRequested,
      engraving_business_name: engravingBusinessName,
      engraving_title: engravingTitle,
      engraving_phone: engravingPhone,
      engraving_email: engravingEmail,
      custom_details: customDetails,
      raw_line_item: item,
      raw_order_payload: payload,
      status: "setup_pending",
      })
      .select("id, status, welcome_email_sent_at, customer_email, customer_name, shopify_order_number, engraving_business_name")
      .single();

    if (insertCardOrderError) {
      console.error("orders-paid insert card_orders failed", insertCardOrderError.message);
      return NextResponse.json(
        { ok: false, error: "Failed to insert card_orders.", webhook_id: webhookId },
        { status: 200 }
      );
    }

    insertedCardOrders += 1;

    if (!insertedCardOrder?.id || !customerEmail) {
      continue;
    }

    let provisioned = provisionedByEmail.get(customerEmail);
    if (!provisioned) {
      const authResult = await ensureAuthUserForEmail(admin, customerEmail, customerName);
      if (!authResult.authUserId) {
        console.warn("orders-paid auth user missing after provisioning attempt", { email: customerEmail });
        continue;
      }

      if (authResult.created) {
        createdAuthUsers += 1;
      }

      const customerResult = await findOrCreateCustomer(admin, {
        email: customerEmail,
        authUserId: authResult.authUserId,
        customerName,
        businessName: engravingBusinessName,
        shopifyCustomerId: payload.customer?.id ? String(payload.customer.id) : null,
        shopifyOrderId: orderId,
      });

      const profileResult = await ensureDraftProfile(admin, {
        customerId: customerResult.customerId,
        customerName,
        businessName: engravingBusinessName,
        title: engravingTitle,
        phone: engravingPhone || customerPhone || null,
        email: engravingEmail || customerEmail,
      });

      const setupUrl = await generateSetupLink(admin, customerEmail);
      provisioned = {
        customerId: customerResult.customerId,
        existingCustomer: customerResult.existing,
        setupUrl,
        profileId: profileResult.profileId || null,
        profileSlug: profileResult.profileSlug || null,
      };
      provisionedByEmail.set(customerEmail, provisioned);

      await admin
        .from("shopify_orders")
        .update({ customer_id: customerResult.customerId })
        .eq("shopify_order_id", orderId);
    }

    const cardOrderPatch: Record<string, any> = {
      customer_id: provisioned.customerId,
    };
    if (insertedCardOrder.status == null) {
      cardOrderPatch.status = "setup_pending";
    }

    const { error: linkError } = await admin
      .from("card_orders")
      .update(cardOrderPatch)
      .eq("id", insertedCardOrder.id);

    if (!linkError) {
      linkedCustomers += 1;
    }

    const smartCardQrDiagnostics = await ensureSystemSmartCardQr(admin, {
      customerId: provisioned.customerId,
      cardOrderId: insertedCardOrder.id,
      shopifyOrderId: orderId,
      shopifyOrderNumber: orderNumber,
      profileId: provisioned.profileId,
      profileSlug: provisioned.profileSlug,
    });

    if (smartCardQrDiagnostics.created) smartCardQrCreated += 1;
    if (smartCardQrDiagnostics.reused) smartCardQrReused += 1;
    if (smartCardQrDiagnostics.destinationUrlSet) destinationUrlSet += 1;
    if (smartCardQrDiagnostics.slug) latestSmartCardQrSlug = smartCardQrDiagnostics.slug;

    const systemQrPatch: Record<string, any> = {
      system_qr_code_id: smartCardQrDiagnostics.qrCodeId,
      system_qr_slug: smartCardQrDiagnostics.slug,
      system_qr_url: smartCardQrDiagnostics.qrUrl,
      system_qr_png_url: smartCardQrDiagnostics.qrPngUrl,
      system_qr_svg_url: smartCardQrDiagnostics.qrSvgUrl,
      nfc_url: smartCardQrDiagnostics.nfcUrl,
    };

    await admin
      .from("card_orders")
      .update(systemQrPatch)
      .eq("id", insertedCardOrder.id)
      .then(({ error }) => {
        if (!error || isColumnMissingError(error)) return;
        console.warn("orders-paid system QR card_order linkage skipped", {
          card_order_id: insertedCardOrder.id,
          code: error.code,
          message: error.message,
        });
      });

    console.info("orders-paid smart card qr diagnostics", {
      card_order_id: insertedCardOrder.id,
      customer_id: provisioned.customerId,
      smart_card_qr_created: smartCardQrDiagnostics.created,
      smart_card_qr_reused: smartCardQrDiagnostics.reused,
      system_qr_code_id: smartCardQrDiagnostics.qrCodeId,
      smart_card_qr_slug: smartCardQrDiagnostics.slug,
      system_qr_url: smartCardQrDiagnostics.qrUrl,
      destination_url_set: smartCardQrDiagnostics.destinationUrlSet,
    });

    if (insertedCardOrder.welcome_email_sent_at) {
      continue;
    }

    const sendEmails = String(process.env.SEND_ONBOARDING_EMAILS || "").toLowerCase() === "true";
    const emailType = provisioned.existingCustomer ? "existing_customer_setup" : "new_customer_welcome";
    const subject = "Your Clutch Connect setup is ready";

    if (!sendEmails) {
      console.info("orders-paid onboarding email skipped (SEND_ONBOARDING_EMAILS is not true)", {
        card_order_id: insertedCardOrder.id,
        email: customerEmail,
        subject,
      });
      continue;
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn("orders-paid onboarding email skipped (RESEND_API_KEY missing)", {
        card_order_id: insertedCardOrder.id,
      });
      continue;
    }

    const setupUrl = provisioned.setupUrl || getGuidedSetupAccessUrl(customerEmail);
    const orderDetailsUrl = getPortalOrdersLoginUrl(customerEmail, orderId);
    const template = buildSmartCardSetupEmailTemplate({
      setupUrl,
      orderStatusUrl: orderDetailsUrl,
      customerName: insertedCardOrder.customer_name || customerName,
      orderNumber: insertedCardOrder.shopify_order_number || orderNumber,
      productTitle: item.product_title || item.title || "Clutch Smart Business Card",
      engravingRequested,
      businessName: insertedCardOrder.engraving_business_name || engravingBusinessName,
      title: engravingTitle,
      phone: engravingPhone || customerPhone || null,
      email: engravingEmail || customerEmail,
    });

    try {
      await sendTransactionalEmail({
        to: customerEmail,
        subject,
        text: template.text,
        html: template.html,
        idempotencyKey: `card-order-${insertedCardOrder.id}-${emailType}`,
      });

      const { error: markEmailError } = await admin
        .from("card_orders")
        .update({
          welcome_email_sent_at: new Date().toISOString(),
          onboarding_email_type: emailType,
        })
        .eq("id", insertedCardOrder.id)
        .is("welcome_email_sent_at", null);

      if (!markEmailError) {
        sentWelcomeEmails += 1;
      }
    } catch (emailError: any) {
      console.error("orders-paid onboarding email failed", {
        card_order_id: insertedCardOrder.id,
        message: emailError?.message || "Unknown error",
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      processed: true,
      webhook_id: webhookId,
      order_id: orderId || null,
      order_number: orderNumber,
      matched_line_items: matchingLineItems.length,
      inserted_card_orders: insertedCardOrders,
      linked_customers: linkedCustomers,
      created_auth_users: createdAuthUsers,
      sent_welcome_emails: sentWelcomeEmails,
      smart_card_qr_created: smartCardQrCreated > 0,
      smart_card_qr_reused: smartCardQrReused > 0,
      smart_card_qr_slug: latestSmartCardQrSlug,
      destination_url_set: destinationUrlSet > 0,
      smart_card_qr_created_count: smartCardQrCreated,
      smart_card_qr_reused_count: smartCardQrReused,
      topic,
      clutch_codes: clutchCodesProvisioning,
    },
    { status: 200 }
  );
}
