import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ConnectLeadsCRM from "@/components/connect/ConnectLeadsCRM";
import ConnectTabs from "@/components/connect/ConnectTabs";
import { requireCustomer } from "@/lib/auth";
import { PLAN_DEFINITIONS, getCustomerPlan, hasEntitlement } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function sourceFromQrType(qrType?: string | null) {
  const value = (qrType || "").toLowerCase();
  if (value === "business_cards") return "Business Card";
  if (value === "flyers" || value === "flyer") return "Flyer";
  if (value === "yard_signs" || value === "yard_sign") return "Yard Sign";
  if (value === "door_hangers" || value === "door_hanger") return "Door Hanger";
  if (value === "postcards" || value === "postcard") return "Postcard";
  if (value === "brochures" || value === "brochure") return "Brochure";
  if (value && value !== "connect_profile" && value !== "url") return "QR Code";
  return "Clutch Connect Profile";
}

type LeadCrmStatus = "new" | "contacted" | "qualified" | "converted" | "closed" | "archived";

function normalizeLeadStatus(value?: string | null): LeadCrmStatus {
  const status = String(value || "new").toLowerCase();
  if (["new", "contacted", "qualified", "converted", "closed", "archived"].includes(status)) {
    return status as LeadCrmStatus;
  }
  return "new";
}

function getProfileViewLabel(event: any) {
  const viewKind = event.metadata?.view_kind;
  if (viewKind === "server_profile_view" || viewKind === "profile_view") {
    return "Server profile view";
  }
  return "Client page view";
}

function isCountedProfileView(event: any) {
  if (event.event_type !== "profile_view") return false;
  return getProfileViewLabel(event) !== "Server profile view";
}

