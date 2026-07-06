import Link from "next/link";
import Header from "@/components/Header";

export default function PricingPage() {
  return (
    <div className="page-shell">
      <Header />
      <main className="container" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
        <section className="pricing-hero">
          <p className="eyebrow">Clutch Plans</p>
          <h1>Pricing built for print + QR growth.</h1>
          <p>Choose the plan that matches your campaign size and team needs.</p>
          <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
            <Link className="btn primary" href="/login?next=/portal/connect">View Portal Pricing</Link>
            <Link className="btn secondary" href="/login">Sign In</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
