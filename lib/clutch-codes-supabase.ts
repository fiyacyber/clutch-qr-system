import { SupabaseClient } from "@supabase/supabase-js";
import {
  buildClutchCodesCancellationPatch,
  type ClutchCodesCustomerRecord,
  type ClutchCodesEventInput,
  type ClutchCodesProvisioningDependencies,
  CLUTCH_CODES_SUPPORT_EMAIL,
  detectClutchCodesSubscription,
  getEffectiveClutchCodesCapacity,
} from "@/lib/clutch-codes";
import { sendTransactionalEmail } from "@/lib/email";
import { buildClutchCodesSubscriptionAccessEmailTemplate } from "@/lib/email-templates";
import { buildPasswordResetRedirectUrl } from "@/lib/onboarding-routing";

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user?.id) return user.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

export function createClutchCodesSupabaseDependencies(
  admin: SupabaseClient
): ClutchCodesProvisioningDependencies {
  return {
    async claimEvent(input: ClutchCodesEventInput) {
      const { error } = await admin.from("shopify_entitlement_events").insert({
        event_key: input.eventKey,
        shopify_event_id: input.webhookEventId,
        topic: input.topic,
        shopify_order_id: input.orderId,
        shopify_line_item_id: input.lineItemId,
        shopify_subscription_contract_id: input.subscriptionContractId,
        action: "subscription_paid",
        plan_code: input.plan.code,
        subscription_qr_limit: input.plan.allowance,
        status: "processing",
        raw_payload: input.payload,
      });

      if (!error) return "claimed";
      if (!isUniqueViolation(error)) throw error;

      const existing = await admin
        .from("shopify_entitlement_events")
        .select("status")
        .eq("event_key", input.eventKey)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.status !== "failed") return "duplicate";

      const retry = await admin
        .from("shopify_entitlement_events")
        .update({
          status: "processing",
          error_message: null,
          shopify_event_id: input.webhookEventId,
          updated_at: new Date().toISOString(),
        })
        .eq("event_key", input.eventKey)
        .eq("status", "failed");
      if (retry.error) throw retry.error;
      return "claimed";
    },

    async findCustomer(email, shopifyCustomerId) {
      if (shopifyCustomerId) {
        const byShopifyId = await admin
          .from("customers")
          .select("*")
          .eq("shopify_customer_id", shopifyCustomerId)
          .maybeSingle();
        if (byShopifyId.error) throw byShopifyId.error;
        if (byShopifyId.data) return byShopifyId.data as ClutchCodesCustomerRecord;
      }

      const byEmail = await admin.from("customers").select("*").eq("email", email).maybeSingle();
      if (byEmail.error) throw byEmail.error;
      return (byEmail.data as ClutchCodesCustomerRecord | null) || null;
    },

    async ensureAuthUser(email, firstName) {
      const existingId = await findAuthUserByEmail(admin, email);
      if (existingId) return { authUserId: existingId, created: false };

      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: firstName ? { first_name: firstName } : undefined,
      });
      if (!created.error && created.data.user?.id) {
        return { authUserId: created.data.user.id, created: true };
      }

      if (/already|exists/i.test(String(created.error?.message || ""))) {
        const foundId = await findAuthUserByEmail(admin, email);
        if (foundId) return { authUserId: foundId, created: false };
      }
      throw created.error || new Error("Unable to create the Supabase auth user.");
    },

    async saveSubscription({
      existingCustomer,
      authUserId,
      email,
      firstName,
      plan,
      shopifyCustomerId,
      shopifyOrderId,
      shopifyLineItemId,
      shopifySubscriptionContractId,
    }) {
      const includedAllowance = Math.max(0, Number(existingCustomer?.included_qr_allowance || 0));
      const now = new Date().toISOString();
      const shared = {
        auth_user_id: existingCustomer?.auth_user_id || authUserId,
        email,
        clutch_codes_plan_code: plan.code,
        subscription_qr_limit: plan.allowance,
        clutch_codes_subscription_status: "active",
        qr_limit: includedAllowance + plan.allowance,
        shopify_customer_id: shopifyCustomerId || null,
        shopify_order_id: shopifyOrderId,
        shopify_line_item_id: shopifyLineItemId,
        shopify_subscription_id: shopifySubscriptionContractId || null,
        updated_at: now,
      };

      if (existingCustomer) {
        const patch = {
          ...shared,
          shopify_customer_id: shopifyCustomerId || (existingCustomer as any).shopify_customer_id || null,
          shopify_subscription_id:
            shopifySubscriptionContractId || (existingCustomer as any).shopify_subscription_id || null,
          ...(!(existingCustomer as any).first_name && firstName ? { first_name: firstName } : {}),
        };
        const updated = await admin
          .from("customers")
          .update(patch)
          .eq("id", existingCustomer.id)
          .select("*")
          .single();
        if (updated.error) throw updated.error;
        return updated.data as ClutchCodesCustomerRecord;
      }

      const inserted = await admin
        .from("customers")
        .insert({
          ...shared,
          first_name: firstName || null,
          included_qr_allowance: 0,
          plan: "connect_basic",
          plan_code: "connect_basic",
          plan_status: "active",
          subscription_status: "active",
          onboarding_status: "invited",
        })
        .select("*")
        .single();
      if (inserted.error) throw inserted.error;
      return inserted.data as ClutchCodesCustomerRecord;
    },

    async generateSecureAccessUrl(email) {
      const generated = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: buildPasswordResetRedirectUrl("/portal") },
      });
      if (generated.error) throw generated.error;
      const actionLink = generated.data?.properties?.action_link;
      if (!actionLink) throw new Error("Supabase did not return a secure recovery link.");
      return actionLink;
    },

    async reserveWelcomeEmail(customerId, eventKey) {
      const current = await admin
        .from("customers")
        .select("clutch_codes_welcome_email_sent_at, clutch_codes_welcome_email_event_key")
        .eq("id", customerId)
        .maybeSingle();
      if (current.error) throw current.error;
      if (current.data?.clutch_codes_welcome_email_sent_at) return false;
      if (current.data?.clutch_codes_welcome_email_event_key === eventKey) return true;
      if (current.data?.clutch_codes_welcome_email_event_key) return false;

      const reserved = await admin
        .from("customers")
        .update({ clutch_codes_welcome_email_event_key: eventKey })
        .eq("id", customerId)
        .is("clutch_codes_welcome_email_event_key", null)
        .is("clutch_codes_welcome_email_sent_at", null)
        .select("id")
        .maybeSingle();
      if (reserved.error) throw reserved.error;
      return Boolean(reserved.data?.id);
    },

    async sendAccessEmail({
      to,
      firstName,
      plan,
      accessUrl,
      manageSubscriptionUrl,
      idempotencyKey,
    }) {
      const template = buildClutchCodesSubscriptionAccessEmailTemplate({
        firstName,
        planName: plan.name,
        monthlyPrice: plan.monthlyPrice,
        allowance: plan.allowance,
        accessUrl,
        manageSubscriptionUrl,
        supportEmail: CLUTCH_CODES_SUPPORT_EMAIL,
      });
      await sendTransactionalEmail({
        to,
        subject: `Your ${plan.name} subscription is active`,
        text: template.text,
        html: template.html,
        idempotencyKey,
        fromName: "Clutch Codes from Clutch Print Shop",
      });
    },

    async markWelcomeEmailSent(customerId, eventKey) {
      const now = new Date().toISOString();
      const customerUpdate = await admin
        .from("customers")
        .update({ clutch_codes_welcome_email_sent_at: now })
        .eq("id", customerId)
        .eq("clutch_codes_welcome_email_event_key", eventKey);
      if (customerUpdate.error) throw customerUpdate.error;

      const eventUpdate = await admin
        .from("shopify_entitlement_events")
        .update({ email_sent_at: now, updated_at: now })
        .eq("event_key", eventKey);
      if (eventUpdate.error) throw eventUpdate.error;
    },

    async releaseWelcomeEmail(customerId, eventKey) {
      const released = await admin
        .from("customers")
        .update({ clutch_codes_welcome_email_event_key: null })
        .eq("id", customerId)
        .eq("clutch_codes_welcome_email_event_key", eventKey)
        .is("clutch_codes_welcome_email_sent_at", null);
      if (released.error) throw released.error;
    },

    async completeEvent(eventKey, { customerId }) {
      const now = new Date().toISOString();
      const completed = await admin
        .from("shopify_entitlement_events")
        .update({ customer_id: customerId, status: "completed", error_message: null, updated_at: now })
        .eq("event_key", eventKey);
      if (completed.error) throw completed.error;
    },

    async failEvent(eventKey, errorMessage) {
      const failed = await admin
        .from("shopify_entitlement_events")
        .update({ status: "failed", error_message: errorMessage, updated_at: new Date().toISOString() })
        .eq("event_key", eventKey);
      if (failed.error) {
        console.error("clutch-codes entitlement event failure marker failed", {
          event_key: eventKey,
          message: failed.error.message,
        });
      }
    },
  };
}

