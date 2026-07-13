import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchUnifiedAnalyticsData, isCountedProfileView } from "@/lib/clutch-analytics";
import { loadAccountAccess } from "@/lib/account-access-server";

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

    const totalScans = data.qrScans.length;
    const connectViews = data.connectEvents.filter(isCountedProfileView).length;
    const linkClicks = data.connectEvents.filter((row) => row.event_type === "link_click").length;
    const leadsCaptured = data.connectEvents.filter((row) => row.event_type === "lead_submit").length;
    const activeQrCodes = data.qrCodes.filter((row) => row.is_active !== false).length;
    const uniqueVisitors = new Set(
      [...data.qrScans.map((row) => row.ip_hash), ...data.connectEvents.map((row) => row.ip_hash || row.visitor_id)].filter(Boolean)
    ).size;

    return NextResponse.json({
      codes: data.qrCodes,
      scans: data.qrScans,
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
