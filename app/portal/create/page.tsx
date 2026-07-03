import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, LayoutGrid, ShieldCheck, Sparkles } from "lucide-react";
import QRCodeCreateStudioForm from "@/components/QRCodeCreateStudioForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RetryNotice from "@/components/dashboard/RetryNotice";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { requireCustomer } from "@/lib/auth";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  PLAN_DEFINITIONS,
  getCustomerPlan,
  getEffectiveQrLimit,
  getSubscriptionLockMessage,
  hasEntitlement,
  isCustomerSubscriptionLocked,
} from "@/lib/plans";

export default async function CreatePortalPage() {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const [qrCodesResult, profilesResult] = await Promise.all([
    runGuardedDashboardTask({
      route: "/portal/create",
      endpoint: "supabase:qr_codes.select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string }>,
      task: () =>
        admin
          .from("qr_codes")
          .select("id")
          .eq("customer_id", customer.id),
    }),
    runGuardedDashboardTask({
      route: "/portal/create",
      endpoint: "supabase:profiles.active_select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string; slug: string | null; business_name: string | null; contact_name: string | null }>,
      task: () =>
        admin
          .from("profiles")
          .select("id, slug, business_name, contact_name")
          .eq("customer_id", customer.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
    }),
  ]);

  const panelIssues: string[] = [];
  if (qrCodesResult.failed) panelIssues.push("QR usage totals are temporarily unavailable.");
  if (profilesResult.failed) panelIssues.push("Clutch Connect profile linking is temporarily unavailable.");

  const used = qrCodesResult.data?.length || 0;
  const limit = getEffectiveQrLimit(customer);
  const plan = getCustomerPlan(customer);
  const hasDynamicQr = hasEntitlement(customer, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer, "heatmapAnalytics") || plan.code === "admin";
  const locked = isCustomerSubscriptionLocked(customer) || !hasDynamicQr;
  const lockMessage = getSubscriptionLockMessage(customer);
  const usageLabel = !hasDynamicQr
    ? "Dynamic QR campaigns are locked"
    : plan.code === "agency"
      ? `${used} / 250+ QR codes used`
      : plan.code === "admin"
        ? `${used} / Unlimited QR codes used`
        : `${used} / ${limit} QR codes used`;

  return (
    <DashboardShell
      isAdmin={Boolean(customer.is_admin)}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      <main className="container create-studio-shell">
        <DashboardHeader
          title="Create QR"
          subtitle="Build a trackable QR code in minutes."
          actions={(
            <div className="qr-studio-status-cards">
              <article className="qr-studio-status-card">
                <span><ShieldCheck size={14} /> Account type</span>
                <strong>{plan.name}</strong>
              </article>
              <article className="qr-studio-status-card">
                <span><LayoutGrid size={14} /> QR usage</span>
                <strong>{hasDynamicQr ? `${used}/${plan.code === "admin" ? "Unlimited" : limit}` : "Locked"}</strong>
              </article>
              <article className="qr-studio-status-card">
                <span><Sparkles size={14} /> Builder</span>
                <strong>Mobile-ready</strong>
              </article>
            </div>
          )}
        />

        <section className="create-page-nav qr-studio-top-actions">
          <Link className="btn ghost" href="/portal">Back to Dashboard</Link>
          <Link className="btn secondary" href="/portal/qr">Stored QR Codes</Link>
          <Link className="btn secondary" href="/portal/analytics"><BarChart3 size={16} />View Analytics</Link>
        </section>

        {panelIssues.length ? (
          <RetryNotice
            title="Some QR Studio data is temporarily unavailable"
            description={panelIssues[0]}
            details={panelIssues.slice(1)}
          />
        ) : null}

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
            description="Dynamic QR creation starts on QR Pro, including editable destinations and campaign tracking."
            requiredPlan="QR Pro"
            requiredPlanPrice="$14.99/mo"
            ctaLabel="Upgrade for $14.99/mo"
            ctaHref={PLAN_DEFINITIONS.qr_pro.checkoutUrl}
            featureList={[
              "100 dynamic QR codes",
              "Editable destinations",
              "QR custom styles and logos",
              "Campaign analytics",
              "Export-ready QR assets",
            ]}
            variant="qr_pro"
          />
        ) : null}

        {hasDynamicQr && plan.code === "qr_pro" && used >= limit ? (
          <LockedFeatureCard
            title="QR Pro limit reached"
            description="Move to Agency for 250+ campaigns and advanced reporting."
            requiredPlan="Agency"
            requiredPlanPrice="Custom"
            ctaLabel="Request Agency Access"
            ctaHref={PLAN_DEFINITIONS.agency.checkoutUrl}
            featureList={[
              "250+ QR campaigns",
              "Client reporting",
              "PDF exports",
              "Priority support",
            ]}
            variant="agency"
          />
        ) : null}

        <QRCodeCreateStudioForm
          used={used}
          limit={hasDynamicQr ? limit : 0}
          isLocked={locked}
          lockMessage={!hasDynamicQr ? "Dynamic QR is included in QR Pro and higher." : lockMessage}
          connectProfiles={(profilesResult.data || []) as any}
        />
      </main>
    </DashboardShell>
  );
}
