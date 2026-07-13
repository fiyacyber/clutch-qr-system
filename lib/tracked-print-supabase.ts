import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CustomerIdentityResolution, TrackedPrintCustomer, TrackedPrintDependencies } from "@/lib/tracked-print";

export function resolveCustomerIdentityRows(
  emailCustomer: TrackedPrintCustomer | null,
  shopifyCustomer: TrackedPrintCustomer | null,
  incomingShopifyCustomerId: string | null
): CustomerIdentityResolution {
  if (emailCustomer && shopifyCustomer && emailCustomer.id !== shopifyCustomer.id) return { status: "conflict" };
  if (emailCustomer) {
    const storedShopifyId = emailCustomer.shopify_customer_id ? String(emailCustomer.shopify_customer_id) : null;
    if (storedShopifyId !== null && storedShopifyId !== incomingShopifyCustomerId) return { status: "conflict" };
    return { status: "found", customer: emailCustomer };
  }
  if (shopifyCustomer) return { status: "found", customer: shopifyCustomer };
  return { status: "not_found" };
}

async function resolveCustomerIdentity(admin: SupabaseClient, email: string, shopifyCustomerId: string | null): Promise<CustomerIdentityResolution> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: byEmail, error: emailError } = await admin.from("customers").select("*").eq("email", normalizedEmail).limit(1).maybeSingle();
  if (emailError) throw emailError;
  let byShopify = null;
  if (shopifyCustomerId) {
    const result = await admin.from("customers").select("*").eq("shopify_customer_id", shopifyCustomerId).limit(1).maybeSingle();
    if (result.error) throw result.error;
    byShopify = result.data;
  }
  return resolveCustomerIdentityRows(byEmail, byShopify, shopifyCustomerId);
}

export async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
  throw new Error("Auth user lookup exceeded its safe pagination limit.");
}

export function buildSafeExistingCustomerLinkagePatch(existing: Record<string, any>, input: {
  authUserId?: string | null; shopifyCustomerId?: string | null; shopifyOrderId?: string | null;
}) {
  const patch: Record<string, string> = {};
  if (!existing.auth_user_id && input.authUserId) patch.auth_user_id = input.authUserId;
  if (!existing.shopify_customer_id && input.shopifyCustomerId) patch.shopify_customer_id = input.shopifyCustomerId;
  if (!existing.shopify_order_id && input.shopifyOrderId) patch.shopify_order_id = input.shopifyOrderId;
  return patch;
}

async function ensureAuthUser(admin: SupabaseClient, email: string, name: string) {
  let user = await findAuthUserByEmail(admin, email);
  if (user) return user;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
  if (!error && data.user) return data.user;
  user = await findAuthUserByEmail(admin, email);
  if (!user) throw error || new Error("Unable to create tracked-print Auth user.");
  return user;
}

export function createTrackedPrintSupabaseDependencies(admin: SupabaseClient): TrackedPrintDependencies {
  return {
    async resolveCustomer(email, shopifyCustomerId) {
      return resolveCustomerIdentity(admin, email, shopifyCustomerId);
    },
    async ensureNeutralCustomer(email, name, shopifyCustomerId, orderId) {
      const normalizedEmail = email.trim().toLowerCase();
      const resolution = await resolveCustomerIdentity(admin, normalizedEmail, shopifyCustomerId);
      if (resolution.status === "conflict") return resolution;
      if (resolution.status === "found") {
        const existing = resolution.customer;
        let authUserId: string | null = null;
        if (!existing.auth_user_id) {
          const authUser = await ensureAuthUser(admin, normalizedEmail, name);
          authUserId = authUser.id;
        }
        const safePatch = buildSafeExistingCustomerLinkagePatch(existing, { authUserId, shopifyCustomerId, shopifyOrderId: orderId });
        if (Object.keys(safePatch).length) {
          const { error } = await admin.from("customers").update(safePatch).eq("id", existing.id);
          if (error) throw error;
        }
        return { status: "found", customer: existing };
      }

      const neutral = {
        email: normalizedEmail, first_name: name.split(/\s+/)[0] || null,
        plan: "free_qr", plan_code: "free_qr", included_qr_allowance: 0,
        subscription_qr_limit: 0, qr_limit: 0, shopify_customer_id: shopifyCustomerId,
        shopify_order_id: orderId,
      };
      const { data, error } = await admin.from("customers").insert(neutral).select("id").single();
      if (error) {
        if (error.code !== "23505") throw error;
        const concurrent = await resolveCustomerIdentity(admin, normalizedEmail, shopifyCustomerId);
        if (concurrent.status === "not_found") throw new Error("Concurrent tracked-print customer creation could not be resolved.");
        return concurrent;
      }
      if (!data) throw new Error("Unable to create neutral tracked-print customer.");
      const user = await ensureAuthUser(admin, normalizedEmail, name);
      const { error: linkError } = await admin.from("customers").update({ auth_user_id: user.id }).eq("id", data.id).is("auth_user_id", null);
      if (linkError) throw linkError;
      return { status: "found", customer: { ...data, auth_user_id: user.id } };
    },
    async findPrintItem(orderId, lineItemId) {
      const { data, error } = await admin.from("print_order_items").select("*").eq("shopify_order_id", orderId)
        .eq("shopify_line_item_id", lineItemId).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    async upsertPrintItem(input) {
      const { data, error } = await admin.from("print_order_items").insert(input).select("*").single();
      if (!error && data) return { ...data, immutableMatch: true };
      if (error?.code !== "23505") throw error || new Error("Unable to persist print order item.");
      const { data: existing, error: readError } = await admin.from("print_order_items").select("*")
        .eq("shopify_order_id", input.shopify_order_id).eq("shopify_line_item_id", input.shopify_line_item_id).single();
      if (readError || !existing) throw readError || new Error("Unable to reuse print order item.");
      const immutableKeys = ["customer_id","product_id","variant_id","sku","material_type","quantity","tracking_mode","destination_url","existing_qr_code_id","campaign_name"];
      const immutableMatch = immutableKeys.every((key) => (existing[key] ?? null) === (input[key] ?? null));
      return { ...existing, immutableMatch };
    },
    async provisionQr(input) {
      const { data, error } = await admin.rpc("provision_tracked_print_qr", {
        p_print_order_item_id: input.printOrderItemId, p_customer_id: input.customerId,
        p_destination_url: input.destinationUrl, p_campaign_name: input.campaignName,
        p_material_type: input.materialType, p_idempotency_key: input.idempotencyKey,
        p_existing_qr_code_id: input.existingQrCodeId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.qr_code_id) throw new Error("Tracked-print provisioning returned no QR code.");
      return { qrCodeId: row.qr_code_id, includedQrAllowance: Number(row.included_qr_allowance || 0) };
    },
    async recordActivity(input) {
      const { error } = await admin.from("order_activity").upsert({ order_type: "print_order", order_id: input.orderId,
        action: input.action, actor_type: "system", reason: input.reason || null, idempotency_key: input.idempotencyKey,
      }, { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (error) throw error;
    },
    async markAttention(orderId, reason) {
      const { error } = await admin.from("print_order_items").update({ provisioning_status: "needs_attention", attention_reason: reason })
        .eq("id", orderId).in("provisioning_status", ["pending", "needs_attention", "failed"]);
      if (error) throw error;
    },
  };
}
