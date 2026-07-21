import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BarChart3, CheckCircle2, QrCode } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { requireCustomer } from "@/lib/auth";
import { CLUTCH_CODES_PLANS, normalizeClutchCodesPlanCode } from "@/lib/clutch-codes";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { PLAN_DEFINITIONS, getCustomerPlan, getEffectiveQrLimit } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import StoredQrLibrary from "./stored-qr-library";
import type { StoredQrItem } from "./stored-qr-library";
import { loadAccountAccess } from "@/lib/account-access-server";
import { hasActiveClutchCodesSubscription, loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { resolveOwnedQrLibrary, visibleLibraryScanCount, type OwnedQrLibraryCode } from "@/lib/order-linked-library";
import pageStyles from "./page.module.css";

const CLUTCH_CODES_DISPLAY_NAMES = {
  clutch_codes_starter: "Clutch Starter",
  clutch_codes_growth: "Clutch Growth",
  clutch_codes_pro: "Clutch Pro",
} as const;

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
  const activeClutchCodesPlanCode = hasActiveClutchCodesSubscription(customer)
    ? normalizeClutchCodesPlanCode(customer.clutch_codes_plan_code)
    : null;
  const activeClutchCodesPlan = activeClutchCodesPlanCode
    ? CLUTCH_CODES_PLANS[activeClutchCodesPlanCode]
    : null;
  const displayedPlanName = activeClutchCodesPlan
    ? CLUTCH_CODES_DISPLAY_NAMES[activeClutchCodesPlan.code]
    : plan.name;
  const displayedPlanPrice = activeClutchCodesPlan?.monthlyPrice || plan.price;
  const displayedPlanDescription = activeClutchCodesPlan
    ? `Includes up to ${activeClutchCodesPlan.allowance} active Clutch Codes with editable destinations, customization, exports, and campaign analytics.`
    : plan.description;

  const usageLabel = !hasDynamicQr
    ? "Dynamic QR campaigns are locked"
    : plan.code === "agency"
      ? `${used} / 250+ QR codes used`
      : plan.code === "admin"
        ? `${used} / Unlimited QR codes used`
        : `${used} / ${limit} QR codes used`;
  const usagePercent = plan.code === "admin" || limit <= 0
    ? 0
    : Math.min(100, Math.round((used / limit) * 100));
  const subscriptionStatus = String(
    activeClutchCodesPlan
      ? customer.clutch_codes_subscription_status
      : customer.subscription_status || customer.plan_status || "active"
  ).replace(/_/g, " ");

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
      <main className={`container stored-qr-shell ${pageStyles.page}`}>
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
            <div className={pageStyles.headerActions}>
              <Link className={pageStyles.headerAction} href="/portal">
                <ArrowLeft size={16} aria-hidden="true" />
                Back to Dashboard
              </Link>
              {hasHeatmap ? (
                <Link className={`${pageStyles.headerAction} ${pageStyles.headerActionPrimary}`} href="/portal/analytics">
                  <BarChart3 size={16} aria-hidden="true" />
                  View Analytics
                </Link>
              ) : null}
            </div>
          )}
        />

        <section className={pageStyles.planSummary} aria-label="Current marketing plan">
          <span className={pageStyles.planIcon} aria-hidden="true">
            <QrCode size={31} strokeWidth={1.8} />
          </span>
          <div className={pageStyles.planContent}>
            <div className={pageStyles.planTopline}>
              <span className={pageStyles.planName}>Current plan</span>
              <span className={pageStyles.statusPill}>{subscriptionStatus}</span>
            </div>
            <h2>{displayedPlanName}</h2>
            <p>{displayedPlanDescription}</p>
            <div className={pageStyles.planUsageLine}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{usageLabel}</span>
            </div>
          </div>
          <div className={pageStyles.planAside}>
            <span className={pageStyles.planAsideLabel}>Plan price</span>
            <strong className={pageStyles.planPrice}>{displayedPlanPrice}</strong>
            <small>{plan.code === "admin" ? "Unlimited account capacity" : `${usagePercent}% of available QR capacity used`}</small>
            {plan.code !== "admin" ? (
              <span className={pageStyles.usageTrack} aria-hidden="true">
                <span style={{ width: `${usagePercent}%` }} />
              </span>
            ) : null}
          </div>
        </section>

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
