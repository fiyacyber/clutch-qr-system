import Link from "next/link";
import Header from "@/components/Header";

export default function ExportTestPage() {
  return (
    <div className="page-shell">
      <Header />
      <main className="container" style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
        <section className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
          <p className="eyebrow">Export Diagnostics</p>
          <h1>Export Test Utilities</h1>
          <p className="muted">
            Use this route to validate export behavior in development and staging without entering the full portal flow.
          </p>
          <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
            <Link className="btn primary" href="/portal/create">Open QR Studio</Link>
            <Link className="btn ghost" href="/portal/analytics">Open Analytics</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
