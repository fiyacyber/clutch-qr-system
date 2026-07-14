import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchUnifiedAnalyticsData } from "@/lib/clutch-analytics";
import { loadAccountAccess } from "@/lib/account-access-server";
import { hasActiveClutchCodesSubscription, loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { analyticsScopeForCode, buildBasicCodeAnalytics } from "@/lib/order-linked-analytics";

const defaultDependencies = { requireCustomer, createSupabaseAdminClient, loadAccountAccess, loadOrderLinkedQrAccess, fetchUnifiedAnalyticsData };

export function createQrAnalyticsListHandler(dependencies: Partial<typeof defaultDependencies> = {}) {
  const deps = { ...defaultDependencies, ...dependencies };
  return async function handler() {
  try {
  const { user, customer } = await deps.requireCustomer();
  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = deps.createSupabaseAdminClient();
  const access = await deps.loadAccountAccess(admin, customer);
  if (!access.canUseCampaignAnalytics) return NextResponse.json({ error: "Campaign analytics access is locked." }, { status: 403 });
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
    return NextResponse.json({ scope: "basic_code", rows: permitted.map((code) => buildBasicCodeAnalytics(code, scans || [])) });
  }
  const data = await deps.fetchUnifiedAnalyticsData(admin, customer as any);

  const scansByQr = new Map<string, any[]>();
  for (const scan of data.qrScans) {
    const items = scansByQr.get(scan.qr_code_id) || [];
    items.push(scan);
    scansByQr.set(scan.qr_code_id, items);
  }

  const profileById = new Map(data.profiles.map((row) => [row.id, row]));

  const accessRows = await Promise.all(data.qrCodes.map(async (code) => ({ code, access: await deps.loadOrderLinkedQrAccess(admin, customer, code.id) })));
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

  return NextResponse.json({ scope: customer.is_admin ? "admin" : "full_account", rows });
  } catch (error) {
    console.error("QR analytics list error:", error);
    return NextResponse.json({ error: "Failed to fetch QR analytics" }, { status: 500 });
  }
  }
}

export const GET = createQrAnalyticsListHandler();
