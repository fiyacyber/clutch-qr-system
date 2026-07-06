import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Globe,
  Link2,
  QrCode,
  Sparkles,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RetryNotice from "@/components/dashboard/RetryNotice";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ConnectTabs from "@/components/connect/ConnectTabs";
import CopyPublicProfileButton from "@/components/connect/CopyPublicProfileButton";
import { requireCustomer } from "@/lib/auth";
import { isConnectProfilePublished } from "@/lib/connect";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { getCustomerPlan, hasEntitlement, isAdvancedBuilderUnlocked } from "@/lib/plans";
import { clutchConnectDisplayUrl, clutchConnectProfileUrl, qrUrl } from "@/lib/qr";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

interface ConnectPageProps {
  searchParams?: Promise<Record<string, string>>;
}

function formatDate(value?: string | null) {
  if (!value) return "No scans yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No scans yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
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
  const setupMessage = typeof params.setup === "string" ? params.setup : "";
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const plan = getCustomerPlan(customer);
  const hasDynamicQr = hasEntitlement(customer, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer, "heatmapAnalytics") || plan.code === "admin";
  const advancedBuilderUnlocked = isAdvancedBuilderUnlocked(customer);

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
        navVariant="connect-basic"
        showGuidedSetup
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
                  Begin Guided Setup
                </Link>
                {advancedBuilderUnlocked ? (
                  <Link className="btn secondary" href="/portal/connect/build">
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
              <Link className="btn secondary" href="/portal/connect/setup">Begin Guided Setup</Link>
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
      mapResult: (result: any) => result?.count || 0,
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
  const profilePublished = isConnectProfilePublished(profile);
  const setupComplete = profilePublished;
  const isBasicSetupIncomplete = plan.code === "connect_basic" && !profilePublished;
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

  const profileHealthChecks = [
    { label: "Add avatar", done: Boolean(profile.avatar_url) },
    { label: "Add cover photo", done: hasCoverPhoto },
    { label: "Add active link", done: activeLinks > 0 },
    { label: "Add verified badge", done: Boolean((profile as any).is_verified) },
  ];
  const profileHealthMissing = profileHealthChecks.filter((item) => !item.done);
  const editProfileHref = advancedBuilderUnlocked ? "/portal/connect/build" : "/portal/connect/setup";
  const hasLivePublicProfile = profilePublished && Boolean(profile.slug);
  const publicProfileFullUrl = hasLivePublicProfile ? clutchConnectProfileUrl(profile.slug) : null;
  const publicProfileHref = publicProfileFullUrl || "/portal/connect/setup";
  const publicProfileActionLabel = hasLivePublicProfile ? "View Profile" : "Continue Guided Setup";
  const publicProfileUrl = profilePublished && profile.slug
    ? clutchConnectDisplayUrl(profile.slug)
    : "Publish your profile to generate a live public page";
  const smartCardScanUrl = linkedQr?.slug ? qrUrl(String(linkedQr.slug)) : "";
  const smartCardScanDisplay = linkedQr?.slug ? smartCardScanUrl.replace(/^https?:\/\//, "") : "Not available";
  const smartCardDestinationUrl = hasLivePublicProfile && profile.slug
    ? clutchConnectProfileUrl(String(profile.slug))
    : String(linkedQr?.destination_url || "");
  const smartCardDestinationDisplay = smartCardDestinationUrl
    ? smartCardDestinationUrl.replace(/^https?:\/\//, "")
    : "Not connected yet";
  const lastLeadCapture = connectRows.find((event: any) => event.event_type === "lead_submit")?.created_at || null;

  return (
    <DashboardShell
      isAdmin={Boolean(customer.is_admin)}
      navVariant={plan.code === "connect_basic" ? "connect-basic" : "default"}
      showGuidedSetup={!profilePublished}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      <main className="container connect-center-shell">
        <DashboardHeader
          title="Clutch Connect"
          subtitle="Manage your public profile, leads, wallet card, and smart card link."
          actions={
            <div className="connect-center-header-actions">
              <Link className={hasLivePublicProfile ? "btn primary" : "btn secondary"} href={publicProfileHref} target={hasLivePublicProfile ? "_blank" : undefined}>
                <Globe size={15} />
                {publicProfileActionLabel}
              </Link>
              <Link className="btn secondary" href={setupComplete ? editProfileHref : "/portal/connect/setup"}>
                Edit Profile
              </Link>
            </div>
          }
        />

        <ConnectTabs
          active="profile"
          showBuilder={advancedBuilderUnlocked}
          showAnalytics={hasHeatmap}
          analyticsLocked={!hasHeatmap}
        />

        <section className="connect-center-plan-mini">
          <strong>Plan: {plan.code === "connect_basic" ? "Basic" : plan.shortName}</strong>
          <span>{plan.price}</span>
          <span>{isBasicSetupIncomplete ? "setup in progress" : String(customer.subscription_status || customer.plan_status || "active")}</span>
        </section>

        {panelIssues.length ? (
          <RetryNotice
            title="Some Clutch Connect data is temporarily unavailable"
            description={panelIssues[0]}
            details={panelIssues.slice(1)}
          />
        ) : null}

        {setupMessage === "complete" ? <div className="success-message">Profile published. Your public page is now live.</div> : null}

        <section className="connect-center-public-strip" aria-label="Public page status">
          <div className="connect-center-public-strip-main">
            <span className={profilePublished ? "is-live" : "is-draft"}>
              {profilePublished ? "LIVE" : "DRAFT"}
            </span>
            <div className="connect-center-public-strip-url-row">
              <strong>{publicProfileUrl}</strong>
              {hasLivePublicProfile && publicProfileFullUrl ? <CopyPublicProfileButton url={publicProfileFullUrl} /> : null}
            </div>
          </div>
          <div className="connect-center-public-strip-actions">
            {!hasLivePublicProfile ? <Link className="btn secondary" href="/portal/connect/setup">Continue Guided Setup</Link> : null}
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
            <p className="connect-center-kicker">Profile Health</p>
            <h2>{profileHealthMissing.length ? `${profileHealthMissing.length} recommended improvements` : "Profile looks ready."}</h2>
            <ul className="connect-center-checklist">
              {profileHealthMissing.length ? (
                profileHealthMissing.map((item) => (
                  <li key={item.label}>
                    <Circle size={14} />
                    <span>{item.label}</span>
                  </li>
                ))
              ) : (
                <li>
                  <CheckCircle2 size={14} />
                  <span>Optional improvements are complete.</span>
                </li>
              )}
            </ul>
          </article>
        </section>

        <section className="connect-center-card connect-center-smart-status">
          <p className="connect-center-kicker">Smart Card Connected</p>
          <h2>Smart card connection status</h2>
          <ul className="connect-center-metadata-list">
            <li><span>Status</span><strong>{linkedQr?.slug && hasLivePublicProfile ? "Connected" : "Not connected"}</strong></li>
            <li><span>Scan link</span><strong>{smartCardScanDisplay}</strong></li>
            <li><span>Destination</span><strong>{smartCardDestinationDisplay}</strong></li>
            <li><span>Last scan</span><strong>{formatDate(lastScan)}</strong></li>
            <li><span>Total taps</span><strong>{totalTaps}</strong></li>
          </ul>
        </section>

        <section className="connect-center-grid connect-center-status-grid">
          <article className="connect-center-card">
            <p className="connect-center-kicker">Lead Inbox</p>
            <h2>{totalLeads} captured leads</h2>
            <ul className="connect-center-metadata-list">
              <li><span>Total leads</span><strong>{totalLeads}</strong></li>
              <li><span>Last lead</span><strong>{lastLeadCapture ? formatDate(lastLeadCapture) : "No leads yet"}</strong></li>
            </ul>
            <div className="connect-center-inline-actions connect-center-inline-actions-compact">
              <Link className="btn ghost" href="/portal/connect/leads">Open Lead Inbox</Link>
            </div>
          </article>

          <article className="connect-center-card">
            <p className="connect-center-kicker">Wallet Passes</p>
            <h2>Apple + Google Wallet</h2>
            {!profilePublished ? (
              <p className="muted connect-center-note">Complete guided setup before creating wallet passes.</p>
            ) : null}
            <ul className="connect-center-metadata-list">
              <li><span>Apple Wallet saves</span><strong>{appleWalletSaves}</strong></li>
              <li><span>Google Wallet saves</span><strong>{googleWalletSaves}</strong></li>
              <li><span>Total Wallet Saves</span><strong>{totalWalletSaves}</strong></li>
            </ul>
            <div className="connect-center-inline-actions connect-center-inline-actions-compact">
              {profilePublished ? (
                <>
                  <Link className="btn ghost" href={`/api/wallet/apple/${profile.id}`} target="_blank">Apple Wallet</Link>
                  <Link className="btn ghost" href={`/api/wallet/google/${profile.id}`} target="_blank">Google Wallet</Link>
                </>
              ) : (
                <>
                  <button className="btn ghost" type="button" disabled>Apple Wallet</button>
                  <button className="btn ghost" type="button" disabled>Google Wallet</button>
                </>
              )}
            </div>
          </article>
        </section>

        <section className="connect-center-card">
          <p className="connect-center-kicker">Profile Actions</p>
          <h2>Quick Actions</h2>
          <div className="connect-center-quick-actions connect-center-quick-actions-compact">
            <Link className="connect-center-action" href={advancedBuilderUnlocked ? "/portal/connect/build" : "/portal/connect/setup"}>
              <Sparkles size={16} />
              <div>
                <strong>{advancedBuilderUnlocked ? "Profile Builder" : "Guided Setup"}</strong>
                <span>{advancedBuilderUnlocked ? "Customize layout and profile blocks." : "Edit profile details and publish settings."}</span>
              </div>
            </Link>
            <Link className="connect-center-action" href="/portal/connect/links">
              <Link2 size={16} />
              <div>
                <strong>Manage Links</strong>
                <span>Update links and contact actions on your profile.</span>
              </div>
            </Link>
            <Link className="connect-center-action" href="/portal/analytics?tab=clutch-connect">
              <QrCode size={16} />
              <div>
                <strong>Analytics</strong>
                <span>Review profile engagement and traffic trends.</span>
              </div>
            </Link>
          </div>
        </section>

        {plan.code === "connect_basic" ? (
          <section className="connect-center-card connect-center-upgrade-card">
            <p className="connect-center-kicker">Upgrade Available</p>
            <h2>Upgrade to Clutch Connect+</h2>
            <p className="muted">Unlock advanced profile customization, deeper engagement analytics, enhanced lead tools, premium sections, and brand removal.</p>
            <div className="connect-center-inline-actions connect-center-inline-actions-compact">
              <Link className="btn ghost" href="/portal/settings">Try Connect+</Link>
              <span className="connect-center-inline-note">14 Day Free Trial · Cancel Anytime</span>
            </div>
          </section>
        ) : null}
      </main>
    </DashboardShell>
  );
}
