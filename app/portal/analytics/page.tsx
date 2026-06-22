import Link from "next/link";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { countValues, getScanDevice } from "@/lib/analytics";
import "./analytics.css";

export default async function AnalyticsPage() {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) redirect("/login");

  const admin = createSupabaseAdminClient();

  // Get all QR codes for this customer
  const { data: codes, error: codesError } = await admin
    .from("qr_codes")
    .select("id, name, slug, scan_count, created_at, updated_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (codesError) {
    return <div className="analytics-error">Failed to load QR codes</div>;
  }

  const qrIds = (codes || []).map((code) => code.id);
  let scans: any[] = [];

  if (qrIds.length > 0) {
    const { data: scansData, error: scansError } = await admin
      .from("qr_scans")
      .select("*")
      .in("qr_code_id", qrIds)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (scansError) {
      return <div className="analytics-error">Failed to load analytics</div>;
    }
    scans = scansData || [];
  }

  // Calculate metrics
  const totalScans = scans.length;
  const uniqueVisitors = new Set(scans.map((s) => s.ip_hash).filter(Boolean)).size;
  const repeatScans = Math.max(0, totalScans - uniqueVisitors);

  // Device breakdown
  const deviceCounts = countValues(scans.map((s) => getScanDevice(s)));

  return (
    <main className="analytics-container">
      <Header />

      <div className="analytics-header">
        <h1>QR Analytics Dashboard</h1>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Scans</span>
          <span className="metric-value">{totalScans}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Unique Visitors</span>
          <span className="metric-value">{uniqueVisitors}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Repeat Scans</span>
          <span className="metric-value">{repeatScans}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">QR Codes</span>
          <span className="metric-value">{(codes || []).length}</span>
        </div>
      </div>

      {/* Device Breakdown */}
      {deviceCounts.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">Scans by Device</div>
          <div className="chart-bars">
            {deviceCounts.slice(0, 10).map((item) => (
              <div className="chart-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div className="chart-bar-track">
                  <i
                    style={{
                      width: `${(item.value / Math.max(...deviceCounts.map((d) => d.value), 1)) * 100}%`,
                    }}
                  />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Codes */}
      <div className="chart-container">
        <div className="chart-title">Your QR Codes</div>
        {(codes && codes.length > 0) ? (
          <div className="analytics-table">
            <div
              className="analytics-table-header"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
              }}
            >
              <span>Name</span>
              <span>Scans</span>
              <span>Slug</span>
              <span>Action</span>
            </div>
            {codes.map((code) => (
              <div
                key={code.id}
                className="analytics-table-row"
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                }}
              >
                <span>{code.name}</span>
                <span>{code.scan_count || 0}</span>
                <span style={{ fontSize: "0.85rem" }}>{code.slug}</span>
                <Link href={`/portal/analytics/${code.id}`} className="link-action">
                  View
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="analytics-empty">
            No QR codes yet. Create one in the portal to start tracking!
          </div>
        )}
      </div>

      {/* Getting Started */}
      <div className="chart-container">
        <div className="chart-title">Getting Started</div>
        <div style={{ padding: "1rem", color: "#666", lineHeight: "1.6" }}>
          <p>
            Click on any QR code above to view detailed analytics including:
          </p>
          <ul style={{ margin: "1rem 0", paddingLeft: "1.5rem" }}>
            <li>Scans over time with interactive charts</li>
            <li>Activity heatmap by day and hour</li>
            <li>Device, browser, and OS breakdown</li>
            <li>Geographic distribution of scans</li>
            <li>Automated insights and recommendations</li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            Track your print campaign performance in real-time!
          </p>
        </div>
      </div>
    </main>
  );
}
