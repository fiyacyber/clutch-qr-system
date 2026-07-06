import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import ConnectTabs from "@/components/connect/ConnectTabs";
import { requireCustomer } from "@/lib/auth";
import { clutchConnectProfileUrl } from "@/lib/qr";
import { getCustomerPlan, hasEntitlement, isAdvancedBuilderUnlocked } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function PortalConnectLinksPage() {
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

  const plan = getCustomerPlan(customer);
  const hasDynamicQr = hasEntitlement(customer, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer, "heatmapAnalytics") || plan.code === "admin";
  const advancedBuilderUnlocked = isAdvancedBuilderUnlocked(customer);

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, slug, business_name, contact_name")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (profileError) {
    console.error("[portal-data-error]", {
      route: "/portal/connect/links",
      endpoint: "supabase:profiles.maybeSingle",
      code: profileError.code ?? null,
      message: profileError.message ?? "Unknown error",
      details: profileError.details ?? null,
      hint: profileError.hint ?? null,
    });
  }

  if (!profile) {
    redirect(advancedBuilderUnlocked ? "/portal/connect/build" : "/portal/connect/setup");
  }

  const { data: links, error: linksError } = await admin
    .from("profile_links")
    .select("id, label, url, is_active, sort_order")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: true });

  if (linksError) {
    console.error("[portal-data-error]", {
      route: "/portal/connect/links",
      endpoint: "supabase:profile_links.select",
      code: linksError.code ?? null,
      message: linksError.message ?? "Unknown error",
      details: linksError.details ?? null,
      hint: linksError.hint ?? null,
    });
  }

  return (
    <DashboardShell
      isAdmin={Boolean(customer.is_admin)}
      navVariant={plan.code === "connect_basic" ? "connect-basic" : "default"}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      <main className="container connect-center-shell">
        <DashboardHeader
          title="Clutch Connect Links"
          subtitle="Review your public action links and jump into the builder for full editing."
          actions={(
            <div className="connect-center-header-actions">
              {advancedBuilderUnlocked ? <Link className="btn primary" href="/portal/connect/build">Open Builder</Link> : null}
              <Link className="btn secondary" href="/portal/connect">Overview</Link>
            </div>
          )}
        />

        <ConnectTabs active="profile" />

        <section className="connect-center-card">
          <p className="connect-center-kicker">Current Links</p>
          <h2>{profile.business_name || profile.contact_name || "Profile"}</h2>
          <ul className="analytics-list">
            {(links?.length ? links : [{ id: "empty", label: "No links added yet", url: "", is_active: false }]).map((link: any) => (
              <li key={link.id}>
                <span>{link.label || "Untitled Link"}</span>
                <strong>{link.is_active === false ? "Hidden" : "Live"}</strong>
              </li>
            ))}
          </ul>
          <div className="connect-center-inline-actions">
            <Link className="btn primary" href={advancedBuilderUnlocked ? "/portal/connect/build" : "/portal/connect/setup"}>
              {advancedBuilderUnlocked ? "Manage in Builder" : "Manage in Guided Setup"}
            </Link>
            {profile.slug ? <Link className="btn ghost" href={clutchConnectProfileUrl(profile.slug)} target="_blank">Open Public Profile</Link> : null}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
