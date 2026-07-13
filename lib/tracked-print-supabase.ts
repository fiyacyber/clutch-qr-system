import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrackedPrintDependencies } from "@/lib/tracked-print";

export function createTrackedPrintSupabaseDependencies(admin: SupabaseClient): TrackedPrintDependencies {
  return {
    async findCustomer(email, shopifyCustomerId) {
      let query = admin.from("customers").select("id, auth_user_id");
      query = shopifyCustomerId
        ? query.or(`email.eq.${email},shopify_customer_id.eq.${shopifyCustomerId}`)
        : query.eq("email", email);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    async ensureNeutralCustomer(email, name, shopifyCustomerId, orderId) {
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      let user = listed.users.find((entry) => entry.email?.toLowerCase() === email);
      if (!user) {
        const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
        if (error || !data.user) throw error || new Error("Unable to create tracked-print Auth user.");
        user = data.user;
      }
      const { data, error } = await admin.from("customers").upsert({
        auth_user_id: user.id, email, first_name: name.split(/\s+/)[0] || null,
        plan: "free_qr", plan_code: "free_qr", included_qr_allowance: 0,
        subscription_qr_limit: 0, qr_limit: 0, shopify_customer_id: shopifyCustomerId,
        shopify_order_id: orderId,
      }, { onConflict: "email" }).select("id").single();
      if (error || !data) throw error || new Error("Unable to create neutral tracked-print customer.");
      return data;
    },
    async upsertPrintItem(input) {
      const { data, error } = await admin.from("print_order_items").upsert(input, {
        onConflict: "shopify_order_id,shopify_line_item_id",
      }).select("id, provisioning_status").single();
      if (error || !data) throw error || new Error("Unable to persist print order item.");
      return data;
    },
    async provisionQr(input) {
      const { data, error } = await admin.rpc("provision_tracked_print_qr", {
        p_print_order_item_id: input.printOrderItemId,
        p_customer_id: input.customerId,
        p_destination_url: input.destinationUrl,
        p_campaign_name: input.campaignName,
        p_material_type: input.materialType,
        p_idempotency_key: input.idempotencyKey,
        p_existing_qr_code_id: input.existingQrCodeId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.qr_code_id) throw new Error("Tracked-print provisioning returned no QR code.");
      return { qrCodeId: row.qr_code_id, includedQrAllowance: Number(row.included_qr_allowance || 0) };
    },
    async recordActivity(input) {
      const { error } = await admin.from("order_activity").upsert({
        order_type: "print_order", order_id: input.orderId, action: input.action,
        actor_type: "system", reason: input.reason || null, idempotency_key: input.idempotencyKey,
      }, { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (error) throw error;
    },
    async markAttention(orderId, reason) {
      const { error } = await admin.from("print_order_items").update({ provisioning_status: "needs_attention", attention_reason: reason }).eq("id", orderId);
      if (error) throw error;
    },
  };
}
