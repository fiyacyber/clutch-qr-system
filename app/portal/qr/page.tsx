import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, PlusCircle } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import { requireCustomer } from "@/lib/auth";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import StoredQrLibrary, { type StoredQrItem } from "./stored-qr-library";
import { loadAccountAccess } from "@/lib/account-access-server";
import { customerFacingCodeSource } from "@/lib/business-kits";

export default async function StoredQrCodesPage() {
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) return <DashboardShell><PortalCustomerLookupUnavailable /></DashboardShell>;
  if (!customer) return <PortalAccountNotActive />;
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const [access, qrCodesResult, provisioningsResult] = await Promise.all([
    loadAccountAccess(admin, customer),
    runGuardedDashboardTask({
      route: "/portal/qr",
      endpoint: "supabase:qr_codes.select",
      customerId: customer.id,
      fallback: [] as Array<any>,
      task: () => admin.from("qr_codes")
        .select("id,name,slug,destination_url,scan_count,is_active,created_at,updated_at,foreground_color,background_color,qr_type,capacity_source,print_order_item_id,is_system")
        .eq("customer_id", customer.id)
        .or("is_system.eq.false,qr_type.eq.tracked_print,qr_type.eq.business_kit")
        .order("created_at", { ascending: false }),
    }),
    runGuardedDashboardTask({
      route: "/portal/qr",
      endpoint: "supabase:print_qr_provisionings.select",
      customerId: customer.id,
      fallback: [] as Array<{ print_order_item_id: string; source_type: string }>,
      task: () => admin.from("print_qr_provisionings")
        .select("print_order_item_id,source_type")
        .eq("customer_id", customer.id),
    }),
  ]);

  if (!access.canEditOwnedQr && !access.hasClutchCodes) redirect("/portal?access=clutch-codes-locked");
  const qrCodes = qrCodesResult.data || [];
  const qrIds = qrCodes.map((item: any) => item.id);
  const qrScansResult = qrIds.length
    ? await runGuardedDashboardTask({
        route: "/portal/qr",
        endpoint: "supabase:qr_scans.select",
        customerId: customer.id,
        fallback: [] as Array<{ qr_code_id: string; created_at: string | null }>,
        task: () => admin.from("qr_scans").select("qr_code_id,created_at").in("qr_code_id", qrIds).order("created_at", { ascending: false }).limit(1000),
      })
    : { data: [] as Array<{ qr_code_id: string; created_at: string | null }>, failed: false };

  const lastScanByQrId = new Map<string, string | null>();
  for (const scan of qrScansResult.data || []) if (!lastScanByQrId.has(scan.qr_code_id)) lastScanByQrId.set(scan.qr_code_id, scan.created_at || null);
  const sourceByItem = new Map((provisioningsResult.data || []).map((row) => [String(row.print_order_item_id), row.source_type]));
  const panelIssues: string[] = [];
  if (qrCodesResult.failed) panelIssues.push("Your Clutch Code library is temporarily unavailable.");
  if (provisioningsResult.failed) panelIssues.push("Code source labels are temporarily unavailable.");
  if (qrScansResult.failed) panelIssues.push("Recent scan timestamps are temporarily unavailable.");

  const libraryRows: StoredQrItem[] = qrCodes.map((code: any) => ({
    id: code.id,
    name: code.name,
    slug: code.slug,
    destinationUrl: code.destination_url,
    scanCount: code.scan_count || 0,
    status: code.is_active === false ? "Archived" : "Active",
    createdAt: code.created_at,
    updatedAt: code.updated_at,
    foregroundColor: code.foreground_color || "#384862",
    backgroundColor: code.background_color || "#FFFFFF",
    lastScannedAt: lastScanByQrId.get(code.id) || null,
    sourceLabel: customerFacingCodeSource({ ...code, source_type: code.print_order_item_id ? sourceByItem.get(String(code.print_order_item_id)) : null }),
  }));

  return (
    <DashboardShell accountAccess={access} isAdmin={Boolean(customer.is_admin)}>
      <main className="container stored-qr-shell">
        {panelIssues.length ? <RetryNotice title="Some Clutch Code data is temporarily unavailable" description={panelIssues[0]} details={panelIssues.slice(1)} /> : null}
        <DashboardHeader
          title="Clutch Codes"
          subtitle="Create, customize, distribute, and track every code from one library."
          actions={<div className="qr-studio-top-actions">
            {access.canUseCampaignAnalytics ? <Link className="btn secondary" href="/portal/analytics"><BarChart3 size={16} /> Analytics</Link> : null}
            {access.canCreateQr ? <Link className="btn primary" href="/portal/create"><PlusCircle size={16} /> Create Clutch Code</Link> : null}
          </div>}
        />
        <StoredQrLibrary
          items={libraryRows}
          canCreate={access.canCreateQr}
          usage={{ used: access.usedQrCount, limit: access.effectiveQrCapacity }}
        />
      </main>
    </DashboardShell>
  );
}
