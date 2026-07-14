import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAccountAccess, type AccountAccess, type AccountAccessCustomer, type CommerceEvidence } from "@/lib/account-access";

type EvidenceOverrides = Partial<CommerceEvidence>;

export async function loadAccountAccess(
  admin: SupabaseClient,
  customer: AccountAccessCustomer & { id: string },
  evidence: EvidenceOverrides = {}
): Promise<AccountAccess> {
  const [qrResult, cardOrderResult, systemQrResult, profileResult, printItemsResult, printProvisioningsResult] = await Promise.all([
    admin.from("qr_codes").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("counts_toward_capacity", true),
    admin.from("card_orders").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
    admin.from("qr_codes").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("is_system", true).eq("qr_type", "smart_card"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).eq("is_active", true),
    admin.from("print_order_items").select("id, material_type", { count: "exact" }).eq("customer_id", customer.id),
    admin.from("print_qr_provisionings").select("id, access_type, source_type", { count: "exact" })
      .eq("customer_id", customer.id).eq("provisioning_status", "completed"),
  ]);

  const warnings: string[] = [];
  if (qrResult.error) warnings.push("QR usage evidence is temporarily unavailable.");
  if (cardOrderResult.error) warnings.push("Smart Card order evidence is temporarily unavailable.");
  if (systemQrResult.error) warnings.push("Smart Card QR evidence is temporarily unavailable.");
  if (profileResult.error) warnings.push("Active profile evidence is temporarily unavailable.");
  if (printItemsResult.error) warnings.push("Print order evidence is temporarily unavailable.");
  if (printProvisioningsResult.error) warnings.push("Tracked-print evidence is temporarily unavailable.");

  const completedPrintProvisionings = printProvisioningsResult.data || [];
  const includedPrintProvisionings = completedPrintProvisionings.filter((row) => row.access_type === "included_permanent");
  const trackedPrintProvisionings = completedPrintProvisionings.filter((row) => row.source_type === "tracked_print");
  const businessKitProvisionings = completedPrintProvisionings.filter((row) => row.source_type === "business_kit");
  const materialTypes = Array.from(new Set((printItemsResult.data || []).map((row) => row.material_type).filter(Boolean)));

  const access = resolveAccountAccess({
    customer,
    usedQrCount: qrResult.count || 0,
    hasSmartCardOrder: (cardOrderResult.count || 0) > 0,
    hasSmartCardSystemQr: (systemQrResult.count || 0) > 0,
    hasActiveProfile: (profileResult.count || 0) > 0,
    hasPrintOrders: (printItemsResult.count || 0) > 0,
    hasTrackedPrint: trackedPrintProvisionings.length > 0,
    hasBusinessKit: businessKitProvisionings.length > 0,
    hasIncludedPrintQr: includedPrintProvisionings.length > 0,
    printOrderCount: printItemsResult.count || 0,
    includedPrintQrCount: includedPrintProvisionings.length,
    materialTypes,
    ...evidence,
  });

  return warnings.length ? { ...access, warnings: [...access.warnings, ...warnings] } : access;
}
