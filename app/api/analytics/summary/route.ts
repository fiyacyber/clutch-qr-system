import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchUnifiedAnalyticsData, isCountedProfileView } from "@/lib/clutch-analytics";
import { loadAccountAccess } from "@/lib/account-access-server";
import { loadOrderLinkedQrAccess } from "@/lib/order-linked-access";

export async function GET(req: NextRequest) {
  try {
    const { user, customer } = await requireCustomer();

    if (!user || !customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const access = await loadAccountAccess(admin, customer);
    if (!access.canUseCampaignAnalytics && !access.canUseProfileAnalytics) return NextResponse.json({ error: "Analytics access is locked." }, { status: 403 });
    const data = await fetchUnifiedAnalyticsData(admin, customer as any);
    const codeAccess = await Promise.all(data.qrCodes.map(async (code) => ({
      code,
      access: await loadOrderLinkedQrAccess(admin, customer, code.id),
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
