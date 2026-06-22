import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

interface LinksPageProps {
  searchParams?: Promise<Record<string, string>>;
}

export default async function PortalConnectLinksPage({ searchParams }: LinksPageProps) {
  const params = (await searchParams) || {};
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!profile) {
    redirect("/portal/connect");
  }

  const { data: links } = await admin
    .from("profile_links")
    .select("*")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: true });

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />
      <main className="container">
        <section className="portal-dashboard-header">
          <div>
            <p className="eyebrow">Clutch Connect</p>
            <h1>Manage Profile Links</h1>
            <p>Add, reorder, toggle, and remove links shown on your public profile.</p>
          </div>
          <div className="dashboard-badges">
            <span>{(links || []).length} links</span>
            <span><Link href={`/u/${profile.slug}`} target="_blank">Open profile</Link></span>
          </div>
        </section>

        <section className="create-page-nav">
          <Link className="btn ghost" href="/portal/connect">Back to Profile</Link>
          <Link className="btn secondary" href="/portal/connect/leads">View Leads</Link>
        </section>

        {params.saved === "1" ? <div className="success-message">Links saved.</div> : null}

        <section className="card">
          <p className="eyebrow">Add Link</p>
          <form className="admin-form-grid" action="/api/connect/links" method="post">
            <input type="hidden" name="action" value="create" />
            <input type="hidden" name="profile_id" value={profile.id} />
            <input className="input" name="label" placeholder="Label" required />
            <input className="input" name="url" placeholder="https://example.com" required />
            <input className="input" name="icon" placeholder="instagram / link / calendar" />
            <button className="btn primary" type="submit">Add Link</button>
          </form>
        </section>

        <section className="card" style={{ marginTop: "16px" }}>
          <p className="eyebrow">Existing Links</p>
          {(links || []).length ? (
            <div className="comparison-table">
              {(links || []).map((link: any) => (
                <form key={link.id} className="admin-row-form" action="/api/connect/links" method="post">
                  <input type="hidden" name="action" value="update" />
                  <input type="hidden" name="profile_id" value={profile.id} />
                  <input type="hidden" name="link_id" value={link.id} />

                  <input className="input" name="label" defaultValue={link.label} />
                  <input className="input" name="url" defaultValue={link.url} />
                  <input className="input" name="icon" defaultValue={link.icon || ""} />
                  <input className="input" type="number" name="sort_order" defaultValue={link.sort_order || 0} />
                  <select className="input" name="is_active" defaultValue={String(link.is_active)}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>

                  <button className="btn secondary" type="submit">Save</button>

                  <button
                    className="btn ghost"
                    type="submit"
                    name="action"
                    value="delete"
                    formAction="/api/connect/links"
                  >
                    Delete
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <div className="analytics-empty">No custom links yet. Add your first link above.</div>
          )}
        </section>
      </main>
    </div>
  );
}
