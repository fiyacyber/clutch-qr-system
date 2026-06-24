import { redirect } from "next/navigation";
import Link from "next/link";
import QRCodeEditForm from "@/components/QRCodeEditForm";
import CustomerLogoUpload from "@/components/CustomerLogoUpload";
import PlanCards from "@/components/PlanCards";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getCustomerPlan,
  getCustomerSubscriptionStatus,
  getEffectiveQrLimit,
  getSubscriptionLockMessage,
  isAdvancedAnalyticsUnlocked,
  isCustomerSubscriptionLocked,
} from "@/lib/plans";
import {
  buildAdvancedAnalytics,
  countValues,
  getBrowser,
  getDeviceType,
  getOperatingSystem,
  getReferrerSource,
  type AnalyticsFilters,
  type CountItem,
} from "@/lib/analytics";

interface PortalPageProps {
  searchParams?: Record<string, string>;
}

function formatDate(value?: string | null) {
  if (!value) return "No scans yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function ChartBars({ items, emptyText }: { items: CountItem[]; emptyText: string }) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  if (!items.length || maxValue === 0) {
    return <div className="analytics-empty">{emptyText}</div>;
  }

  return (
    <div className="chart-bars">
      {items.map((item) => (
        <div className="chart-bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="chart-bar-track">
            <i style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }} />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");

  const errorMessage = searchParams?.error;

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

  if (customer.must_change_password) {
    redirect("/change-password");
  }

  const admin = createSupabaseAdminClient();

  const { data: qrCodes } = await admin
    .from("qr_codes")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  const { data: connectProfiles } = await admin
    .from("profiles")
    .select("id, slug, business_name, contact_name")
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
        .limit(500)
    : { data: [] };

  const scans = scanRows || [];
  const used = codes.length;
  const limit = getEffectiveQrLimit(customer);
  const plan = getCustomerPlan(customer);
  const subscriptionStatus = getCustomerSubscriptionStatus(customer);
  const subscriptionLocked = isCustomerSubscriptionLocked(customer);
  const subscriptionLockMessage = getSubscriptionLockMessage(customer);
  const isFreeQrPlan = plan.code === "free_qr";
  const advancedUnlocked = isAdvancedAnalyticsUnlocked(customer);
  const totalScans = codes.reduce((sum, c) => sum + (c.scan_count || 0), 0);
  const remaining = Math.max(limit - used, 0);
  const limitLabel = plan.code === "admin" ? "Unlimited" : String(limit);
  const remainingLabel = plan.code === "admin" ? "Unlimited" : String(remaining);
  const lastScanAt = scans[0]?.created_at || null;
  const deviceCounts = countValues(scans.map((scan) => getDeviceType(scan.user_agent)));
  const browserCounts = countValues(scans.map((scan) => getBrowser(scan.user_agent)));
  const osCounts = countValues(scans.map((scan) => getOperatingSystem(scan.user_agent)));
  const referrerCounts = countValues(scans.map((scan) => getReferrerSource(scan.referrer)));
  const filters: AnalyticsFilters = {
    qr: searchParams?.qr || undefined,
    from: searchParams?.from || undefined,
    to: searchParams?.to || undefined,
    device: searchParams?.device || undefined,
    browser: searchParams?.browser || undefined,
    location: searchParams?.location || undefined,
    referrer: searchParams?.referrer || undefined,
  };
  const analytics = buildAdvancedAnalytics(codes, scans, filters);
  const scannedCampaigns = analytics.campaignComparison.filter((item) => item.totalScans > 0);
  const scannedBestPerforming = analytics.bestPerforming.filter((item) => item.totalScans > 0);
  const exportParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) exportParams.set(key, value);
  });
  const exportQuery = exportParams.toString();
  const exportHref = `/api/analytics/export${exportQuery ? `?${exportQuery}` : ""}`;
  const reportHref = `/analytics/report${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <main className="container">
        {errorMessage && (
          <div className="alert">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        <DashboardHeader
          title="Clutch QR Portal"
          subtitle="Print smarter, track everything, and optimize every campaign from one dashboard."
          actions={(
            <div className="dashboard-badges">
              <span>{plan.name}</span>
              <span>{subscriptionStatus}</span>
              <span>{used}/{limitLabel} QR codes</span>
              <span>{totalScans} scans</span>
            </div>
          )}
        />

        {subscriptionLocked ? (
          <section className="locked-upgrade-card">
            <div>
              <p className="eyebrow">Billing Attention</p>
              <h2>Paid QR features are locked.</h2>
              <p>{subscriptionLockMessage}</p>
            </div>
            <Link className="btn primary" href="https://clutchprintshop.com/pages/qr-pro">
              View Plans
            </Link>
          </section>
        ) : null}

        <section className="dashboard-grid">
          <div className="metric-card">
            <span className="metric-label">Active QR Codes</span>
            <strong className="metric-value">
              {used}
            </strong>
            <p>Dynamic codes in this account.</p>
          </div>

          <div className="metric-card">
            <span className="metric-label">Total Scans</span>
            <strong className="metric-value">
              {totalScans}
            </strong>
            <p>Across all your QR codes.</p>
          </div>

          <div className="metric-card">
            <span className="metric-label">Remaining Limit</span>
            <strong className="metric-value">
              {remainingLabel}
            </strong>
            <p>{plan.name} includes {limitLabel} active QR codes.</p>
          </div>

          <div className="metric-card">
            <span className="metric-label">Account Plan</span>
            <strong className="metric-value plan-name">{plan.shortName}</strong>
            <p>{advancedUnlocked ? "Advanced analytics unlocked." : isFreeQrPlan ? "1 free QR included with your print order." : "Upgrade to unlock Pro+ insights."}</p>
          </div>

          <div className="create-panel">
            <div className="section-heading compact">
              <p className="eyebrow">Create</p>
              <h2>Launch a New QR Campaign</h2>
            </div>
            {subscriptionLocked ? (
              <p className="muted">{subscriptionLockMessage}</p>
            ) : (
              <div className="create-form-wrap">
                <p className="muted">
                  Open the dedicated QR builder for full customization, print campaign tracking settings,
                  and live design preview.
                </p>
                <div className="actions">
                  <Link className="btn primary" href="/portal/create">Open Create QR Studio</Link>
                  <Link className="btn ghost" href="/portal/analytics">View Analytics Dashboard</Link>
                </div>
                <div className="usage-meter" aria-label={`${used} of ${limit} QR codes used`}>
                  <div className="usage-meter-top">
                    <span>Usage</span>
                    <strong>{used}/{limit}</strong>
                  </div>
                  <div className="usage-track">
                    <span style={{ width: `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <CustomerLogoUpload customerLogoUrl={customer.logo_url} />
        </section>

        {!advancedUnlocked ? (
          <section className="upgrade-strip">
            <div>
              <p className="eyebrow">{isFreeQrPlan ? "Free QR Included" : "Unlock More"}</p>
              <h2>{isFreeQrPlan ? "Your print order includes 1 dynamic QR Code." : "Need more QR codes and deeper reporting?"}</h2>
              <p>
                {isFreeQrPlan
                  ? "Upgrade to QR Pro for more campaigns, more QR codes, and expanded tracking."
                  : "QR Pro+ unlocks advanced analytics, custom reports, and up to 60 dynamic QR codes."}
              </p>
            </div>
            <Link className="btn primary" href="https://clutchprintshop.com/pages/qr-pro">
              {isFreeQrPlan ? "Upgrade to QR Pro" : "Upgrade to QR Pro+"}
            </Link>
          </section>
        ) : null}

        <section className="section-heading">
          <p className="eyebrow">Manage</p>
          <h2>Your QR Codes</h2>
          <p className="muted">
            Update destinations, styling, logos, and exports from one clean card.
          </p>
        </section>

        <section className="qr-card-grid">
          {codes.length > 0 ? (
            codes.map((code) => (
              <article className="qr-card" key={code.id}>
                <div className="qr-card-header">
                  <div>
                    <p className="eyebrow">Dynamic QR</p>
                    <h2>{code.name}</h2>
                    <p className="slug-text">{code.slug}</p>
                  </div>
                  <span className="status-pill">Active</span>
                </div>

                <QRCodeEditForm code={code} connectProfiles={(connectProfiles || []) as any} />
              </article>
            ))
          ) : (
            <div className="empty-state">
              <p className="eyebrow">No QR codes yet</p>
              <h2>Create your first trackable code.</h2>
              <p className="muted">
                Add a name and destination above to start managing your print campaign.
              </p>
            </div>
          )}
        </section>

        <section className="section-heading">
          <p className="eyebrow">Analytics</p>
          <h2>Performance Snapshot</h2>
          <p className="muted">
            Basic scan insights are available on QR Pro. Advanced reporting unlocks with QR Pro+.
          </p>
        </section>

        <section className="analytics-grid">
          <div className="analytics-card wide">
            <p className="eyebrow">Scan Trend</p>
            <h3>{totalScans ? `${totalScans} total scans` : "No scan data yet."}</h3>
            <p className="muted">
              {totalScans
                ? `Last scan: ${formatDate(lastScanAt)}`
                : "Once your QR code is scanned, analytics will appear here."}
            </p>
            <div className="trend-placeholder">
              {totalScans ? "Scan trend data is being collected." : "No scan data yet."}
            </div>
          </div>

          <div className="analytics-card">
            <p className="eyebrow">Device Type</p>
            <ul className="analytics-list">
              {(deviceCounts.length ? deviceCounts : [{ label: "No scan data yet", value: 0 }]).map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
          </div>

          <div className="analytics-card">
            <p className="eyebrow">Browser</p>
            <ul className="analytics-list">
              {(browserCounts.length ? browserCounts : [{ label: "No scan data yet", value: 0 }]).map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
          </div>

          <div className="analytics-card">
            <p className="eyebrow">Operating System</p>
            <ul className="analytics-list">
              {(osCounts.length ? osCounts : [{ label: "No scan data yet", value: 0 }]).map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
          </div>

          <div className="analytics-card">
            <p className="eyebrow">Referrer / Source</p>
            <ul className="analytics-list">
              {(referrerCounts.length ? referrerCounts : [{ label: "No scan data yet", value: 0 }]).map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.value}</strong></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section-heading">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="eyebrow">QR Pro+</p>
              <h2>Advanced Analytics</h2>
            </div>
            <Link href="/portal/analytics" className="btn primary">
              View Dashboard
            </Link>
          </div>
        </section>

        {advancedUnlocked ? (
          <>
            <form className="advanced-filter-panel" action="/portal" method="get">
              <label className="label">
                QR Code
                <select className="input" name="qr" defaultValue={filters.qr || ""}>
                  <option value="">All QR codes</option>
                  {analytics.filterOptions.qrCodes.map((code) => (
                    <option value={code.id} key={code.id}>{code.name}</option>
                  ))}
                </select>
              </label>
              <label className="label">
                From
                <input className="input" type="date" name="from" defaultValue={filters.from || ""} />
              </label>
              <label className="label">
                To
                <input className="input" type="date" name="to" defaultValue={filters.to || ""} />
              </label>
              <label className="label">
                Device
                <select className="input" name="device" defaultValue={filters.device || ""}>
                  <option value="">All devices</option>
                  {analytics.filterOptions.devices.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <label className="label">
                Browser
                <select className="input" name="browser" defaultValue={filters.browser || ""}>
                  <option value="">All browsers</option>
                  {analytics.filterOptions.browsers.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <label className="label">
                Location
                <select className="input" name="location" defaultValue={filters.location || ""}>
                  <option value="">All locations</option>
                  {analytics.filterOptions.locations.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <label className="label">
                Referrer
                <select className="input" name="referrer" defaultValue={filters.referrer || ""}>
                  <option value="">All sources</option>
                  {analytics.filterOptions.referrers.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <button className="btn primary">Apply Filters</button>
            </form>

            <section className="advanced-actions">
              <Link className="btn secondary" href={exportHref}>Export CSV</Link>
              <Link className="btn ghost" href={reportHref}>Printable PDF Report</Link>
            </section>

            <section className="advanced-grid">
              <div className="advanced-card wide unlocked">
                <p className="eyebrow">Scans By Day</p>
                <h3>{analytics.totalScans} filtered scans</h3>
                <ChartBars items={analytics.scansByDay} emptyText="No scan data yet. Once your QR code is scanned, analytics will appear here." />
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Scans By Hour</p>
                <ChartBars items={analytics.scansByHour} emptyText="No hourly scan data yet." />
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Scans By Weekday</p>
                <ChartBars items={analytics.scansByWeekday} emptyText="No weekday scan data yet." />
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Device Breakdown</p>
                <ChartBars items={analytics.deviceBreakdown} emptyText="No device data yet." />
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Browser Breakdown</p>
                <ChartBars items={analytics.browserBreakdown} emptyText="No browser data yet." />
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Operating Systems</p>
                <ChartBars items={analytics.osBreakdown} emptyText="No operating system data yet." />
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Referrer / Source</p>
                <ChartBars items={analytics.referrerBreakdown} emptyText="No referrer data yet." />
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Scan Heat Map</p>
                <ChartBars items={analytics.heatMap} emptyText="Location data will appear here once scans include geographic information." />
              </div>
              <div className="advanced-card wide unlocked">
                <p className="eyebrow">Campaign Comparison</p>
                <div className="comparison-table">
                  {scannedCampaigns.length ? scannedCampaigns.map((item) => (
                    <div className="comparison-row" key={item.id}>
                      <span>{item.name}</span>
                      <strong>{item.totalScans} total</strong>
                      <em>{item.uniqueScans} unique</em>
                      <em>{item.recentScans} recent</em>
                    </div>
                  )) : <div className="analytics-empty">No scan data yet. Once your QR code is scanned, analytics will appear here.</div>}
                </div>
              </div>
              <div className="advanced-card wide unlocked">
                <p className="eyebrow">Best Performing QR Codes</p>
                <div className="comparison-table">
                  {scannedBestPerforming.length ? scannedBestPerforming.slice(0, 6).map((item, index) => (
                    <div className="comparison-row" key={item.id}>
                      <span>#{index + 1} {item.name}</span>
                      <strong>{item.totalScans} scans</strong>
                      <em>{item.recentScans} recent</em>
                      <em>{item.slug}</em>
                    </div>
                  )) : <div className="analytics-empty">No scan data yet. Once your QR code is scanned, analytics will appear here.</div>}
                </div>
              </div>
              <div className="advanced-card unlocked">
                <p className="eyebrow">Location Breakdown</p>
                <ChartBars items={analytics.locationBreakdown.filter((item) => item.label !== "Unknown location")} emptyText="Location data will appear here once scans include geographic information." />
              </div>
            </section>
          </>
        ) : (
          <section className="locked-upgrade-card">
            <div>
              <p className="eyebrow">Locked</p>
              <h2>Advanced analytics are available with QR Pro+.</h2>
              <p>
                Unlock heat maps, campaign comparisons, custom reports, and deeper scan insights.
              </p>
            </div>
            <Link className="btn primary" href="https://clutchprintshop.com/pages/qr-pro">
              Upgrade to QR Pro+
            </Link>
          </section>
        )}

        {!advancedUnlocked ? (
          <section className="section-heading">
            <p className="eyebrow">Plans</p>
            <h2>Upgrade Options</h2>
            <PlanCards currentPlanCode={plan.code} compact />
          </section>
        ) : null}
      </main>
    </DashboardShell>
  );
}
