import Link from "next/link";
import Header from "@/components/Header";
import {
  countValues,
  getScanDevice,
  getScanBrowser,
  getScanOs,
  getScanLocation,
  getScanPrintPieceType,
  generateInsights,
  getBestHour,
  QRAnalyticsScan,
  QRAnalyticsCode,
} from "@/lib/analytics";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import "../analytics.css";
import { loadAccountAccess } from "@/lib/account-access-server";

export default async function QRAnalyticsPage({
  params,
}: {
  params: Promise<{ qrId: string }>;
}) {
  const { qrId } = await params;
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) {
    return (
      <DashboardShell>
        <PortalCustomerLookupUnavailable />
      </DashboardShell>
    );
  }
  if (!customer) return <PortalAccountNotActive />;

  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  if (!access.canUseCampaignAnalytics) redirect("/portal?access=campaign-analytics-locked");

  // Get the QR code
  const { data: code, error: codeError } = await admin
    .from("qr_codes")
    .select("*")
    .eq("id", qrId)
    .eq("customer_id", customer.id)
    .single();

  if (codeError || !code) {
    if (codeError) {
      console.error("[portal-data-error]", {
        route: "/portal/analytics/[qrId]",
        endpoint: "supabase:qr_codes.single",
        code: codeError.code ?? null,
        message: codeError.message ?? "Unknown error",
        details: codeError.details ?? null,
        hint: codeError.hint ?? null,
      });
    }
    return <div className="analytics-error">QR code not found</div>;
  }

  // Get all scans for this QR code
  const { data: scans, error: scansError } = await admin
    .from("qr_scans")
    .select("*")
    .eq("qr_code_id", qrId)
    .order("created_at", { ascending: false });

  if (scansError) {
    console.error("[portal-data-error]", {
      route: "/portal/analytics/[qrId]",
      endpoint: "supabase:qr_scans.select",
      code: scansError.code ?? null,
      message: scansError.message ?? "Unknown error",
      details: scansError.details ?? null,
      hint: scansError.hint ?? null,
    });
    return <div className="analytics-error">Failed to load analytics</div>;
  }

  const qrScans = (scans || []) as QRAnalyticsScan[];
  const uniqueIps = new Set(qrScans.map((s) => s.ip_hash).filter(Boolean));
  const repeatScans = Math.max(0, qrScans.length - uniqueIps.size);

  // Analytics data
  const deviceBreakdown = countValues(qrScans.map(getScanDevice));
  const browserBreakdown = countValues(qrScans.map(getScanBrowser));
  const osBreakdown = countValues(qrScans.map(getScanOs));
  const locationBreakdown = countValues(qrScans.map(getScanLocation));
  const printPieceTypeBreakdown = countValues(qrScans.map(getScanPrintPieceType));
  const insights = generateInsights([code as QRAnalyticsCode], qrScans);
  const bestHour = getBestHour(qrScans);

  // Scans over time
  const scansByDay = countValues(
    qrScans.map((s) => {
      if (!s.created_at) return "Unknown";
      return new Date(s.created_at).toISOString().split("T")[0];
    })
  );

  // Heatmap by day/hour for visualization
  const heatmapData = new Map<string, Map<string, number>>();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  days.forEach((day) => {
    heatmapData.set(day, new Map());
    for (let h = 0; h < 24; h++) {
      heatmapData.get(day)!.set(h.toString().padStart(2, "0"), 0);
    }
  });

  qrScans.forEach((scan) => {
    if (!scan.created_at) return;
    const date = new Date(scan.created_at);
    const day = days[date.getDay()];
    const hour = date.getHours().toString().padStart(2, "0");
    const dayData = heatmapData.get(day);
    if (dayData) {
      dayData.set(hour, (dayData.get(hour) || 0) + 1);
    }
  });

  const getHeatmapCellClass = (count: number, max: number) => {
    if (count === 0) return "heatmap-cell";
    const intensity = Math.ceil((count / Math.max(max, 1)) * 4);
    return `heatmap-cell active-${Math.min(intensity, 4)}`;
  };

  const maxHeatmapValue = Math.max(
    ...Array.from(heatmapData.values()).map((m) =>
      Math.max(...Array.from(m.values()))
    )
  );

  return (
    <main className="analytics-container">
      <Header />

      <div className="analytics-header">
        <Link href="/portal/analytics" className="back-link">
          ← Back to All Analytics
        </Link>
        <h1>{code.name}</h1>
        <div></div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Scans</span>
          <span className="metric-value">{qrScans.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Unique Visitors</span>
          <span className="metric-value">{uniqueIps.size}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Repeat Scans</span>
          <span className="metric-value">{repeatScans}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Peak Hour</span>
          <span className="metric-value">
            {bestHour
              ? `${parseInt(bestHour) % 12 || 12}${parseInt(bestHour) >= 12 ? "P" : "A"}`
              : "N/A"}
          </span>
        </div>
      </div>

      {/* Scans Over Time */}
      {scansByDay.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">Scans Over Time (Last 30 days)</div>
          <div className="chart-bars">
            {scansByDay.slice(0, 30).map((item) => (
              <div className="chart-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div className="chart-bar-track">
                  <i
                    style={{
                      width: `${(item.value / Math.max(...scansByDay.map((d) => d.value), 1)) * 100}%`,
                    }}
                  />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="chart-container">
        <div className="chart-title">Activity</div>
        <div className="heatmap-grid">
          {Array.from(heatmapData.entries()).map(([day]) =>
            Array.from({ length: 24 }).map((_, hour) => {
              const count = heatmapData.get(day)?.get(hour.toString().padStart(2, "0")) || 0;
              return (
                <div
                  key={`${day}-${hour}`}
                  className={getHeatmapCellClass(count, maxHeatmapValue)}
                  title={`${day} ${hour.toString().padStart(2, "0")}:00 - ${count} scans`}
                >
                  {count > 0 && count}
                </div>
              );
            })
          )}
        </div>
        <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "1rem" }}>
          Tip: Each cell represents an hour. Darker orange = more scans
        </div>
      </div>

      {/* Print Piece Type Breakdown */}
      {printPieceTypeBreakdown.length > 0 && printPieceTypeBreakdown.some(item => item.label !== "Not specified") && (
        <div className="chart-container">
          <div className="chart-title">Print Piece Type</div>
          <div className="chart-bars">
            {printPieceTypeBreakdown.map((item) => (
              <div className="chart-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div className="chart-bar-track">
                  <i
                    style={{
                      width: `${(item.value / Math.max(...printPieceTypeBreakdown.map((d) => d.value), 1)) * 100}%`,
                    }}
                  />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="analytics-two-col">
        {/* Devices */}
        {deviceBreakdown.length > 0 && (
          <div className="chart-container">
            <div className="chart-title">Devices</div>
            <div className="chart-bars">
              {deviceBreakdown.map((item) => (
                <div className="chart-bar-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="chart-bar-track">
                    <i
                      style={{
                        width: `${(item.value / Math.max(...deviceBreakdown.map((d) => d.value), 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Browsers */}
        {browserBreakdown.length > 0 && (
          <div className="chart-container">
            <div className="chart-title">Browsers</div>
            <div className="chart-bars">
              {browserBreakdown.map((item) => (
                <div className="chart-bar-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="chart-bar-track">
                    <i
                      style={{
                        width: `${(item.value / Math.max(...browserBreakdown.map((d) => d.value), 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* OS and Locations */}
      <div className="analytics-two-col">
        {/* Operating Systems */}
        {osBreakdown.length > 0 && (
          <div className="chart-container">
            <div className="chart-title">Operating Systems</div>
            <div className="chart-bars">
              {osBreakdown.map((item) => (
                <div className="chart-bar-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="chart-bar-track">
                    <i
                      style={{
                        width: `${(item.value / Math.max(...osBreakdown.map((d) => d.value), 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Locations */}
        {locationBreakdown.length > 0 && (
          <div className="chart-container">
            <div className="chart-title">Top Locations</div>
            <div className="chart-bars">
              {locationBreakdown.slice(0, 5).map((item) => (
                <div className="chart-bar-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="chart-bar-track">
                    <i
                      style={{
                        width: `${(item.value / Math.max(...locationBreakdown.map((d) => d.value), 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="chart-container">
          <div className="chart-title">Insights</div>
          <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
            {insights.map((insight, idx) => (
              <li key={idx} style={{ marginBottom: "0.5rem", color: "#666" }}>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
