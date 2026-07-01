import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCustomerPlan, isAdvancedAnalyticsUnlocked } from "@/lib/plans";
import {
  buildAdvancedAnalytics,
  type AnalyticsFilters,
} from "@/lib/analytics";

interface AnalyticsReportPageProps {
  searchParams?: Promise<Record<string, string>>;
}

export default async function AnalyticsReportPage({ searchParams }: AnalyticsReportPageProps) {
  const params = (await searchParams) || {};
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");
  if (!isAdvancedAnalyticsUnlocked(customer)) redirect("/portal");

  const admin = createSupabaseAdminClient();
  const { data: qrCodes } = await admin
    .from("qr_codes")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  const codes = qrCodes || [];
  const qrIds = codes.map((code) => code.id);
  const { data: scanRows } = qrIds.length
    ? await admin
        .from("qr_scans")
        .select("*")
        .in("qr_code_id", qrIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const filters: AnalyticsFilters = {
    qr: params.qr || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    device: params.device || undefined,
    browser: params.browser || undefined,
    location: params.location || undefined,
    referrer: params.referrer || undefined,
  };
  const analytics = buildAdvancedAnalytics(codes, scanRows || [], filters);
  const scannedBestPerforming = analytics.bestPerforming.filter((item) => item.totalScans > 0);
  const topQrCode = scannedBestPerforming[0];
  const plan = getCustomerPlan(customer);

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />
      <main className="container printable-report">
        <section className="portal-dashboard-header">
          <div>
            <p className="eyebrow">Printable Report</p>
            <h1>Clutch QR Analytics</h1>
            <p>{plan.name} report for {customer.company_name || customer.email}</p>
          </div>
          <div className="dashboard-badges">
            <span>Use browser print</span>
            <span>Save as PDF</span>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="metric-card">
            <span className="metric-label">Scans</span>
            <strong className="metric-value">{analytics.totalScans}</strong>
            <p>Filtered scan volume.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Unique Scans</span>
            <strong className="metric-value">{analytics.uniqueScans}</strong>
            <p>Based on hashed IPs when available.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">QR Codes</span>
            <strong className="metric-value">{codes.length}</strong>
            <p>Included in this report.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Top QR</span>
            <strong className="metric-value plan-name">{topQrCode?.name || "None"}</strong>
            <p>{topQrCode?.totalScans || 0} scans.</p>
          </div>
        </section>

        <section className="analytics-grid">
          <article className="analytics-card wide">
            <p className="eyebrow">Best Performing QR Codes</p>
            <ul className="analytics-list">
              {(scannedBestPerforming.length ? scannedBestPerforming : [{ id: "empty", name: "No scan data yet", totalScans: 0, recentScans: 0, uniqueScans: 0 }]).map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <strong>{item.totalScans}</strong>
                </li>
              ))}
            </ul>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Device Mix</p>
            <ul className="analytics-list">
              {(analytics.deviceBreakdown.length ? analytics.deviceBreakdown : [{ label: "No scan data yet", value: 0 }]).map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Referrer Sources</p>
            <ul className="analytics-list">
              {(analytics.referrerBreakdown.length ? analytics.referrerBreakdown : [{ label: "No scan data yet", value: 0 }]).map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}
