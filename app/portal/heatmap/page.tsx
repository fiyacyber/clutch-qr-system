import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import LocationHeatmapClient from "@/components/dashboard/LocationHeatmapClient";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { requireCustomer } from "@/lib/auth";
import { parseCoordinate } from "@/lib/analytics";
import { PLAN_DEFINITIONS, getCustomerPlan } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";

export default async function HeatmapCommandCenterPage() {
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
  if (!access.canUseCampaignHeatmap) redirect("/portal?access=campaign-heatmap-locked");
  const plan = getCustomerPlan(customer);
  const hasHeatmap = access.canUseCampaignHeatmap;
  const hasDynamicQr = access.canEditOwnedQr;
  const { data: qrCodes, error: qrError } = await admin
    .from("qr_codes")
    .select("id, name, is_active")
    .eq("customer_id", customer.id);

  if (qrError) {
    console.error("[portal-data-error]", {
      route: "/portal/heatmap",
      endpoint: "supabase:qr_codes.select",
      code: qrError.code ?? null,
      message: qrError.message ?? "Unknown error",
      details: qrError.details ?? null,
      hint: qrError.hint ?? null,
    });
  }

  const codes = qrCodes || [];
  const qrIds = codes.map((code) => code.id);
  const { data: scanRows, error: scanError } = qrIds.length
    ? await admin
        .from("qr_scans")
        .select("id, qr_code_id, created_at, city, region, country, latitude, longitude")
        .in("qr_code_id", qrIds)
        .order("created_at", { ascending: false })
        .limit(5000)
    : { data: [], error: null };

  if (scanError) {
    console.error("[portal-data-error]", {
      route: "/portal/heatmap",
      endpoint: "supabase:qr_scans.select",
      code: scanError.code ?? null,
      message: scanError.message ?? "Unknown error",
      details: scanError.details ?? null,
      hint: scanError.hint ?? null,
    });
  }

  const scans = scanRows || [];
  const hasCoordinateData = scans.some((scan: any) => parseCoordinate(scan.latitude) !== null && parseCoordinate(scan.longitude) !== null);

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
      <main className="container portal-heatmap-shell">
        <DashboardHeader
          title="Heatmap"
          subtitle="See where profile visits, scans, and engagement are happening."
          actions={<Link className="btn secondary" href="/portal/analytics?tab=geography">Geography Insights</Link>}
        />

        <CurrentPlanBadge
          planCode={plan.code}
          planName={plan.name}
          priceLabel={plan.price}
          description={plan.description}
          usageLabel={hasHeatmap ? "Heatmap analytics unlocked" : "Heatmap analytics locked"}
          subscriptionStatus={String(customer.subscription_status || customer.plan_status || "active")}
          trialStatus={String(customer.trial_status || "none")}
        />

        {!hasHeatmap ? (
          <LockedFeatureCard
            title="Unlock Heatmap Analytics"
            description="Visualize where scans and engagement are happening with location-level heatmaps."
            requiredPlan="Clutch Connect+"
            requiredPlanPrice="$9.99/mo"
            ctaLabel="Try Connect+"
            ctaHref={PLAN_DEFINITIONS.connect_plus.checkoutUrl}
            featureList={[
              "Location heatmaps",
              "Geography insights",
              "Advanced analytics tabs",
            ]}
            variant="connect_plus"
          />
        ) : null}

        {hasHeatmap ? (
          <LocationHeatmapClient
            scans={scans as any}
            hasCoordinateData={hasCoordinateData}
          />
        ) : null}
      </main>
    </DashboardShell>
  );
}
