import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchUnifiedAnalyticsData, isCountedProfileView } from "@/lib/clutch-analytics";
import { loadAccountAccess } from "@/lib/account-access-server";
import { hasActiveClutchCodesSubscription, loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { analyticsScopeForCode, buildBasicCodeAnalytics } from "@/lib/order-linked-analytics";

const defaultDependencies = { requireCustomer, createSupabaseAdminClient, loadAccountAccess, loadOrderLinkedQrAccess, fetchUnifiedAnalyticsData };

export function createAnalyticsSummaryHandler(dependencies: Partial<typeof defaultDependencies> = {}) {
  const deps = { ...defaultDependencies, ...dependencies };
  return async function handler() {
  try {
    const { user, customer } = await deps.requireCustomer();

    if (!user || !customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = deps.createSupabaseAdminClient();
    const access = await deps.loadAccountAccess(admin, customer);
    if (!access.canUseCampaignAnalytics && !access.canUseProfileAnalytics) return NextResponse.json({ error: "Analytics access is locked." }, { status: 403 });
    const paid = hasActiveClutchCodesSubscription(customer);
    if (!customer.is_admin && !paid) {
      const { data: candidateCodes, error: codeError } = await admin.from("qr_codes")
        .select("id, name, slug").eq("customer_id", customer.id);
      if (codeError) throw codeError;
      const permitted = (await Promise.all((candidateCodes || []).map(async (code) => ({
        code,
        scope: analyticsScopeForCode({ isAdmin: false, hasPaidAnalytics: false, codeAccess: await deps.loadOrderLinkedQrAccess(admin, customer, code.id) }),
      })))).filter((entry) => entry.scope === "basic_code").map((entry) => entry.code);
      if (!permitted.length) return NextResponse.json({ error: "Your Included Access Has Ended" }, { status: 403 });
      const ids = permitted.map((code) => code.id);
      const { data: scans, error: scanError } = ids.length
        ? await admin.from("qr_scans").select("qr_code_id, created_at").in("qr_code_id", ids).order("created_at", { ascending: true })
        : { data: [], error: null };
      if (scanError) throw scanError;
      const rows = permitted.map((code) => buildBasicCodeAnalytics(code, scans || []));
      return NextResponse.json({
        scope: "basic_code",
        codes: rows.map((row) => row.code),
        summary: { totalScans: rows.reduce((sum, row) => sum + row.totalScans, 0), activeQrCodes: rows.length },
        rows,
      });
    }
    const data = await deps.fetchUnifiedAnalyticsData(admin, customer as any);
    const codeAccess = await Promise.all(data.qrCodes.map(async (code) => ({
      code,
      access: await deps.loadOrderLinkedQrAccess(admin, customer, code.id),
    })));
    const visibleCodes = codeAccess.filter(({ code, access: codeGrant }) =>
      codeGrant.canViewBasicAnalytics || (code.qr_type === "smart_card" && access.canUseProfileAnalytics)
    ).map(({ code }) => code);
    const visibleCodeIds = new Set(visibleCodes.map((code) => code.id));
    const visibleScans = data.qrScans.filter((scan) => visibleCodeIds.has(scan.qr_code_id));

    const totalScans = visibleScans.length;
    const connectViews = data.connectEvents.filter(isCountedProfileView).length;
    const linkClicks = data.connectEvents.filter((row) => row.event_type === "link_click").length;
    const leadsCaptured = data.connectEvents.filter((row) => row.event_type === "lead_submit").length;
    const activeQrCodes = visibleCodes.filter((row) => row.is_active !== false).length;
    const uniqueVisitors = new Set(
      [...visibleScans.map((row) => row.ip_hash), ...data.connectEvents.map((row) => row.ip_hash || row.visitor_id)].filter(Boolean)
    ).size;

    return NextResponse.json({
      scope: customer.is_admin ? "admin" : "full_account",
      codes: visibleCodes,
      scans: visibleScans,
      profiles: data.profiles,
      connectEvents: data.connectEvents,
      summary: {
        totalScans,
        connectViews,
        linkClicks,
        uniqueVisitors,
        leadsCaptured,
        activeQrCodes,
      },
      customer: { id: customer.id, email: customer.email },
    });
  } catch (error) {
    console.error("Analytics summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
}

export const GET = createAnalyticsSummaryHandler();
