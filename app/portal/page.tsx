import { redirect } from "next/navigation";
import Header from "@/components/Header";
import StyledQRPreview from "@/components/StyledQRPreview";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { qrUrl } from "@/lib/qr";

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

  const codes = (qrCodes || []).map((code) => ({
    ...code,
    url: qrUrl(code.slug),
  }));

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
              {codes.reduce((sum, c) => sum + (c.scan_count || 0), 0)}
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
          {codes.map((code) => (
            <article className="card" key={code.id}>
              <h2>{code.name}</h2>

              <p className="muted">{code.url}</p>

              <StyledQRPreview
                url={code.url}
                foregroundColor={code.foreground_color || "#384862"}
                backgroundColor={code.background_color || "#ffffff"}
                dotStyle={code.dot_style || "square"}
                cornerStyle={code.corner_style || "square"}
                logoUrl={code.logo_url}
              />

              <p>
                <strong>Scans:</strong> {code.scan_count}
              </p>

              <form
                className="form"
                action="/api/qr/update"
                method="post"
                encType="multipart/form-data"
              >
                <input type="hidden" name="id" value={code.id} />

                <label className="label">
                  Name
                  <input
                    className="input"
                    name="name"
                    defaultValue={code.name}
                  />
                </label>

                <label className="label">
                  Destination URL
                  <input
                    className="input"
                    name="destination_url"
                    defaultValue={code.destination_url}
                  />
                </label>

                <div className="color-grid">
                  <label className="label color-label">
                    QR Color
                    <input
                      type="color"
                      name="foreground_color"
                      defaultValue={code.foreground_color || "#384862"}
                    />
                  </label>

                  <label className="label color-label">
                    Background Color
                    <input
                      type="color"
                      name="background_color"
                      defaultValue={code.background_color || "#ffffff"}
                    />
                  </label>
                </div>

                <label className="label">
                  Dot Style
                  <select
                    className="input"
                    name="dot_style"
                    defaultValue={code.dot_style || "square"}
                  >
                    <option value="square">Square</option>
                    <option value="rounded">Rounded</option>
                    <option value="dots">Dots</option>
                    <option value="classy">Classy</option>
                    <option value="classy-rounded">Classy Rounded</option>
                    <option value="extra-rounded">Extra Rounded</option>
                  </select>
                </label>

                <label className="label">
                  Corner Style
                  <select
                    className="input"
                    name="corner_style"
                    defaultValue={code.corner_style || "square"}
                  >
                    <option value="square">Square</option>
                    <option value="dot">Dot</option>
                    <option value="extra-rounded">Extra Rounded</option>
                  </select>
                </label>

                <label className="label">
                  Logo
                  <input
                    className="input"
                    type="file"
                    name="logo"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  />
                </label>

                {code.logo_url ? (
                  <label className="label checkbox-row">
                    <input type="checkbox" name="remove_logo" value="true" />
                    Remove uploaded logo
                  </label>
                ) : null}

                <div className="actions">
                  <button className="btn primary">Save</button>
                </div>
              </form>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
