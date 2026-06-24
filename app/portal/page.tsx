import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Link2,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import CustomerLogoUpload from "@/components/CustomerLogoUpload";
import AnalyticsCard from "@/components/dashboard/AnalyticsCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import EmptyState from "@/components/dashboard/EmptyState";
import StatCard from "@/components/dashboard/StatCard";
import { requireCustomer } from "@/lib/auth";
import {
  getCustomerPlan,
  getCustomerSubscriptionStatus,
  getEffectiveQrLimit,
  getSubscriptionLockMessage,
  isCustomerSubscriptionLocked,
} from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

interface PortalPageProps {
  searchParams?: Record<string, string>;
}

function formatDate(value?: string | null) {
  if (!value) return "Just now";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

  const [{ data: qrCodes }, { data: connectProfiles }] = await Promise.all([
    admin
      .from("qr_codes")
      .select("id, name, slug, scan_count, created_at, is_active")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, slug, business_name, contact_name")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ]);

  const codes = qrCodes || [];
  const qrIds = codes.map((code) => code.id);
  const { data: scanRows } = qrIds.length
    ? await admin
        .from("qr_scans")
        .select("id, qr_code_id, created_at, city, country")
        .in("qr_code_id", qrIds)
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [] };

  const scans = scanRows || [];
  const used = codes.length;
  const activeQrCodes = codes.filter((code) => code.is_active !== false).length;
  const limit = getEffectiveQrLimit(customer);
  const plan = getCustomerPlan(customer);
  const subscriptionStatus = getCustomerSubscriptionStatus(customer);
  const subscriptionLocked = isCustomerSubscriptionLocked(customer);
  const subscriptionLockMessage = getSubscriptionLockMessage(customer);
  const totalScans = codes.reduce((sum, code) => sum + (code.scan_count || 0), 0);
  const remaining = Math.max(limit - used, 0);
  const remainingLabel = plan.code === "admin" ? "Unlimited" : String(remaining);

  const qrNameMap = new Map(codes.map((code) => [code.id, code.name]));
  const recentActivity = scans.map((scan) => {
    const location = [scan.city, scan.country].filter(Boolean).join(", ");
    return {
      id: scan.id,
      title: qrNameMap.get(scan.qr_code_id) || "QR Campaign",
      date: formatDate(scan.created_at),
      location: location || "Location unavailable",
    };
  });

  const profiles = connectProfiles || [];
  const checklistItems = [
    { label: "Create your first QR code", done: used > 0 },
    { label: "Add your company logo", done: Boolean(customer.logo_url) },
    { label: "Set up your Clutch Connect profile", done: profiles.length > 0 },
    { label: "View analytics after your first scan", done: totalScans > 0 },
  ];

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <main className="container portal-overview-shell">
        {errorMessage ? (
          <div className="alert">
            <strong>Error:</strong> {errorMessage}
          </div>
        ) : null}

        <DashboardHeader
          title="Clutch QR Portal"
          subtitle="Create, manage, and track every QR campaign from one dashboard."
          actions={(
            <div className="portal-overview-header-actions">
              <Link className="btn primary" href="/portal/create">Create QR</Link>
              <Link className="btn secondary" href="/portal/analytics">View Analytics</Link>
              <Link className="btn ghost" href="/portal/connect/edit">Edit Clutch Connect</Link>
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

        <section className="ds-stat-grid">
          <StatCard
            label="Active QR Codes"
            value={activeQrCodes}
            description="Live campaigns currently active in your account."
          />
          <StatCard
            label="Total Scans"
            value={totalScans.toLocaleString()}
            description="Lifetime scans across all QR campaigns."
          />
          <StatCard
            label="Remaining QR Limit"
            value={<span className="portal-overview-limit-value">{remainingLabel}</span>}
            description={
              plan.code === "admin"
                ? "Admin includes unlimited active QR codes."
                : `${remaining} of ${limit} QR codes remaining.`
            }
          />
          <StatCard
            label="Account Plan"
            value={plan.shortName}
            description={`${plan.name} • ${subscriptionStatus}`}
          />
        </section>

        <AnalyticsCard className="portal-overview-actions-card">
          <div className="portal-overview-section-head">
            <h2>Launch Your Next Campaign</h2>
            <p>Everything you need to create, publish, and measure campaigns in one place.</p>
          </div>
          <div className="portal-overview-actions-grid">
            <article className="portal-overview-action-item">
              <div className="portal-overview-action-icon"><QrCode size={17} /></div>
              <h3>Create QR Code</h3>
              <p>Start a new dynamic QR campaign with full tracking.</p>
              <Link className="btn primary" href="/portal/create">Open Studio</Link>
            </article>

            <article className="portal-overview-action-item">
              <div className="portal-overview-action-icon"><Link2 size={17} /></div>
              <h3>Build Clutch Connect Profile</h3>
              <p>Update your smart profile, links, and public details.</p>
              <Link className="btn secondary" href="/portal/connect/build">Open Builder</Link>
            </article>

            <article className="portal-overview-action-item">
              <div className="portal-overview-action-icon"><BarChart3 size={17} /></div>
              <h3>View Scan Analytics</h3>
              <p>Track scan performance, geography, and engagement trends.</p>
              <Link className="btn secondary" href="/portal/analytics">Open Dashboard</Link>
            </article>

            <article className="portal-overview-action-item">
              <div className="portal-overview-action-icon"><Users size={17} /></div>
              <h3>Capture Leads</h3>
              <p>Review profile submissions and follow up with prospects.</p>
              <Link className="btn secondary" href="/portal/connect/leads">View Leads</Link>
            </article>
          </div>
        </AnalyticsCard>

        <section className="portal-overview-lower-grid">
          <AnalyticsCard title="Recent Activity">
            {recentActivity.length ? (
              <ul className="portal-overview-activity-list">
                {recentActivity.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.location}</p>
                    </div>
                    <span>{item.date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="No activity yet. Create and scan your first QR code to start tracking." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Setup Checklist">
            <ul className="portal-overview-checklist">
              {checklistItems.map((item) => (
                <li key={item.label} className={item.done ? "done" : "pending"}>
                  {item.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>

            <div className="portal-overview-brand-card">
              <div className="portal-overview-brand-title">
                <Sparkles size={15} />
                <h3>Brand Assets</h3>
              </div>
              <p>Upload your logo once and apply it across QR designs.</p>
              <CustomerLogoUpload customerLogoUrl={customer.logo_url} />
            </div>
          </AnalyticsCard>
        </section>
      </main>
    </DashboardShell>
  );
}
