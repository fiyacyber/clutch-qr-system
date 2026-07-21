import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import PortalSettingsCenter from "@/components/settings/PortalSettingsCenter";
import { requireCustomer } from "@/lib/auth";
import { normalizeBrandColors } from "@/lib/brand-colors";
import { isConnectProfilePublished, isConnectSetupComplete } from "@/lib/connect";
import { PLAN_DEFINITIONS, getCustomerPlan, getEffectiveQrLimit, hasEntitlement, isAdvancedBuilderUnlocked } from "@/lib/plans";
import { clutchConnectDisplayUrl, clutchConnectProfileUrl } from "@/lib/qr";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import "../analytics/analytics.css";

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

  const admin = createSupabaseAdminClient();
  const plan = getCustomerPlan(customer as any);
  const advancedBuilderUnlocked = isAdvancedBuilderUnlocked(customer as any);

  const [
    { data: qrRows, error: qrRowsError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    admin
      .from("qr_codes")
      .select("id")
      .eq("customer_id", customer.id)
      .neq("is_system", true),
    admin
      .from("profiles")
      .select("*")
      .eq("customer_id", customer.id)
      .maybeSingle(),
  ]);

  if (qrRowsError) {
    console.error("[portal-data-error]", {
      route: "/portal/settings",
      endpoint: "supabase:qr_codes.select",
      code: qrRowsError.code ?? null,
      message: qrRowsError.message ?? "Unknown error",
      details: qrRowsError.details ?? null,
      hint: qrRowsError.hint ?? null,
    });
  }

  if (profileError) {
    console.error("[portal-data-error]", {
      route: "/portal/settings",
      endpoint: "supabase:profiles.maybeSingle",
      code: profileError.code ?? null,
      message: profileError.message ?? "Unknown error",
      details: profileError.details ?? null,
      hint: profileError.hint ?? null,
    });
  }

  const { data: linkRows, error: linkRowsError } = profile
    ? await admin
        .from("profile_links")
        .select("id, label, url, platform, is_active, sort_order")
        .eq("profile_id", profile.id)
        .order("sort_order", { ascending: true })
    : { data: [] as Array<Record<string, any>>, error: null as any };

  if (linkRowsError) {
    console.error("[portal-data-error]", {
      route: "/portal/settings",
      endpoint: "supabase:profile_links.select",
      code: linkRowsError.code ?? null,
      message: linkRowsError.message ?? "Unknown error",
      details: linkRowsError.details ?? null,
      hint: linkRowsError.hint ?? null,
    });
  }

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Account holder";
  const hasDynamicQr = hasEntitlement(customer as any, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer as any, "heatmapAnalytics") || plan.code === "admin";
  const profilePublished = isConnectProfilePublished(profile || null);
  const setupComplete = isConnectSetupComplete(customer as any, profile || null, { links: (linkRows || []) as any, requirePublished: false });
  const publicProfileUrl = profilePublished && profile?.slug ? clutchConnectProfileUrl(String(profile.slug)) : null;
  const publicProfileDisplayUrl = profile?.slug ? clutchConnectDisplayUrl(String(profile.slug)) : null;
  const builderHref = advancedBuilderUnlocked ? "/portal/connect/build" : "/portal/connect?builder=locked";
  const profileStatusLabel = !profile
    ? "Not started"
    : profilePublished
      ? "Live"
      : setupComplete
        ? "Ready to publish"
        : "Setup in progress";
  const profileCompletionLabel = !profile
    ? "No profile yet"
    : setupComplete
      ? "Guided setup complete"
      : "Guided setup incomplete";

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
      <PortalSettingsCenter
        accountName={fullName}
        accountEmail={user.email || null}
        companyName={customer.company_name || "—"}
        accountType={customer.is_admin ? "Admin" : "Customer"}
        memberSince={formatDate(customer.created_at)}
        lastLogin={formatDate(user.last_sign_in_at)}
        authenticationStatus={customer.must_change_password ? "Password reset required" : "Password login active"}
        isAdmin={Boolean(customer.is_admin)}
        plan={{
          code: plan.code,
          name: plan.name,
          price: plan.price,
          description: plan.description,
          usageLabel,
          subscriptionStatus: String(customer.subscription_status || customer.plan_status || "active"),
          trialStatus: String(customer.trial_status || "none"),
        }}
        billingActions={billingActions as Array<{ label: string; href: string; tone: "primary" | "secondary" }>}
        qrUsageUsed={qrRows?.length || 0}
        qrUsageLimit={plan.code === "admin" ? null : getEffectiveQrLimit(customer as any)}
        profile={{
          hasProfile: Boolean(profile),
          setupComplete,
          published: profilePublished,
          slug: profile?.slug || null,
          publicUrl: publicProfileUrl,
          publicDisplayUrl: publicProfileDisplayUrl,
          statusLabel: profileStatusLabel,
          completionLabel: profileCompletionLabel,
          guidedSetupHref: "/portal/connect/setup",
          builderHref,
          builderLocked: !advancedBuilderUnlocked,
        }}
        brandColors={normalizeBrandColors((customer as any).brand_colors)}
        supportEmail="support@clutchprintshop.com"
        helpCenterHref="https://clutchprintshop.com"
      />
    </DashboardShell>
  );
}
