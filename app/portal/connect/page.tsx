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
  QrCode,
  Smartphone,
  Sparkles,
  Star,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RetryNotice from "@/components/dashboard/RetryNotice";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ConnectTabs from "@/components/connect/ConnectTabs";
import CopyPublicProfileButton from "@/components/connect/CopyPublicProfileButton";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import LockedFeatureCard from "@/components/plans/LockedFeatureCard";
import { requireCustomer } from "@/lib/auth";
import { isConnectSetupComplete } from "@/lib/connect";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { PLAN_DEFINITIONS, getAdvancedBuilderLockMessage, getCustomerPlan, hasEntitlement, isAdvancedBuilderUnlocked, isCustomerSubscriptionLocked } from "@/lib/plans";
import { clutchConnectDisplayUrl, clutchConnectProfileUrl } from "@/lib/qr";
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

function hasBuilderBannerImage(builderConfig: unknown) {
  if (!builderConfig || typeof builderConfig !== "object") return false;

  const theme = (builderConfig as { theme?: unknown }).theme;
  if (!theme || typeof theme !== "object") return false;

  const banner = (theme as { banner?: unknown }).banner;
  if (!banner || typeof banner !== "object") return false;

  const enabled = (banner as { enabled?: unknown }).enabled;
  const imageUrl = (banner as { imageUrl?: unknown }).imageUrl;
  return enabled !== false && typeof imageUrl === "string" && imageUrl.trim().length > 0;
}

