import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, PlusCircle } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { requireCustomer } from "@/lib/auth";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { PLAN_DEFINITIONS, getCustomerPlan, getEffectiveQrLimit } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import StoredQrLibrary from "./stored-qr-library";
import type { StoredQrItem } from "./stored-qr-library";
import { loadAccountAccess } from "@/lib/account-access-server";
import { hasActiveClutchCodesSubscription, loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { resolveOwnedQrLibrary, visibleLibraryScanCount, type OwnedQrLibraryCode } from "@/lib/order-linked-library";

export default async function StoredQrCodesPage() {
  const { user, customer, customerLookupError } = await requireCustomer();

  if (!user) redirect("/login");
  if (customerLookupError) {
    return (
      <DashboardShell>
        <PortalCustomerLookupUnavailable />
      </DashboardShell>
    );
  }
  if (!customer) return <PortalAccountNotActive />;
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  const accessNow = new Date();
  if (!access.canEditOwnedQr && !access.hasClutchCodes) redirect("/portal?access=qr-library-locked");
  const libraryResult = await resolveOwnedQrLibrary({
    customerId: customer.id,
    hasPaidOrAdminAccess: Boolean(customer.is_admin) || hasActiveClutchCodesSubscription(customer),
    listOwnedCodes: async () => admin
        .from("qr_codes")
        .select("id, customer_id, name, slug, destination_url, scan_count, is_active, created_at, updated_at, foreground_color, background_color, is_system, qr_type, capacity_source, print_order_item_id")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false }),
    resolveCodeAccess: (codeId) => loadOrderLinkedQrAccess(admin, customer, codeId, accessNow, { throwOnError: true }),
  });
  const qrCodes = libraryResult.entries.map((entry) => entry.code);
  const codeAccessById = new Map(libraryResult.entries.map((entry) => [entry.code.id, entry.access] as const));
  const qrIds = qrCodes.filter((item) => codeAccessById.get(item.id)?.canViewBasicAnalytics).map((item) => item.id);

  const qrScansResult = qrIds.length
    ? await runGuardedDashboardTask({
        route: "/portal/qr",
        endpoint: "supabase:qr_scans.select",
        customerId: customer.id,
        fallback: [] as Array<{ qr_code_id: string; created_at: string | null }>,
        task: () =>
          admin
            .from("qr_scans")
            .select("qr_code_id, created_at")
            .in("qr_code_id", qrIds)
            .order("created_at", { ascending: false })
            .limit(1000),
      })
    : { data: [] as Array<{ qr_code_id: string; created_at: string | null }>, failed: false };

  const panelIssues: string[] = [];
  if (libraryResult.failed) panelIssues.push("Stored QR code list is temporarily unavailable.");
  if (qrScansResult.failed) panelIssues.push("Recent scan timestamps are temporarily unavailable.");

  const lastScanByQrId = new Map<string, string | null>();
  for (const scan of qrScansResult.data || []) {
    if (!lastScanByQrId.has(scan.qr_code_id)) {
      lastScanByQrId.set(scan.qr_code_id, scan.created_at || null);
    }
  }

  const plan = getCustomerPlan(customer);
  const limit = getEffectiveQrLimit(customer);
  const used = qrCodes.length;
  const hasDynamicQr = access.canEditOwnedQr;
  const hasHeatmap = access.canUseCampaignAnalytics;

  const usageLabel = !hasDynamicQr
    ? "Dynamic QR campaigns are locked"
    : plan.code === "agency"
      ? `${used} / 250+ QR codes used`
      : plan.code === "admin"
        ? `${used} / Unlimited QR codes used`
        : `${used} / ${limit} QR codes used`;

  const libraryRows: StoredQrItem[] = qrCodes.map((code: OwnedQrLibraryCode) => ({
    id: code.id,
    name: String(code.name || "Clutch Code"),
    slug: String(code.slug || ""),
    destinationUrl: String(code.destination_url || ""),
    scanCount: visibleLibraryScanCount(code, codeAccessById.get(code.id)!),
    status: code.is_active === false ? "Archived" : "Active",
    createdAt: typeof code.created_at === "string" ? code.created_at : null,
    updatedAt: typeof code.updated_at === "string" ? code.updated_at : null,
    foregroundColor: typeof code.foreground_color === "string" ? code.foreground_color : "#384862",
    backgroundColor: typeof code.background_color === "string" ? code.background_color : "#FFFFFF",
    lastScannedAt: lastScanByQrId.get(code.id) || null,
    canManage: Boolean(codeAccessById.get(code.id)?.canEditDestination),
    canViewAnalytics: Boolean(codeAccessById.get(code.id)?.canViewBasicAnalytics),
    accessState: codeAccessById.get(code.id)?.state || "denied",
    accessExpiresAt: codeAccessById.get(code.id)?.accessExpiresAt || null,
  }));

  return (
    <DashboardShell
      accountAccess={access}
      isAdmin={Boolean(customer.is_admin)}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      <main className="container stored-qr-shell">
        {panelIssues.length ? (
          <RetryNotice
            title="Some QR library data is temporarily unavailable"
            description={panelIssues[0]}
            details={panelIssues.slice(1)}
          />
        ) : null}

        <DashboardHeader
          pretitle="Marketing"
          title="Marketing Assets"
          subtitle="Manage Clutch Codes, printed campaigns, connected profiles, and their performance."
          actions={(
            <div className="qr-studio-top-actions">
              <Link className="btn ghost" href="/portal">Back to Dashboard</Link>
              {hasHeatmap ? <Link className="btn secondary" href="/portal/analytics"><BarChart3 size={16} />View Analytics</Link> : null}
              {access.canCreateQr ? <Link className="btn primary" href="/portal/create"><PlusCircle size={16} />Create QR</Link> : null}
            </div>
          )}
        />

        <CurrentPlanBadge
          planCode={plan.code}
          planName={plan.name}
          priceLabel={plan.price}
          description={plan.description}
          usageLabel={usageLabel}
          subscriptionStatus={String(customer.subscription_status || customer.plan_status || "active")}
          trialStatus={String(customer.trial_status || "none")}
        />

        {!hasDynamicQr ? (
          <LockedFeatureCard
            title="Unlock QR Pro"
            description="Create dynamic QR campaigns with editable destinations and analytics."
            requiredPlan="QR Pro"
            requiredPlanPrice="$14.99/mo"
            ctaLabel="Upgrade to QR Pro"
            ctaHref={PLAN_DEFINITIONS.qr_pro.checkoutUrl}
            featureList={[
              "100 dynamic QR codes",
              "Editable destinations",
              "QR customization",
              "QR exports",
              "Campaign analytics",
            ]}
            variant="qr_pro"
          />
        ) : null}

        {hasDynamicQr && plan.code === "qr_pro" && used >= limit ? (
          <LockedFeatureCard
            title="Need more QR codes?"
            description="Agency unlocks 250+ QR codes, higher-volume tracking, and client reporting."
            requiredPlan="Agency"
            requiredPlanPrice="Custom"
            ctaLabel="Request Agency Access"
            ctaHref={PLAN_DEFINITIONS.agency.checkoutUrl}
            featureList={[
              "250+ QR codes",
              "Client reporting",
              "Advanced campaign reports",
              "Priority setup",
            ]}
            variant="agency"
          />
        ) : null}

        {hasDynamicQr ? (
          <StoredQrLibrary
            items={libraryRows}
            usage={{
              used,
              limit: plan.code === "admin" ? null : limit,
            }}
          />
        ) : null}
      </main>
    </DashboardShell>
  );
}
