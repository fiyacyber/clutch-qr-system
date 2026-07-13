import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAccountAccess, type AccountAccess, type AccountAccessCustomer, type CommerceEvidence } from "@/lib/account-access";

type EvidenceOverrides = Partial<CommerceEvidence>;

export async function loadAccountAccess(
  admin: SupabaseClient,
  customer: AccountAccessCustomer & { id: string },
  evidence: EvidenceOverrides = {}
): Promise<AccountAccess> {
  const [qrResult, cardOrderResult, systemQrResult, profileResult] = await Promise.all([
    admin.from("qr_codes").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).neq("is_system", true),
    admin.from("card_orders").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
    admin.from("qr_codes").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("is_system", true),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("is_active", true),
  ]);

  const warnings: string[] = [];
  if (qrResult.error) warnings.push("QR usage evidence is temporarily unavailable.");
  if (cardOrderResult.error) warnings.push("Smart Card order evidence is temporarily unavailable.");
  if (systemQrResult.error) warnings.push("Smart Card QR evidence is temporarily unavailable.");
  if (profileResult.error) warnings.push("Active profile evidence is temporarily unavailable.");

  const access = resolveAccountAccess({
    customer,
    usedQrCount: qrResult.count || 0,
    hasSmartCardOrder: (cardOrderResult.count || 0) > 0,
    hasSmartCardSystemQr: (systemQrResult.count || 0) > 0,
    hasActiveProfile: (profileResult.count || 0) > 0,
    ...evidence,
  });

  return warnings.length ? { ...access, warnings: [...access.warnings, ...warnings] } : access;
}
