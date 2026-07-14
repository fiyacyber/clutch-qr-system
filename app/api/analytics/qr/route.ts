import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchUnifiedAnalyticsData } from "@/lib/clutch-analytics";
import { loadAccountAccess } from "@/lib/account-access-server";
import { loadOrderLinkedQrAccess } from "@/lib/order-linked-access";

export async function GET() {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  if (!access.canUseCampaignAnalytics) return NextResponse.json({ error: "Campaign analytics access is locked." }, { status: 403 });
  const data = await fetchUnifiedAnalyticsData(admin, customer as any);

  const scansByQr = new Map<string, any[]>();
  for (const scan of data.qrScans) {
    const items = scansByQr.get(scan.qr_code_id) || [];
    items.push(scan);
    scansByQr.set(scan.qr_code_id, items);
  }

  const profileById = new Map(data.profiles.map((row) => [row.id, row]));

  const accessRows = await Promise.all(data.qrCodes.map(async (code) => ({ code, access: await loadOrderLinkedQrAccess(admin, customer, code.id) })));
  const rows = accessRows.filter(({ access: codeAccess }) => codeAccess.canViewBasicAnalytics).map(({ code }) => {
    const scans = scansByQr.get(code.id) || [];
    const uniqueVisitors = new Set(scans.map((scan) => scan.ip_hash).filter(Boolean)).size;
    const lastScan = scans[0]?.created_at || null;
    const linkedProfileId = code.connect_profile_id || code.profile_id || null;
    const linkedProfile = linkedProfileId ? profileById.get(linkedProfileId) : null;

    return {
      id: code.id,
      name: code.name,
      destination: code.destination_url,
      slug: code.slug,
      totalScans: scans.length,
      uniqueVisitors,
      lastScan,
      linkedProfile: linkedProfile
        ? {
            id: linkedProfile.id,
            slug: linkedProfile.slug,
            name: linkedProfile.business_name || linkedProfile.contact_name || linkedProfile.slug,
          }
        : null,
    };
  });

  return NextResponse.json({ rows });
}
