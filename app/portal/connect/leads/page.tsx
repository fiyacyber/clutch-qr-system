import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function PortalConnectLeadsPage() {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, business_name, contact_name")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!profile) redirect("/portal/connect");

  const [{ data: leads }, { data: events }] = await Promise.all([
    admin
      .from("profile_leads")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("profile_click_events")
      .select("event_type")
      .eq("profile_id", profile.id),
  ]);

  const rows = leads || [];
  const clickEvents = events || [];

  const leadSubmits = clickEvents.filter((event: any) => event.event_type === "lead_submit").length;
  const views = clickEvents.filter((event: any) => event.event_type === "profile_view").length;
  const linkClicks = clickEvents.filter((event: any) => event.event_type === "link_click").length;

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />

      <main className="container">
        <section className="portal-dashboard-header">
          <div>
            <p className="eyebrow">Clutch Connect</p>
            <h1>Leads & Activity</h1>
            <p>Review contact requests and profile engagement for your smart business card page.</p>
          </div>

          <div className="dashboard-badges">
            <span>{rows.length} leads</span>
            <span>{views} profile views</span>
            <span>{linkClicks} link clicks</span>
            <span>{leadSubmits} lead submits</span>
          </div>
        </section>

        <section className="create-page-nav">
          <Link className="btn ghost" href="/portal/connect">Back to Profile</Link>
          <Link className="btn secondary" href="/portal/connect/links">Manage Links</Link>
          <Link className="btn primary" href={`/u/${profile.slug}`} target="_blank">Open Public Profile</Link>
        </section>

        <section className="analytics-grid">
          <article className="analytics-card">
            <p className="eyebrow">Profile</p>
            <h3>{profile.business_name || profile.contact_name || "Clutch Connect"}</h3>
            <p className="muted">/{profile.slug}</p>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Total Leads</p>
            <h3>{rows.length}</h3>
            <p className="muted">Captured from your public profile form.</p>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Engagement</p>
            <h3>{views + linkClicks}</h3>
            <p className="muted">Profile views and link interactions.</p>
          </article>
        </section>

        <section className="card" style={{ marginTop: "16px" }}>
          <p className="eyebrow">Lead Inbox</p>
          {rows.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Message</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead: any) => (
                  <tr key={lead.id}>
                    <td>{lead.name || "-"}</td>
                    <td>{lead.email || "-"}</td>
                    <td>{lead.phone || "-"}</td>
                    <td>{lead.message || "-"}</td>
                    <td>{formatDate(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="analytics-empty">No leads yet. Share your Clutch Connect profile to start collecting requests.</div>
          )}
        </section>
      </main>
    </div>
  );
}
