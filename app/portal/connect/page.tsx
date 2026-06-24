import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  CalendarRange,
  CheckCircle2,
  Circle,
  CreditCard,
  Eye,
  GalleryHorizontal,
  Globe,
  Link2,
  MapPin,
  MessageSquare,
  Palette,
  PencilLine,
  QrCode,
  Smartphone,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

interface ConnectPageProps {
  searchParams?: Promise<Record<string, string>>;
}

function formatDate(value?: string | null) {
  if (!value) return "No scans yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function PortalConnectPage({ searchParams }: ConnectPageProps) {
  const params = (await searchParams) || {};
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!profile) {
    return (
      <DashboardShell isAdmin={Boolean(customer.is_admin)}>
        <main className="container connect-center-shell">
          <DashboardHeader
            title="Clutch Connect"
            subtitle="Create your digital business card profile and start collecting leads."
            actions={<Link className="btn primary" href="/portal/connect/edit">Create Profile</Link>}
          />
        </main>
      </DashboardShell>
    );
  }

  const [{ count: leadCount }, { data: links }, { data: legacyEvents }, { data: unifiedEvents }, { data: qrRows }, walletRes] = await Promise.all([
    admin
      .from("profile_leads")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id),
    admin
      .from("profile_links")
      .select("id, is_active")
      .eq("profile_id", profile.id),
    admin
      .from("profile_click_events")
      .select("event_type, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1200),
    admin
      .from("connect_events")
      .select("event_type, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1200),
    admin
      .from("qr_codes")
      .select("id, name, slug, scan_count, profile_id, connect_profile_id")
      .eq("customer_id", customer.id),
    admin
      .from("wallet_events")
      .select("wallet_type, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1200),
  ]);

  const connectRows = (unifiedEvents || []).length
    ? (unifiedEvents || [])
    : (legacyEvents || []).map((row: any) => {
        if (row.event_type === "vcard_download") return { ...row, event_type: "save_contact" };
        if (row.event_type === "lead_submit") return { ...row, event_type: "lead_submit" };
        if (row.event_type === "profile_view") return { ...row, event_type: "profile_view" };
        return { ...row, event_type: "link_click" };
      });

  const profileViews = connectRows.filter((event: any) => event.event_type === "profile_view").length;
  const linkClicks = connectRows.filter((event: any) => event.event_type === "link_click").length;
  const contactSaves = connectRows.filter((event: any) => event.event_type === "save_contact").length;
  const totalLeads = leadCount || 0;

  const walletRows = walletRes?.data || [];
  const appleWalletSaves = walletRows.filter((row: any) => row.wallet_type === "apple").length;
  const googleWalletSaves = walletRows.filter((row: any) => row.wallet_type === "google").length;
  const totalWalletSaves = appleWalletSaves + googleWalletSaves;

  const profileLinks = links || [];
  const activeLinks = profileLinks.filter((link: any) => link.is_active !== false).length;

  const linkedQr = (qrRows || []).find(
    (row: any) => row.connect_profile_id === profile.id || row.profile_id === profile.id
  );

  const { data: lastScanRows } = linkedQr
    ? await admin
        .from("qr_scans")
        .select("created_at")
        .eq("qr_code_id", linkedQr.id)
        .order("created_at", { ascending: false })
        .limit(1)
    : { data: [] };

  const lastScan = lastScanRows?.[0]?.created_at || null;
  const totalTaps = linkedQr?.scan_count || 0;

  const completionChecks = [
    { label: "Business name", done: Boolean(profile.business_name) },
    { label: "Contact details", done: Boolean(profile.contact_name && profile.email && profile.phone) },
    { label: "Avatar uploaded", done: Boolean(profile.avatar_url) },
    { label: "Cover photo added", done: Boolean((profile as any).cover_url) },
    { label: "At least one active link", done: activeLinks > 0 },
    { label: "Public profile published", done: Boolean(profile.is_active && profile.slug) },
  ];

  const completedCount = completionChecks.filter((item) => item.done).length;
  const profileProgress = Math.round((completedCount / completionChecks.length) * 100);

  const missingItems = completionChecks.filter((item) => !item.done);

  const builderImprovements = [
    { icon: <MessageSquare size={16} />, label: "Drag-and-drop blocks", status: "Ready" },
    { icon: <Sparkles size={16} />, label: "Industry templates", status: "Ready" },
    { icon: <Link2 size={16} />, label: "Social media block library", status: "Ready" },
    { icon: <CalendarRange size={16} />, label: "Calendly block", status: "Ready" },
    { icon: <Star size={16} />, label: "Google Reviews block", status: "Planned" },
    { icon: <CreditCard size={16} />, label: "Payment blocks", status: "Planned" },
    { icon: <GalleryHorizontal size={16} />, label: "Gallery block", status: "Planned" },
    { icon: <Smartphone size={16} />, label: "Video block", status: "Planned" },
  ];

  const publicProfileImprovements = [
    { icon: <GalleryHorizontal size={16} />, label: "Cover photo", done: Boolean((profile as any).cover_url) },
    { icon: <BadgeCheck size={16} />, label: "Avatar upload", done: Boolean(profile.avatar_url) },
    { icon: <BadgeCheck size={16} />, label: "Verified badge", done: Boolean((profile as any).is_verified) },
    { icon: <Link2 size={16} />, label: "Save Contact button", done: true },
    { icon: <MapPin size={16} />, label: "Location field", done: Boolean((profile as any).location || profile.business_name) },
    { icon: <Eye size={16} />, label: "Contact save tracking", done: true },
  ];

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <main className="container connect-center-shell">
        <DashboardHeader
          title="Clutch Connect"
          subtitle="Unified digital business card management center. Build, publish, and track every profile touchpoint in one place."
          actions={
            <div className="connect-center-header-actions">
              <Link className="btn primary" href="/portal/connect/build">
                <Palette size={15} />
                Open Profile Builder
              </Link>
              <Link className="btn secondary" href="/portal/connect/leads">
                Lead Inbox
              </Link>
            </div>
          }
        />

        {params.saved === "1" ? <div className="success-message">Profile saved.</div> : null}

        <section className="connect-center-grid connect-center-overview-grid">
          <article className="connect-center-card">
            <p className="connect-center-kicker">Profile Overview</p>
            <h2>Performance Snapshot</h2>
            <div className="connect-center-stats-grid">
              <div>
                <span>Profile views</span>
                <strong>{profileViews}</strong>
              </div>
              <div>
                <span>Link clicks</span>
                <strong>{linkClicks}</strong>
              </div>
              <div>
                <span>Leads</span>
                <strong>{totalLeads}</strong>
              </div>
              <div>
                <span>Contact saves</span>
                <strong>{contactSaves}</strong>
              </div>
            </div>
          </article>

          <article className="connect-center-card">
            <p className="connect-center-kicker">Profile Completion</p>
            <h2>{profileProgress}% complete</h2>
            <div className="connect-center-progress-track">
              <span style={{ width: `${Math.min(100, Math.max(8, profileProgress))}%` }} />
            </div>
            <ul className="connect-center-checklist">
              {missingItems.length ? (
                missingItems.map((item) => (
                  <li key={item.label}>
                    <Circle size={14} />
                    <span>{item.label}</span>
                  </li>
                ))
              ) : (
                <li>
                  <CheckCircle2 size={14} />
                  <span>All key profile setup steps are complete.</span>
                </li>
              )}
            </ul>
          </article>
        </section>

        <section className="connect-center-grid connect-center-status-grid">
          <article className="connect-center-card">
            <p className="connect-center-kicker">Smart Card Status</p>
            <h2>NFC + QR Readiness</h2>
            <ul className="connect-center-metadata-list">
              <li><span>Connected NFC card</span><strong>{linkedQr ? "Connected" : "Not linked"}</strong></li>
              <li><span>Linked QR code</span><strong>{linkedQr?.name || "No linked QR"}</strong></li>
              <li><span>Last scan</span><strong>{formatDate(lastScan)}</strong></li>
              <li><span>Total taps</span><strong>{totalTaps}</strong></li>
            </ul>
          </article>

          <article className="connect-center-card">
            <p className="connect-center-kicker">Wallet Passes</p>
            <h2>Apple + Google Wallet</h2>
            <ul className="connect-center-metadata-list">
              <li><span>Apple Wallet saves</span><strong>{appleWalletSaves}</strong></li>
              <li><span>Google Wallet saves</span><strong>{googleWalletSaves}</strong></li>
              <li><span>Wallet save analytics</span><strong>{totalWalletSaves}</strong></li>
            </ul>
            <div className="connect-center-inline-actions">
              <Link className="btn ghost" href={`/api/wallet/apple/${profile.id}`} target="_blank">Apple Wallet</Link>
              <Link className="btn ghost" href={`/api/wallet/google/${profile.id}`} target="_blank">Google Wallet</Link>
            </div>
          </article>
        </section>

        <section className="connect-center-card">
          <p className="connect-center-kicker">Quick Actions</p>
          <h2>Manage Profile Fast</h2>
          <div className="connect-center-quick-actions">
            <Link className="connect-center-action" href="/portal/connect/edit">
              <PencilLine size={18} />
              <div>
                <strong>Edit Profile</strong>
                <span>Update profile details and branding.</span>
              </div>
            </Link>
            <Link className="connect-center-action" href={`/u/${profile.slug}`} target="_blank">
              <Globe size={18} />
              <div>
                <strong>Public Profile</strong>
                <span>Preview your live public page.</span>
              </div>
            </Link>
            <Link className="connect-center-action" href="/portal/analytics?tab=clutch-connect">
              <QrCode size={18} />
              <div>
                <strong>Analytics</strong>
                <span>Review engagement and scan behavior.</span>
              </div>
            </Link>
            <Link className="connect-center-action" href="/portal/connect/leads">
              <MessageSquare size={18} />
              <div>
                <strong>Lead Inbox</strong>
                <span>Respond to lead requests quickly.</span>
              </div>
            </Link>
          </div>
        </section>

        <section className="connect-center-grid connect-center-builder-grid">
          <article className="connect-center-card">
            <p className="connect-center-kicker">Unified Profile Builder</p>
            <h2>One experience for card + links + profile page</h2>
            <p className="muted">Card Builder, Manage Links, and Edit Public Page now work as one guided profile workflow.</p>
            <div className="connect-center-inline-actions">
              <Link className="btn primary" href="/portal/connect/build">Builder Workspace</Link>
              <Link className="btn secondary" href="/portal/connect/links">Link Library</Link>
              <Link className="btn ghost" href="/portal/connect/edit">Profile Editor</Link>
            </div>
          </article>

          <article className="connect-center-card">
            <p className="connect-center-kicker">Builder Improvements</p>
            <h2>Block Library + Templates</h2>
            <ul className="connect-center-feature-list">
              {builderImprovements.map((item) => (
                <li key={item.label}>
                  <span className="connect-center-feature-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <em className={item.status === "Ready" ? "ready" : "planned"}>{item.status}</em>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="connect-center-card">
          <p className="connect-center-kicker">Public Profile Improvements</p>
          <h2>Digital Business Card Enhancements</h2>
          <div className="connect-center-public-grid">
            {publicProfileImprovements.map((item) => (
              <article key={item.label}>
                <div className="connect-center-public-top">
                  <span className="connect-center-feature-icon">{item.icon}</span>
                  <strong>{item.label}</strong>
                </div>
                <p>{item.done ? "Configured" : "Needs setup"}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
