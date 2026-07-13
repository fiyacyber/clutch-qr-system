import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchUnifiedAnalyticsData, isCountedProfileView } from "@/lib/clutch-analytics";
import { loadAccountAccess } from "@/lib/account-access-server";

export async function GET() {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  if (!access.canUseProfileAnalytics) return NextResponse.json({ error: "Profile analytics access is locked." }, { status: 403 });
  const data = await fetchUnifiedAnalyticsData(admin, customer as any);

  const profileEventMap = new Map<string, any[]>();
  for (const event of data.connectEvents) {
    const items = profileEventMap.get(event.profile_id) || [];
    items.push(event);
    profileEventMap.set(event.profile_id, items);
  }

  const qrByProfile = new Map<string, any[]>();
  for (const qr of data.qrCodes) {
    const profileId = qr.connect_profile_id || qr.profile_id;
    if (!profileId) continue;
    const items = qrByProfile.get(profileId) || [];
    items.push(qr);
    qrByProfile.set(profileId, items);
  }

  const rows = data.profiles.map((profile) => {
    const events = profileEventMap.get(profile.id) || [];
    const profileViews = events.filter(isCountedProfileView).length;
    const linkClicks = events.filter((row) => row.event_type === "link_click").length;
    const leadsCaptured = events.filter((row) => row.event_type === "lead_submit").length;

    const topLink = events
      .filter((row) => row.event_type === "link_click")
      .reduce<Record<string, number>>((acc, row) => {
        const key = row.link_label || row.link_url || "Unknown link";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    const topClickedLink = Object.entries(topLink)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const linkedQr = qrByProfile.get(profile.id)?.[0] || null;

    return {
      id: profile.id,
      slug: profile.slug,
      profileName: profile.business_name || profile.contact_name || profile.slug,
      profileViews,
      linkClicks,
      topClickedLink,
      leadsCaptured,
      linkedQrCode: linkedQr
        ? {
            id: linkedQr.id,
            name: linkedQr.name,
            slug: linkedQr.slug,
          }
        : null,
    };
  });

  return NextResponse.json({ rows });
}
