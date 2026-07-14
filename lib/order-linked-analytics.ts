import type { OrderLinkedAccess } from "./order-linked-access.ts";

export type AnalyticsAuthorizationScope = "none" | "basic_code" | "full_account" | "admin";

export function analyticsScopeForCode(input: {
  isAdmin?: boolean | null;
  hasPaidAnalytics: boolean;
  codeAccess: OrderLinkedAccess;
}): AnalyticsAuthorizationScope {
  if (input.isAdmin || input.codeAccess.state === "admin") return "admin";
  if (input.hasPaidAnalytics || input.codeAccess.state === "paid_subscription_access") return "full_account";
  if (input.codeAccess.state === "active_included_access" && input.codeAccess.canViewBasicAnalytics) return "basic_code";
  return "none";
}

export type BasicScan = { qr_code_id: string; created_at?: string | null };
export type BasicCode = { id: string; name: string; slug?: string | null };

export function buildBasicCodeAnalytics(code: BasicCode, scans: BasicScan[]) {
  const valid = scans
    .filter((scan) => scan.qr_code_id === code.id && scan.created_at && Number.isFinite(Date.parse(scan.created_at)))
    .map((scan) => scan.created_at as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const dayCounts = new Map<string, number>();
  for (const timestamp of valid) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }
  return {
    scope: "basic_code" as const,
    code: { id: code.id, name: code.name },
    totalScans: valid.length,
    firstScanAt: valid[0] || null,
    lastScanAt: valid.at(-1) || null,
    scansByUtcDay: Array.from(dayCounts, ([date, count]) => ({ date, count })),
  };
}

export function buildBasicAnalyticsCsvRows(codes: BasicCode[], scans: BasicScan[]) {
  return codes.flatMap((code) => {
    const aggregate = buildBasicCodeAnalytics(code, scans);
    if (!aggregate.scansByUtcDay.length) {
      return [{
        qr_name: code.name,
        total_scans: aggregate.totalScans,
        first_scan_at: aggregate.firstScanAt,
        last_scan_at: aggregate.lastScanAt,
        utc_day: "",
        scan_count: 0,
      }];
    }
    return aggregate.scansByUtcDay.map((day) => ({
      qr_name: code.name,
      total_scans: aggregate.totalScans,
      first_scan_at: aggregate.firstScanAt,
      last_scan_at: aggregate.lastScanAt,
      utc_day: day.date,
      scan_count: day.count,
    }));
  });
}
