import { redirect } from "next/navigation";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { requireCustomer } from "@/lib/auth";
import { PLAN_DEFINITIONS, getCustomerPlan, getEffectiveQrLimit, hasEntitlement, isCustomerSubscriptionLocked } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function PortalSettingsPage() {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) redirect("/login");

  const admin = createSupabaseAdminClient();
  const plan = getCustomerPlan(customer as any);

  const [{ data: qrRows }, { data: latestQrRows }] = await Promise.all([
    admin
      .from("qr_codes")
      .select("id")
      .eq("customer_id", customer.id)
      .neq("is_system", true),
    admin
      .from("qr_codes")
      .select("name, foreground_color, background_color")
      .eq("customer_id", customer.id)
      .neq("is_system", true)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Account holder";
  const latestQr = latestQrRows?.[0] || null;
  const hasDynamicQr = hasEntitlement(customer as any, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer as any, "heatmapAnalytics") || plan.code === "admin";

  const usageLabel = plan.code === "connect_basic"
    ? "Digital profile access included"
    : plan.code === "connect_plus"
      ? "Profile tools unlocked"
      : plan.code === "agency"
        ? `${qrRows?.length || 0} / 250+ QR codes used`
        : plan.code === "admin"
          ? `${qrRows?.length || 0} / Unlimited QR codes used`
          : `${qrRows?.length || 0} / ${getEffectiveQrLimit(customer as any)} QR codes used`;

  const billingActions = plan.code === "connect_basic"
    ? [
        { label: "Upgrade to Connect+", href: PLAN_DEFINITIONS.connect_plus.checkoutUrl, tone: "primary" },
        { label: "Upgrade to QR Pro", href: PLAN_DEFINITIONS.qr_pro.checkoutUrl, tone: "secondary" },
      ]
    : plan.code === "connect_plus"
      ? [
          { label: "Manage Connect+", href: PLAN_DEFINITIONS.connect_plus.checkoutUrl, tone: "secondary" },
          { label: "Upgrade to QR Pro", href: PLAN_DEFINITIONS.qr_pro.checkoutUrl, tone: "primary" },
        ]
      : plan.code === "qr_pro"
        ? [
            { label: "Manage QR Pro", href: PLAN_DEFINITIONS.qr_pro.checkoutUrl, tone: "secondary" },
            { label: "Request Agency", href: PLAN_DEFINITIONS.agency.checkoutUrl, tone: "primary" },
          ]
        : plan.code === "agency"
          ? [
              { label: "Contact support", href: PLAN_DEFINITIONS.agency.checkoutUrl, tone: "primary" },
              { label: "Manage account", href: "/portal/settings", tone: "secondary" },
            ]
          : [];

  return (
    <DashboardShell
      isAdmin={Boolean(customer.is_admin)}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      <main className="container" style={{ marginBottom: 16, display: "grid", gap: 14 }}>
        <section className="card">
          <p className="eyebrow">Plan & Billing</p>
          <CurrentPlanBadge
            planCode={plan.code}
            planName={plan.name}
            priceLabel={plan.price}
            description={plan.description}
            usageLabel={usageLabel}
            subscriptionStatus={String(customer.subscription_status || customer.plan_status || "active")}
            locked={isCustomerSubscriptionLocked(customer as any)}
            trialStatus={String(customer.trial_status || "none")}
          />

          {plan.code === "admin" ? (
            <p className="muted" style={{ marginTop: 10 }}>Internal access detected. Checkout actions are hidden for admin accounts.</p>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {billingActions.map((action) => (
                <a key={action.label} className={`btn ${action.tone === "primary" ? "primary" : "secondary"}`} href={action.href}>
                  {action.label}
                </a>
              ))}
            </div>
          )}
        </section>

        {plan.code === "connect_basic" ? (
          <LockedFeatureCard
            title="Unlock Clutch Connect+"
            description="Advanced profile customization, forms, lead management, and profile analytics."
            requiredPlan="Clutch Connect+"
            requiredPlanPrice="$9.99/mo"
            ctaLabel="Upgrade for $9.99/mo"
            ctaHref={PLAN_DEFINITIONS.connect_plus.checkoutUrl}
            featureList={[
              "Advanced profile builder",
              "Custom quote forms",
              "Advanced Lead Inbox",
              "Heatmap/profile analytics",
              "Remove Clutch branding",
            ]}
            variant="connect_plus"
          />
        ) : null}
      </main>
      <AnalyticsDashboard
        activeTab="settings"
        accountName={fullName}
        accountEmail={user.email || null}
        companyName={customer.company_name || "—"}
        accountType={customer.is_admin ? "Admin" : plan.name}
        memberSince={formatDate(customer.created_at)}
        lastLogin={formatDate(user.last_sign_in_at)}
        authenticationStatus={customer.must_change_password ? "Password reset required" : "Password login active"}
        planName={plan.name}
        planCode={plan.code}
        managePlanHref={plan.checkoutUrl}
        qrUsageUsed={qrRows?.length || 0}
        qrUsageLimit={plan.code === "admin" ? null : getEffectiveQrLimit(customer as any)}
        latestQrName={latestQr?.name || null}
        latestQrForeground={latestQr?.foreground_color || "#384862"}
        latestQrBackground={latestQr?.background_color || "#ffffff"}
        totalScans={0}
        connectViews={0}
        linkClicks={0}
        uniqueVisitors={0}
        leadsCaptured={0}
        activeQrCodes={0}
        qrRows={[]}
        connectRows={[]}
        scansOverTime={[]}
        countryData={[]}
        mapPoints={[]}
        cityRows={[]}
        deviceRows={[]}
        browserRows={[]}
        osRows={[]}
        heatmap={[]}
        geographyRows={[]}
      />
    </DashboardShell>
  );
}
