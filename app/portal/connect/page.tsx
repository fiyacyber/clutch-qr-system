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
          <Link className="btn ghost" href="/portal/connect/links">Manage Links</Link>
          <Link className="btn secondary" href="/portal/connect/leads">View Leads</Link>
          {profile?.slug ? (
            <Link className="btn primary" href={`/u/${profile.slug}`} target="_blank">Open Public Profile</Link>
          ) : null}
        </section>

        {params.saved === "1" ? <div className="success-message">Profile saved.</div> : null}

        <section className="card">
          <p className="eyebrow">Profile Editor</p>
          <h2>Public Profile Settings</h2>
          <form className="form" action="/api/connect/profile" method="post">
            <input type="hidden" name="profile_id" value={profile?.id || ""} />

            <div className="admin-form-grid">
              <label className="label">
                Business Name
                <input className="input" name="business_name" defaultValue={profile?.business_name || customer.company_name || ""} />
              </label>
              <label className="label">
                Contact Name
                <input className="input" name="contact_name" defaultValue={profile?.contact_name || customer.first_name || ""} />
              </label>
              <label className="label">
                Title
                <input className="input" name="title" defaultValue={profile?.title || ""} placeholder="Owner / Sales Manager" />
              </label>
              <label className="label">
                Phone
                <input className="input" name="phone" defaultValue={profile?.phone || ""} placeholder="+1 555 555 5555" />
              </label>
              <label className="label">
                Email
                <input className="input" type="email" name="email" defaultValue={profile?.email || customer.email || ""} />
              </label>
              <label className="label">
                Website
                <input className="input" name="website" defaultValue={profile?.website || ""} placeholder="clutchprintshop.com" />
              </label>
              <label className="label">
                Avatar URL
                <input className="input" name="avatar_url" defaultValue={profile?.avatar_url || ""} />
              </label>
              <label className="label">
                Cover URL
                <input className="input" name="cover_url" defaultValue={profile?.cover_url || ""} />
              </label>
              <label className="label">
                Theme Color
                <input className="input" type="color" name="theme_color" defaultValue={profile?.theme_color || "#FFA665"} />
              </label>
              <label className="label">
                Profile Slug
                <input className="input" name="slug" defaultValue={profile?.slug || fallbackSlug} />
              </label>
              <label className="label">
                Status
                <select className="input" name="is_active" defaultValue={String(profile?.is_active ?? true)}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </div>

            <label className="label">
              Bio
              <textarea className="input" name="bio" rows={4} defaultValue={profile?.bio || ""} />
            </label>

            <div className="actions">
              <button className="btn primary" type="submit">Save Profile</button>
              {profile?.slug ? <Link className="btn ghost" href={`/u/${profile.slug}`} target="_blank">Preview Public Page</Link> : null}
            </div>
          </form>
        </section>

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
