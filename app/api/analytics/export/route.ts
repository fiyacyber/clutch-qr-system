import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";
import { hasActiveClutchCodesSubscription, loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { analyticsScopeForCode, buildBasicAnalyticsCsvRows } from "@/lib/order-linked-analytics";
import {
  applyAnalyticsFilters,
  getScanBrowser,
  getScanDevice,
  getScanLocation,
  getScanOs,
  getScanReferrer,
  toCsv,
  type AnalyticsFilters,
} from "@/lib/analytics";

const CSV_HEADERS =
  "qr_name,qr_slug,created_at,device,browser,operating_system,location,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term\n";

const defaultDependencies = { requireCustomer, createSupabaseAdminClient, loadAccountAccess, loadOrderLinkedQrAccess };

export function createAnalyticsExportHandler(dependencies: Partial<typeof defaultDependencies> = {}) {
  const deps = { ...defaultDependencies, ...dependencies };
  return async function handler(req: NextRequest) {
  const { user, customer } = await deps.requireCustomer();

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = deps.createSupabaseAdminClient();
  const access = await deps.loadAccountAccess(admin, customer);
  if (!access.canExportQr || !access.canUseCampaignAnalytics) {
    return NextResponse.json({ error: "Campaign export access is locked." }, { status: 403 });
  }
  const { data: qrCodes, error: qrCodesError } = await admin
    .from("qr_codes")
    .select("id, name, slug")
    .eq("customer_id", customer.id);
  if (qrCodesError) return NextResponse.json({ error: "Failed to load analytics export." }, { status: 500 });

  const candidateCodes = qrCodes || [];
  const codeAccess = await Promise.all(candidateCodes.map(async (code) => ({
    code,
    access: await deps.loadOrderLinkedQrAccess(admin, customer, code.id),
  })));
  const codes = codeAccess.filter((entry) => entry.access.canExportBasicAnalytics).map((entry) => entry.code);
  const qrIds = codes.map((code) => code.id);
  const paid = hasActiveClutchCodesSubscription(customer);
  const basicOnly = !customer.is_admin && !paid && codeAccess.some((entry) =>
    analyticsScopeForCode({ isAdmin: false, hasPaidAnalytics: false, codeAccess: entry.access }) === "basic_code"
  );

  if (!qrIds.length && !customer.is_admin && !paid) {
    return NextResponse.json({ error: "Your Included Access Has Ended" }, { status: 403 });
  }

  if (!qrIds.length) {
    return new NextResponse(CSV_HEADERS, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=clutch-qr-analytics.csv",
      },
    });
  }

  const { data: scanRows, error: scanRowsError } = await admin
    .from("qr_scans")
    .select(basicOnly ? "qr_code_id, created_at" : "*")
    .in("qr_code_id", qrIds)
    .order("created_at", { ascending: false });
  if (scanRowsError) return NextResponse.json({ error: "Failed to load analytics export." }, { status: 500 });
  const normalizedScanRows = (scanRows || []) as any[];

  if (basicOnly) {
    const csv = toCsv(buildBasicAnalyticsCsvRows(codes, normalizedScanRows));
    return new NextResponse(csv, { headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=clutch-qr-basic-analytics.csv",
    } });
  }

  const searchParams = req.nextUrl.searchParams;
  const filters: AnalyticsFilters = {
    qr: searchParams.get("qr") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    device: searchParams.get("device") || undefined,
    browser: searchParams.get("browser") || undefined,
    location: searchParams.get("location") || undefined,
    referrer: searchParams.get("referrer") || undefined,
  };
  const codeById = new Map(codes.map((code) => [code.id, code]));
  const filteredScans = applyAnalyticsFilters(normalizedScanRows, filters);
  const csv = toCsv(
    filteredScans.map((scan: any) => {
      const code = codeById.get(scan.qr_code_id);

      return {
        qr_name: code?.name || "Unknown QR",
        qr_slug: code?.slug || scan.slug || "",
        created_at: scan.created_at || "",
        device: getScanDevice(scan),
        browser: getScanBrowser(scan),
        operating_system: getScanOs(scan),
        location: getScanLocation(scan),
        referrer: getScanReferrer(scan),
        utm_source: scan.utm_source || "",
        utm_medium: scan.utm_medium || "",
        utm_campaign: scan.utm_campaign || "",
        utm_content: scan.utm_content || "",
        utm_term: scan.utm_term || "",
      };
    })
  );
  const output = csv || CSV_HEADERS;

  return new NextResponse(output, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=clutch-qr-analytics.csv",
    },
  });
}
}

export const GET = createAnalyticsExportHandler();
