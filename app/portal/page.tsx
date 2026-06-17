import { redirect } from "next/navigation";
import Header from "@/components/Header";
import QRCodeEditForm from "@/components/QRCodeEditForm";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function PortalPage() {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");

  if (!customer) {
    return (
      <main className="container">
        <div className="card">
          <h1>Account not active yet</h1>
          <p className="muted">
            Use the same email from your QR Pro checkout. If you just purchased,
            wait a minute and refresh.
          </p>
        </div>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: qrCodes } = await admin
    .from("qr_codes")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  const used = qrCodes?.length || 0;
  const limit = customer.qr_limit || 10;

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />

      <main className="container">
        <section className="hero">
          <div>
            <h1>Clutch QR Dashboard</h1>
            <p>
              Create dynamic QR codes, update destinations anytime, and track
              scans from your printed marketing.
            </p>
          </div>

          <img src="/clutch-logo.png" alt="Clutch" />
        </section>

        <section className="grid">
          <div className="card">
            <h3>Total QR Codes</h3>
            <div className="stat">
              {used}/{limit}
            </div>
            <p className="muted">Your active account limit.</p>
          </div>

          <div className="card">
            <h3>Total Scans</h3>
            <div className="stat">
              {qrCodes?.reduce((sum, c) => sum + (c.scan_count || 0), 0) || 0}
            </div>
            <p className="muted">Across all your QR codes.</p>
          </div>

          <div className="card">
            <h3>Create QR Code</h3>

            <form className="form" action="/api/qr/create" method="post">
              <input
                className="input"
                name="name"
                placeholder="QR name, e.g. Yard Sign"
                required
              />

              <input
                className="input"
                name="destination_url"
                placeholder="Destination URL"
                required
              />

              <button className="btn primary" disabled={used >= limit}>
                Create QR
              </button>
            </form>

            {used >= limit ? (
              <p className="muted">
                Limit reached. Contact Clutch to increase your limit.
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid two">
          {qrCodes?.map((code) => (
            <article className="card" key={code.id}>
              <h2>{code.name}</h2>

              <p className="muted">{code.slug}</p>

              <QRCodeEditForm code={code} />
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