export default async function PortalConnectLeadsPage() {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, business_name, contact_name, is_active")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!profile) redirect("/portal/connect");

  const plan = getCustomerPlan(customer);
  const canUseAdvancedInbox = hasEntitlement(customer, "advancedLeadInbox") || plan.code === "admin";
  const canUseSourceInsights = hasEntitlement(customer, "sourceTracking") || plan.code === "admin";
  const canUseCampaignPerformance = hasEntitlement(customer, "campaignAnalytics") || plan.code === "admin";
  const canUsePdfReports = hasEntitlement(customer, "pdfReports") || plan.code === "admin";
  const hasDynamicQr = hasEntitlement(customer, "dynamicQr") || plan.code === "admin";
  const hasHeatmap = hasEntitlement(customer, "heatmapAnalytics") || plan.code === "admin";

  const [{ data: leads }, { data: events }, { data: unifiedEvents }, { data: qrCodes }, { data: qrScans }] = await Promise.all([
    admin
      .from("profile_leads")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("profile_click_events")
      .select("id, event_type, created_at, metadata")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1200),
    admin
      .from("connect_events")
      .select("id, event_type, created_at, link_label")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1200),
    admin
      .from("qr_codes")
      .select("id, name, qr_type, profile_id, connect_profile_id")
      .eq("customer_id", customer.id),
    admin
      .from("qr_scans")
      .select("id, qr_code_id, ip_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(4000),
  ]);

  const rows = leads || [];
  const clickEvents = events || [];

  const unifiedRows = unifiedEvents || [];

  const qrById = new Map((qrCodes || []).map((qr: any) => [qr.id, qr]));
  const linkedQrIds = new Set(
    (qrCodes || [])
      .filter((qr: any) => qr.profile_id === profile.id || qr.connect_profile_id === profile.id)
      .map((qr: any) => qr.id)
  );

  const leadRows = rows.map((lead: any) => {
    const leadTs = new Date(lead.created_at).getTime();
    const scanMatch = (qrScans || []).find((scan: any) => {
      if (!scan.ip_hash || !lead.ip_hash || scan.ip_hash !== lead.ip_hash) return false;
      const scanTs = new Date(scan.created_at).getTime();
      if (!Number.isFinite(scanTs) || !Number.isFinite(leadTs)) return false;
      return scanTs <= leadTs && leadTs - scanTs <= 7 * 24 * 60 * 60 * 1000;
    });

    const qr = scanMatch ? qrById.get(scanMatch.qr_code_id) : null;
    const source = qr ? sourceFromQrType(qr.qr_type) : "Clutch Connect Profile";

    return {
      id: String(lead.id),
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      company: "",
      message: lead.message || "",
      source,
      createdAt: lead.created_at,
      ipHash: lead.ip_hash || "",
      status: normalizeLeadStatus(lead.status),
      archivedAt: lead.archived_at || null,
      contactedAt: lead.contacted_at || null,
      qualifiedAt: lead.qualified_at || null,
      convertedAt: lead.converted_at || null,
      closedAt: lead.closed_at || null,
      crmNotes: lead.crm_notes || "",
      updatedAt: lead.updated_at || lead.created_at,
    };
  });

  const scansForProfile = (qrScans || []).filter((scan: any) => linkedQrIds.has(scan.qr_code_id));
  const profileViews = clickEvents.filter(isCountedProfileView).length;
  const linkClicks = clickEvents.filter((event: any) => event.event_type === "link_click").length;
  const leadCaptures = leadRows.length;

  const timelineRows = [
    ...clickEvents
      .filter((event: any) => ["profile_view", "link_click", "lead_submit"].includes(event.event_type))
      .map((event: any) => ({
        id: `click-${event.id}`,
        eventType: event.event_type,
        label:
          event.event_type === "profile_view"
            ? getProfileViewLabel(event)
            : event.event_type === "link_click"
              ? "Link clicked"
              : "Lead submitted",
        createdAt: event.created_at,
        detail: event.metadata?.source ? `Source: ${event.metadata.source}` : "Clutch Connect profile",
      })),
    ...scansForProfile.slice(0, 300).map((scan: any) => ({
      id: `scan-${scan.id}`,
      eventType: "qr_scan",
      label: "QR scanned",
      createdAt: scan.created_at,
      detail: scan.qr_code_id ? `QR ID: ${scan.qr_code_id}` : "QR campaign",
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const clicksByCampaign = new Map<string, number>();
  for (const event of unifiedRows) {
    if (event.event_type !== "link_click") continue;
    const key = event.link_label || "Clutch Connect Profile";
    clicksByCampaign.set(key, (clicksByCampaign.get(key) || 0) + 1);
  }

  const scansByQr = new Map<string, { scans: number; visitors: Set<string> }>();
  for (const scan of scansForProfile) {
    const key = scan.qr_code_id;
    if (!key) continue;
    const current = scansByQr.get(key) || { scans: 0, visitors: new Set<string>() };
    current.scans += 1;
    if (scan.ip_hash) current.visitors.add(scan.ip_hash);
    scansByQr.set(key, current);
  }

  const conversionsByCampaign = new Map<string, number>();
  for (const lead of leadRows) {
    conversionsByCampaign.set(lead.source, (conversionsByCampaign.get(lead.source) || 0) + 1);
  }

  const campaignRows = Array.from(scansByQr.entries())
    .map(([qrId, stats]) => {
      const qr = qrById.get(qrId);
      const campaign = qr?.name || "Unnamed QR";
      return {
        campaign,
        scans: stats.scans,
        visitors: stats.visitors.size,
        clicks: clicksByCampaign.get(campaign) || 0,
        conversions: conversionsByCampaign.get(sourceFromQrType(qr?.qr_type)) || 0,
      };
    })
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 20);

  const qrPerformanceRows = Array.from(scansByQr.entries())
    .map(([qrId, stats]) => {
      const qr = qrById.get(qrId);
      const source = sourceFromQrType(qr?.qr_type);
      const conversions = conversionsByCampaign.get(source) || 0;
      return {
        qrName: qr?.name || "Unnamed QR",
        scans: stats.scans,
        visitors: stats.visitors.size,
        clicks: clicksByCampaign.get(qr?.name || "") || 0,
        conversionRate: stats.scans ? (conversions / stats.scans) * 100 : 0,
      };
    })
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 20);

  const funnel = {
    profileViews,
    qrScans: scansForProfile.length,
    linkClicks,
    leadCaptures,
    conversions: leadCaptures,
  };

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
          title="Clutch Connect Leads"
          subtitle="CRM-style inbox for digital business card leads, sources, and conversion analytics."
          actions={
            <div className="connect-center-header-actions">
              <Link className="btn primary" href={`/u/${profile.slug}`} target="_blank">Open Public Profile</Link>
              <Link className="btn secondary" href="/portal/create">Generate QR Code</Link>
            </div>
          }
        />

        <ConnectTabs active="leads" />

        <ConnectLeadsCRM
          profileSlug={profile.slug}
          leads={leadRows}
          timeline={timelineRows}
          campaignRows={campaignRows}
          qrRows={qrPerformanceRows}
          canUseAdvancedInbox={canUseAdvancedInbox}
          canUseSourceInsights={canUseSourceInsights}
          canUseCampaignPerformance={canUseCampaignPerformance}
          canUsePdfReports={canUsePdfReports}
          connectPlusCheckoutHref={PLAN_DEFINITIONS.connect_plus.checkoutUrl}
          qrProCheckoutHref={PLAN_DEFINITIONS.qr_pro.checkoutUrl}
          agencyInquiryHref={PLAN_DEFINITIONS.agency.checkoutUrl}
          funnel={funnel}
        />
      </main>
    </DashboardShell>
  );
}
