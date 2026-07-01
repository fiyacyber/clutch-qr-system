import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ConnectTabs from "@/components/connect/ConnectTabs";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function PortalConnectLinksPage() {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, business_name, contact_name")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!profile) {
    redirect("/portal/connect/build");
  }

  const { data: links } = await admin
    .from("profile_links")
    .select("id, label, url, is_active, sort_order")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: true });

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <main className="container connect-center-shell">
        <DashboardHeader
          title="Clutch Connect Links"
          subtitle="Review your public action links and jump into the builder for full editing."
          actions={(
            <div className="connect-center-header-actions">
              <Link className="btn primary" href="/portal/connect/build">Open Builder</Link>
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
            <Link className="btn primary" href="/portal/connect/build">Manage in Builder</Link>
            {profile.slug ? <Link className="btn ghost" href={`/u/${profile.slug}`} target="_blank">Open Public Profile</Link> : null}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
