import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { buildDefaultProfileSlug } from "@/lib/connect";

interface ConnectPageProps {
  searchParams?: Promise<Record<string, string>>;
}

export default async function PortalConnectPage({ searchParams }: ConnectPageProps) {
  const params = (await searchParams) || {};
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  let leadTotal = 0;
  let clicks: any[] = [];

  if (profile?.id) {
    const [{ count }, { data: clickRows }] = await Promise.all([
      admin
        .from("profile_leads")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id),
      admin
        .from("profile_click_events")
        .select("event_type")
        .eq("profile_id", profile.id),
    ]);

    leadTotal = count || 0;
    clicks = clickRows || [];
  }

  const totalClicks = clicks.length;
  const linkClicks = clicks.filter((event: any) => event.event_type === "link_click").length;
  const profileViews = clicks.filter((event: any) => event.event_type === "profile_view").length;

  const fallbackSlug = buildDefaultProfileSlug(customer.company_name || customer.email || "clutch-connect");

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />

      <main className="container">
        <section className="portal-dashboard-header">
          <div>
            <p className="eyebrow">Clutch Connect</p>
            <h1>Smart Business Card Profile</h1>
            <p>
              Build your customer-facing profile with branded links, lead capture, and contact download.
            </p>
          </div>

          <div className="dashboard-badges">
            <span>{profile?.is_active ? "Live" : "Draft"}</span>
            <span>{profileViews} profile views</span>
            <span>{leadTotal} leads</span>
            <span>{totalClicks} total events</span>
          </div>
        </section>

        <section className="create-page-nav">
          <Link className="btn primary" href="/portal/connect/edit">Edit Public Page</Link>
          {profile?.slug ? (
            <Link className="btn secondary" href={`/u/${profile.slug}`} target="_blank">View Public Profile</Link>
          ) : null}
          <Link className="btn ghost" href="/portal/connect/links">Manage Links</Link>
          <Link className="btn ghost" href="/portal/connect/leads">View Leads</Link>
        </section>

        {params.saved === "1" ? <div className="success-message">Profile saved.</div> : null}

        <section className="analytics-grid" style={{ marginTop: "18px" }}>
          <article className="analytics-card">
            <p className="eyebrow">Profile Views</p>
            <h3>{profileViews}</h3>
            <p className="muted">Total public profile views tracked.</p>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Link Clicks</p>
            <h3>{linkClicks}</h3>
            <p className="muted">Custom link clicks from your profile.</p>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Events</p>
            <h3>{totalClicks}</h3>
            <p className="muted">Total trackable Clutch Connect interactions.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
