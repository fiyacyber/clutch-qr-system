import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Eye, Link2, Palette, PenSquare, Users } from "lucide-react";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

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

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />

      <main className="container connect-dashboard-shell">
        <section className="connect-dashboard-hero">
          <div className="connect-dashboard-hero-main">
            <p className="eyebrow">Clutch Connect</p>
            <h1>
              Smart Business Card
              <br />
              Profile
            </h1>
            <p>
              Build your customer-facing profile with branded links, lead capture, and contact download.
            </p>

            <div className="connect-dashboard-hero-actions">
              <Link className="btn primary" href="/portal/connect/build">
                <Palette size={16} />
                Profile Builder
              </Link>
              {profile?.slug ? (
                <Link className="btn secondary" href={`/u/${profile.slug}`} target="_blank">
                  <Eye size={16} />
                  View Public Profile
                </Link>
              ) : null}
            </div>
          </div>

          <div className="connect-dashboard-hero-metrics" aria-label="Connect performance metrics">
            <article className="connect-dashboard-hero-metric-card">
              <span className="connect-dashboard-hero-metric-label">Profile Views</span>
              <strong>{profileViews}</strong>
            </article>
            <article className="connect-dashboard-hero-metric-card">
              <span className="connect-dashboard-hero-metric-label">Link Clicks</span>
              <strong>{linkClicks}</strong>
            </article>
            <article className="connect-dashboard-hero-metric-card">
              <span className="connect-dashboard-hero-metric-label">Leads Captured</span>
              <strong>{leadTotal}</strong>
            </article>
            <article className="connect-dashboard-hero-metric-card">
              <span className="connect-dashboard-hero-metric-label">Total Events</span>
              <strong>{totalClicks}</strong>
            </article>
          </div>
        </section>

        <section className="connect-dashboard-action-grid" aria-label="Primary actions">
          <Link className="connect-dashboard-action-card active" href="/portal/connect/build">
            <span className="connect-dashboard-action-icon"><Palette size={20} /></span>
            <span className="connect-dashboard-action-label">Profile Builder</span>
          </Link>

          <Link className="connect-dashboard-action-card" href="/portal/connect/edit">
            <span className="connect-dashboard-action-icon"><PenSquare size={20} /></span>
            <span className="connect-dashboard-action-label">Edit Public Page</span>
          </Link>

          {profile?.slug ? (
            <Link className="connect-dashboard-action-card" href={`/u/${profile.slug}`} target="_blank">
              <span className="connect-dashboard-action-icon"><Eye size={20} /></span>
              <span className="connect-dashboard-action-label">View Public Profile</span>
            </Link>
          ) : null}

          <Link className="connect-dashboard-action-card" href="/portal/connect/links">
            <span className="connect-dashboard-action-icon"><Link2 size={20} /></span>
            <span className="connect-dashboard-action-label">Manage Links</span>
          </Link>

          <Link className="connect-dashboard-action-card" href="/portal/connect/leads">
            <span className="connect-dashboard-action-icon"><Users size={20} /></span>
            <span className="connect-dashboard-action-label">View Leads</span>
          </Link>
        </section>

        {params.saved === "1" ? <div className="success-message">Profile saved.</div> : null}

        <section className="connect-dashboard-overview">
          <div className="connect-dashboard-overview-heading">
            <h2>Overview</h2>
            <p className="muted">Your Clutch Connect profile performance at a glance.</p>
          </div>

          <div className="connect-dashboard-overview-grid">
            <article className="connect-dashboard-overview-card">
              <span className="connect-dashboard-overview-icon"><Eye size={20} /></span>
              <div>
                <p className="connect-dashboard-overview-label">Profile Views</p>
                <h3>{profileViews}</h3>
                <p className="muted">Total public profile views tracked.</p>
              </div>
            </article>

            <article className="connect-dashboard-overview-card">
              <span className="connect-dashboard-overview-icon"><Link2 size={20} /></span>
              <div>
                <p className="connect-dashboard-overview-label">Link Clicks</p>
                <h3>{linkClicks}</h3>
                <p className="muted">Custom link clicks from your profile.</p>
              </div>
            </article>

            <article className="connect-dashboard-overview-card">
              <span className="connect-dashboard-overview-icon"><Activity size={20} /></span>
              <div>
                <p className="connect-dashboard-overview-label">Events</p>
                <h3>{totalClicks}</h3>
                <p className="muted">Total trackable Clutch Connect interactions.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="connect-dashboard-banner">
          <div className="connect-dashboard-banner-icon" aria-hidden="true">◆</div>
          <div className="connect-dashboard-banner-copy">
            <h3>Your Profile. Your Brand. Your Results.</h3>
            <p className="muted">Clutch Connect helps you share, capture, and convert all from one powerful profile.</p>
          </div>
          <Link className="btn ghost" href="/portal/connect/leads">
            View Analytics
          </Link>
        </section>
      </main>
    </div>
  );
}