export default async function PortalConnectPage({ searchParams }: ConnectPageProps) {
  const params = (await searchParams) || {};
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const plan = getCustomerPlan(customer);
  const hasDynamicQr = hasEntitlement(customer, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer, "heatmapAnalytics") || plan.code === "admin";
  const hasAdvancedLeads = hasEntitlement(customer, "advancedLeadInbox");
  const hasBrandRemoval = hasEntitlement(customer, "removeBranding");
  const advancedBuilderUnlocked = isAdvancedBuilderUnlocked(customer);
  const advancedBuilderLockMessage = getAdvancedBuilderLockMessage(customer);

  const admin = createSupabaseAdminClient();

  const panelIssues: string[] = [];

  const profileResult = await runGuardedDashboardTask({
    route: "/portal/connect",
    endpoint: "supabase:profiles.maybeSingle",
    customerId: customer.id,
    fallback: null as any,
    task: () =>
      admin
        .from("profiles")
        .select("*")
        .eq("customer_id", customer.id)
        .maybeSingle(),
  });
  if (profileResult.failed) panelIssues.push("Profile details are temporarily unavailable.");

  const profile = profileResult.data;

  if (!profile) {
    return (
      <DashboardShell
        isAdmin={Boolean(customer.is_admin)}
        navLocks={{
          qr: !hasDynamicQr,
          analytics: !hasHeatmap,
          heatmap: !hasHeatmap,
        }}
      >
        <main className="container connect-center-shell">
          <DashboardHeader
            title="Clutch Connect"
            subtitle="Build your Clutch Connect profile and share it from your smart card, QR campaigns, and customer touchpoints."
            actions={(
              <div className="connect-center-header-actions">
                <Link className="btn primary" href="/portal/connect/setup">
                  <Sparkles size={15} />
                  Guided Setup
                </Link>
                {advancedBuilderUnlocked ? (
                  <Link className="btn secondary" href="/portal/connect/build">
                    <Palette size={15} />
                    Advanced Builder
                  </Link>
                ) : null}
              </div>
            )}
          />
          <section className="connect-center-card">
            <p className="connect-center-kicker">Start Here</p>
            <h2>Create your Clutch Connect profile</h2>
            <p className="muted">Use guided setup for the essentials and publish a clean starter profile.</p>
            <div className="connect-center-inline-actions">
              <Link className="btn secondary" href="/portal/connect/setup">Guided Setup</Link>
              {advancedBuilderUnlocked ? <Link className="btn primary" href="/portal/connect/build">Advanced Builder</Link> : null}
            </div>
          </section>
        </main>
      </DashboardShell>
    );
  }

  const [leadCountResult, linksResult, legacyEventsResult, unifiedEventsResult, qrRowsResult, walletRowsResult] = await Promise.all([
    runGuardedDashboardTask({
      route: "/portal/connect",
      endpoint: "supabase:profile_leads.count",
      customerId: customer.id,
      fallback: 0,
      task: () =>
        admin
          .from("profile_leads")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profile.id),
      mapResult: (result: any) => ({ data: result?.count || 0, error: result?.error }),
    }),
    runGuardedDashboardTask({
      route: "/portal/connect",
      endpoint: "supabase:profile_links.select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string; is_active: boolean | null }>,
      task: () =>
        admin
          .from("profile_links")
          .select("id, is_active")
          .eq("profile_id", profile.id),
    }),
    runGuardedDashboardTask({
      route: "/portal/connect",
      endpoint: "supabase:profile_click_events.select",
      customerId: customer.id,
      fallback: [] as Array<{ event_type: string; created_at: string }>,
      task: () =>
        admin
          .from("profile_click_events")
          .select("event_type, created_at")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1200),
    }),
    runGuardedDashboardTask({
      route: "/portal/connect",
      endpoint: "supabase:connect_events.select",
      customerId: customer.id,
      fallback: [] as Array<{ event_type: string; created_at: string }>,
      task: () =>
        admin
          .from("connect_events")
          .select("event_type, created_at")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1200),
    }),
    runGuardedDashboardTask({
      route: "/portal/connect",
      endpoint: "supabase:qr_codes.select",
      customerId: customer.id,
      fallback: [] as Array<{
        id: string;
        name: string;
        slug: string | null;
        scan_count: number | null;
        profile_id: string | null;
        connect_profile_id: string | null;
        destination_url: string | null;
        qr_type: string | null;
        is_system: boolean | null;
      }>,
      task: () =>
        admin
          .from("qr_codes")
          .select("id, name, slug, scan_count, profile_id, connect_profile_id, destination_url, qr_type, is_system")
          .eq("customer_id", customer.id),
    }),
    runGuardedDashboardTask({
      route: "/portal/connect",
      endpoint: "supabase:wallet_events.select",
      customerId: customer.id,
      fallback: [] as Array<{ wallet_type: string; created_at: string }>,
      task: () =>
        admin
          .from("wallet_events")
          .select("wallet_type, created_at")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1200),
    }),
  ]);

  if (leadCountResult.failed) panelIssues.push("Lead counts are temporarily unavailable.");
  if (linksResult.failed) panelIssues.push("Profile links are temporarily unavailable.");
  if (legacyEventsResult.failed || unifiedEventsResult.failed) panelIssues.push("Recent engagement events are temporarily unavailable.");
  if (walletRowsResult.failed) panelIssues.push("Wallet activity is temporarily unavailable.");

  const leadCount = leadCountResult.data;
  const links = linksResult.data;
  const legacyEvents = legacyEventsResult.data;
  const unifiedEvents = unifiedEventsResult.data;
  const qrRows = qrRowsResult.data;
  const walletRows = walletRowsResult.data;

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

  const appleWalletSaves = walletRows.filter((row: any) => row.wallet_type === "apple").length;
  const googleWalletSaves = walletRows.filter((row: any) => row.wallet_type === "google").length;
  const totalWalletSaves = appleWalletSaves + googleWalletSaves;

  const profileLinks = links || [];
  const activeLinks = profileLinks.filter((link: any) => link.is_active !== false).length;
  const setupComplete = isConnectSetupComplete(customer, profile, { links: profileLinks });
  const hasCoverPhoto = Boolean((profile as any).cover_url) || hasBuilderBannerImage((profile as any).builder_config);

  const linkedQr = (qrRows || []).find(
    (row: any) => row.is_system === true && row.qr_type === "smart_card"
  ) || (qrRows || []).find(
    (row: any) => row.qr_type === "smart_card"
  ) || (qrRows || []).find(
    (row: any) => row.connect_profile_id === profile.id || row.profile_id === profile.id
  );

  const lastScanRowsResult = linkedQr
    ? await runGuardedDashboardTask({
        route: "/portal/connect",
        endpoint: "supabase:qr_scans.last_scan",
        customerId: customer.id,
        fallback: [] as Array<{ created_at: string | null }>,
        task: () =>
          admin
            .from("qr_scans")
            .select("created_at")
            .eq("qr_code_id", linkedQr.id)
            .order("created_at", { ascending: false })
            .limit(1),
      })
    : { data: [] as Array<{ created_at: string | null }>, failed: false };
  if (lastScanRowsResult.failed) panelIssues.push("Latest scan timestamp is temporarily unavailable.");

  const lastScan = lastScanRowsResult.data?.[0]?.created_at || null;
  const totalTaps = linkedQr?.scan_count || 0;
  const smartCardDestination = linkedQr?.destination_url || (profile.slug ? clutchConnectDisplayUrl(profile.slug) : "Not connected yet");

  const completionChecks = [
    { label: "Business name", done: Boolean(profile.business_name) },
    { label: "Contact details", done: Boolean(profile.contact_name && profile.email && profile.phone) },
    { label: "Avatar uploaded", done: Boolean(profile.avatar_url) },
    { label: "Cover photo added", done: hasCoverPhoto },
    { label: "At least one active link", done: activeLinks > 0 },
    { label: "Public page published", done: Boolean(profile.is_active && profile.slug) },
  ];

  const completedCount = completionChecks.filter((item) => item.done).length;
  const profileProgress = Math.round((completedCount / completionChecks.length) * 100);

  const missingItems = completionChecks.filter((item) => !item.done);
  const publicProfileHref = profile.slug ? `/u/${profile.slug}` : "/portal/connect/build";
  const publicProfileUrl = profile.slug
    ? clutchConnectDisplayUrl(profile.slug)
    : "Open Profile Builder to publish your page";
  const publicProfileFullUrl = profile.slug ? clutchConnectProfileUrl(profile.slug) : null;

  const builderImprovements = [
    { icon: <MessageSquare size={16} />, label: "Drag-and-drop blocks", status: "Ready" },
    { icon: <Sparkles size={16} />, label: "Industry templates", status: "Ready" },
    { icon: <Link2 size={16} />, label: "Social media block library", status: "Ready" },
    { icon: <CalendarRange size={16} />, label: "Booking / request quote block", status: "Ready" },
    { icon: <Star size={16} />, label: "Google Reviews block", status: "Planned" },
    { icon: <CreditCard size={16} />, label: "Payment blocks", status: "Planned" },
    { icon: <GalleryHorizontal size={16} />, label: "Gallery block", status: "Planned" },
    { icon: <Smartphone size={16} />, label: "Video block", status: "Planned" },
  ];

  const publicProfileImprovements = [
    { icon: <GalleryHorizontal size={16} />, label: "Cover photo", done: hasCoverPhoto },
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
          subtitle={advancedBuilderUnlocked
            ? "Open your Profile Builder workspace or view the profile your customers see."
            : "Manage your starter profile basics and view the page your customers see."}
          actions={
            <div className="connect-center-header-actions">
              <Link className="btn secondary" href="/portal/connect/setup">
                <Sparkles size={15} />
                {setupComplete ? "Guided Setup" : "Continue Setup"}
              </Link>
              {advancedBuilderUnlocked ? (
                <Link className="btn primary" href="/portal/connect/build">
                  <Palette size={15} />
                  Advanced Builder
                </Link>
              ) : null}
              <div className="connect-profile-view-row">
                <Link className="btn secondary" href={publicProfileHref} target={profile.slug ? "_blank" : undefined}>
                  <Globe size={15} />
                  View Profile
                </Link>
                {publicProfileFullUrl ? <CopyPublicProfileButton url={publicProfileFullUrl} /> : null}
              </div>
            </div>
          }
        />

        <ConnectTabs active="profile" showBuilder={advancedBuilderUnlocked} />

        <CurrentPlanBadge
          planCode={plan.code}
          planName={plan.name}
          priceLabel={plan.price}
          description={plan.description}
          usageLabel={plan.code === "connect_basic" ? "Basic profile and Lead Inbox active" : "Advanced profile features active"}
          subscriptionStatus={String(customer.subscription_status || customer.plan_status || "active")}
          locked={isCustomerSubscriptionLocked(customer)}
          trialStatus={String(customer.trial_status || "none")}
        />

        {plan.code === "connect_basic" ? (
          <LockedFeatureCard
            title="Unlock Clutch Connect+"
            description="Advanced profile customization, custom forms, lead management, and profile analytics."
            requiredPlan="Clutch Connect+"
            requiredPlanPrice="$9.99/mo"
            ctaLabel="Upgrade for $9.99/mo"
            ctaHref={PLAN_DEFINITIONS.connect_plus.checkoutUrl}
            featureList={[
              "Advanced profile builder",
              "Premium banner themes",
              "Custom form controls",
              "Advanced Lead Inbox tools",
              "Remove Clutch branding",
            ]}
            variant="connect_plus"
          />
        ) : null}

        {panelIssues.length ? (
          <RetryNotice
            title="Some Clutch Connect data is temporarily unavailable"
            description={panelIssues[0]}
            details={panelIssues.slice(1)}
          />
        ) : null}

        {!setupComplete ? (
          <section className="connect-center-card">
            <p className="connect-center-kicker">Setup In Progress</p>
            <h2>Finish your guided setup to unlock full dashboard flow.</h2>
            <p className="muted">Complete your contact details and at least one visible call-to-action so your public page is ready for real customer traffic.</p>
            <div className="connect-center-inline-actions">
              <Link className="btn primary" href="/portal/connect/setup">Continue Guided Setup</Link>
            </div>
          </section>
        ) : null}

        <section className="connect-center-public-strip" aria-label="Public page status">
          <div>
            <span className={profile.is_active ? "is-live" : "is-draft"}>
              {profile.is_active ? "Live" : "Draft"}
            </span>
            <strong>{publicProfileUrl}</strong>
          </div>
          <div className="connect-center-public-strip-actions">
            <Link className="btn ghost" href="/portal/connect/leads">Leads CRM</Link>
            <div className="connect-profile-view-row">
              <Link className="btn secondary" href={publicProfileHref} target={profile.slug ? "_blank" : undefined}>
                View Profile
              </Link>
              {publicProfileFullUrl ? <CopyPublicProfileButton url={publicProfileFullUrl} /> : null}
            </div>
          </div>
        </section>

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
            <h2>Smart Card Link</h2>
            <ul className="connect-center-metadata-list">
              <li><span>Connected</span><strong>{linkedQr ? "Connected" : "Not connected"}</strong></li>
              <li><span>Linked Smart Card Link</span><strong>{linkedQr?.name || "No Smart Card Link"}</strong></li>
              <li><span>Last scan</span><strong>{formatDate(lastScan)}</strong></li>
              <li><span>Total taps</span><strong>{totalTaps}</strong></li>
              <li><span>Destination</span><strong>{smartCardDestination}</strong></li>
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

          <article className="connect-center-card">
            <p className="connect-center-kicker">Card Hardware</p>
            <h2>NTAG213 Metal Card</h2>
            <ul className="connect-center-metadata-list">
              <li><span>NFC chip</span><strong>NTAG213 • 13.56 MHz</strong></li>
              <li><span>Memory</span><strong>144 bytes • 7-byte UID</strong></li>
              <li><span>Card size</span><strong>CR80 • 85.5 x 54 x 1.2 mm</strong></li>
              <li><span>Finish options</span><strong>Matte black, brushed silver, brushed gold</strong></li>
              <li><span>Build</span><strong>Rigid, water resistant, laser engravable</strong></li>
            </ul>
          </article>
        </section>

        <section className="connect-center-card">
          <p className="connect-center-kicker">Quick Actions</p>
          <h2>Open Clutch Connect</h2>
          <div className="connect-center-quick-actions">
            <Link className="connect-center-action" href={advancedBuilderUnlocked ? "/portal/connect/build" : "/portal/connect/setup"}>
              <Palette size={18} />
              <div>
                <strong>{advancedBuilderUnlocked ? "Profile Builder" : "Guided Setup"}</strong>
                <span>
                  {advancedBuilderUnlocked
                    ? "Edit your new public page, blocks, links, and design."
                    : "Starter plans manage profile basics in Guided Setup."}
                </span>
              </div>
            </Link>
            <Link className="connect-center-action" href={`/u/${profile.slug}`} target="_blank">
              <Globe size={18} />
              <div>
                <strong>View Profile</strong>
                <span>Open the profile customers see from your card and QR links.</span>
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

        {!hasAdvancedLeads || !hasBrandRemoval ? (
          <section className="connect-center-card">
            <p className="connect-center-kicker">Plan Awareness</p>
            <h2>Starter profile access remains fully usable.</h2>
            <p className="muted">
              Guided setup, contact actions, social links, and a basic lead capture flow stay active on Clutch Connect Basic.
              Upgrade to Clutch Connect+ to unlock advanced Lead Inbox controls, premium theming, and brand removal.
            </p>
          </section>
        ) : null}

        {advancedBuilderUnlocked ? (
          <section className="connect-center-grid connect-center-builder-grid">
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
        ) : null}

        <section className="connect-center-card">
          <p className="connect-center-kicker">Public Page Improvements</p>
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
