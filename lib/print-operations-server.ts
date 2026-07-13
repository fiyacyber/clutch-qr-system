import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { PrintActorType } from "@/lib/print-operations";

export type PrintOperationsActor = {
  userId: string;
  customerId: string;
  actorType: PrintActorType;
  isAdmin: boolean;
};

export async function requirePrintOperationsActor(): Promise<{
  admin: SupabaseClient;
  actor: PrintOperationsActor | null;
}> {
  const { user, customer } = await requireCustomer();
  const admin = createSupabaseAdminClient();
  if (!user || !customer) return { admin, actor: null };
  return {
    admin,
    actor: {
      userId: user.id,
      customerId: customer.id,
      actorType: customer.is_admin ? "admin" : "customer",
      isAdmin: Boolean(customer.is_admin),
    },
  };
}

export async function loadAuthorizedPrintOrder(
  admin: SupabaseClient,
  actor: PrintOperationsActor,
  orderId: string,
  selection = "*"
) {
  let query = admin.from("print_order_items").select(selection).eq("id", orderId);
  if (!actor.isAdmin) query = query.eq("customer_id", actor.customerId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export function safePrintOperationsError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || "");
  if (message.includes("revision reason required")) return "revision_reason_required";
  if (message.includes("supplier required")) return "supplier_required";
  if (message.includes("tracking URL")) return "tracking_url_invalid";
  if (message.includes("current draft proof")) return "proof_required";
  if (message.includes("invalid workflow transition") || message.includes("current state")) return "workflow_state_changed";
  return "print_operation_failed";
}