const CONTRACT_STATUS_BY_TOPIC: Record<string, string> = {
  "subscription_contracts/activate": "active",
  "subscription_contracts/update": "active",
  "subscription_contracts/pause": "paused",
  "subscription_contracts/fail": "past_due",
  "subscription_contracts/cancel": "cancelled",
  "subscription_contracts/expire": "expired",
};

export async function processClutchCodesContractLifecycle({
  admin,
  topic,
  payload,
  webhookEventId,
}: {
  admin: SupabaseClient;
  topic: string;
  payload: Record<string, any>;
  webhookEventId: string;
}) {
  const nextStatus = CONTRACT_STATUS_BY_TOPIC[topic];
  if (!nextStatus) return { qualified: false, skippedReason: `Unsupported lifecycle topic: ${topic}` };

  const lifecycleEnabled = String(process.env.ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS || "").toLowerCase() === "true";
  if (!lifecycleEnabled) {
    return {
      qualified: false,
      skippedReason: "All contract lifecycle handling is disabled behind ENABLE_CLUTCH_CODES_CONTRACT_WEBHOOKS until contract ownership and payload mapping are proven.",
    };
  }

  const removesSubscriptionCapacity = topic === "subscription_contracts/cancel" || topic === "subscription_contracts/expire";

  const contractId = String(payload.admin_graphql_api_id || payload.id || "").trim();
  if (!contractId) return { qualified: false, skippedReason: "Missing Shopify subscription contract ID." };

  let customerLookup = await admin
    .from("customers")
    .select("*")
    .eq("shopify_subscription_id", contractId)
    .maybeSingle();

  if (!customerLookup.data && payload.id != null && String(payload.id) !== contractId) {
    customerLookup = await admin
      .from("customers")
      .select("*")
      .eq("shopify_subscription_id", String(payload.id))
      .maybeSingle();
  }
  if (customerLookup.error) throw customerLookup.error;
  const customer = customerLookup.data as ClutchCodesCustomerRecord | null;
  if (!customer?.id || !customer.clutch_codes_plan_code) {
    return { qualified: false, skippedReason: "No Clutch Codes customer is linked to this contract." };
  }

  const eventKey = [
    "clutch-codes",
    topic,
    contractId,
    String(payload.revision_id || payload.updated_at || nextStatus),
  ].join(":");
  const planDetection = detectClutchCodesSubscription(payload.line_items || payload.lines || []);
  const currentPlanCode = String(customer.clutch_codes_plan_code);
  const nextPlanCode = planDetection?.plan.code || currentPlanCode;
  const nextLimit = planDetection?.plan.allowance ?? Math.max(0, Number(customer.subscription_qr_limit || 0));

  const inserted = await admin.from("shopify_entitlement_events").insert({
    event_key: eventKey,
    shopify_event_id: webhookEventId,
    topic,
    shopify_subscription_contract_id: contractId,
    customer_id: customer.id,
    action: nextStatus,
    plan_code: nextPlanCode,
    subscription_qr_limit: removesSubscriptionCapacity ? 0 : nextLimit,
    status: "processing",
    raw_payload: payload,
  });
  if (isUniqueViolation(inserted.error)) return { qualified: true, duplicate: true };
  if (inserted.error) throw inserted.error;

  try {
    const includedAllowance = Math.max(0, Number(customer.included_qr_allowance || 0));
    const patch = removesSubscriptionCapacity
      ? buildClutchCodesCancellationPatch(customer)
      : {
          clutch_codes_plan_code: nextPlanCode,
          subscription_qr_limit: nextLimit,
          clutch_codes_subscription_status: nextStatus,
          qr_limit: includedAllowance + nextLimit,
        };
    const updated = await admin.from("customers").update(patch).eq("id", customer.id);
    if (updated.error) throw updated.error;

    const completed = await admin
      .from("shopify_entitlement_events")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("event_key", eventKey);
    if (completed.error) throw completed.error;

    return {
      qualified: true,
      planCode: nextPlanCode,
      subscriptionQrLimit: removesSubscriptionCapacity ? 0 : nextLimit,
      includedQrAllowance: includedAllowance,
      effectiveCapacity: removesSubscriptionCapacity
        ? includedAllowance
        : getEffectiveClutchCodesCapacity({
            included_qr_allowance: includedAllowance,
            subscription_qr_limit: nextLimit,
          }),
      status: nextStatus,
    };
  } catch (error) {
    await admin
      .from("shopify_entitlement_events")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown lifecycle error",
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);
    throw error;
  }
}
