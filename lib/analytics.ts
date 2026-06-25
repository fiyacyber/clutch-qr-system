export type QRAnalyticsCode = {
  id: string;
  name: string;
  slug: string;
  scan_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type QRAnalyticsScan = {
  id?: string | number;
  qr_code_id: string;
  slug?: string | null;
  ip_hash?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
  device_type?: string | null;
  browser?: string | null;
  operating_system?: string | null;
  referrer_source?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  created_at?: string | null;
};

export type AnalyticsFilters = {
  qr?: string;
  from?: string;
  to?: string;
  device?: string;
  browser?: string;
  location?: string;
  referrer?: string;
  printPieceType?: string;
};

export type CountItem = {
  label: string;
  value: number;
};

export type CampaignComparisonItem = {
  id: string;
  name: string;
  slug: string;
  totalScans: number;
  recentScans: number;
  uniqueScans: number;
  trend: CountItem[];
  deviceMix: CountItem[];
  locationMix: CountItem[];
};

export type AdvancedAnalytics = {
  filteredScans: QRAnalyticsScan[];
  totalScans: number;
  uniqueScans: number;
  scansByDay: CountItem[];
  scansByHour: CountItem[];
  scansByWeekday: CountItem[];
  deviceBreakdown: CountItem[];
  browserBreakdown: CountItem[];
  osBreakdown: CountItem[];
  referrerBreakdown: CountItem[];
  locationBreakdown: CountItem[];
  heatMap: CountItem[];
  campaignComparison: CampaignComparisonItem[];
  bestPerforming: CampaignComparisonItem[];
  filterOptions: {
    qrCodes: QRAnalyticsCode[];
    devices: string[];
    browsers: string[];
    locations: string[];
    referrers: string[];
  };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getDeviceType(userAgent?: string | null) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "Unknown";
  if (/ipad|tablet/.test(ua)) return "Tablet";
  if (/mobile|iphone|android/.test(ua)) return "Mobile";
  return "Desktop";
}

export function getBrowser(userAgent?: string | null) {
  const ua = String(userAgent || "");
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Unknown";
}

export function getOperatingSystem(userAgent?: string | null) {
  const ua = String(userAgent || "");
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS|Macintosh/.test(ua)) return "macOS";
  if (/iPhone|iPad|iOS/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

export function getReferrerSource(referrer?: string | null) {
  if (!referrer) return "Direct / unknown";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "Other";
  }
}

export function getScanDevice(scan: QRAnalyticsScan) {
  return scan.device_type || getDeviceType(scan.user_agent);
}

export function getScanBrowser(scan: QRAnalyticsScan) {
  return scan.browser || getBrowser(scan.user_agent);
}

export function getScanOs(scan: QRAnalyticsScan) {
  return scan.operating_system || getOperatingSystem(scan.user_agent);
}

export function getScanReferrer(scan: QRAnalyticsScan) {
  return scan.referrer_source || getReferrerSource(scan.referrer);
}

export function getScanLocation(scan: QRAnalyticsScan) {
  const parts = [scan.city, scan.region, scan.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}

export function parseCoordinate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function getPrintPieceTypeLabel(utm_source?: string | null) {
  if (!utm_source) return "Not specified";
  
  const labelMap: Record<string, string> = {
    "standard_business_card": "Standard Business Card",
    "flyer": "Flyer",
    "yard_sign": "Yard Sign",
    "poster": "Poster",
    "brochure": "Brochure",
    "door_hanger": "Door Hanger",
    "direct_mail": "Direct Mail",
    "table_tent": "Table Tent",
    "other_print": "Other Print Piece",
  };
  
  return labelMap[utm_source] || utm_source.replace(/_/g, " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function getScanPrintPieceType(scan: QRAnalyticsScan) {
  return getPrintPieceTypeLabel(scan.utm_source);
}

export function countValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function dateKey(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toISOString().slice(0, 10);
}

function hourKey(value?: string | null) {
  if (!value) return "Unknown";
  return `${new Date(value).getHours().toString().padStart(2, "0")}:00`;
}

function weekdayKey(value?: string | null) {
  if (!value) return "Unknown";
  return WEEKDAYS[new Date(value).getDay()];
}

export function applyAnalyticsFilters(scans: QRAnalyticsScan[], filters: AnalyticsFilters) {
  return scans.filter((scan) => {
    const createdAt = scan.created_at ? new Date(scan.created_at) : null;

    if (filters.qr && scan.qr_code_id !== filters.qr) return false;
    if (filters.from && createdAt && createdAt < new Date(`${filters.from}T00:00:00`)) return false;
    if (filters.to && createdAt && createdAt > new Date(`${filters.to}T23:59:59`)) return false;
    if (filters.device && getScanDevice(scan) !== filters.device) return false;
    if (filters.browser && getScanBrowser(scan) !== filters.browser) return false;
    if (filters.location && getScanLocation(scan) !== filters.location) return false;
    if (filters.referrer && getScanReferrer(scan) !== filters.referrer) return false;
    if (filters.printPieceType && scan.utm_source !== filters.printPieceType) return false;

    return true;
  });
}

export function buildAdvancedAnalytics(
  codes: QRAnalyticsCode[],
  scans: QRAnalyticsScan[],
  filters: AnalyticsFilters = {}
): AdvancedAnalytics {
  const filteredScans = applyAnalyticsFilters(scans, filters);
  const scansByQr = new Map<string, QRAnalyticsScan[]>();
  const now = Date.now();
  const recentWindowMs = 1000 * 60 * 60 * 24 * 30;

  codes.forEach((code) => scansByQr.set(code.id, []));
  filteredScans.forEach((scan) => {
    const list = scansByQr.get(scan.qr_code_id) || [];
    list.push(scan);
    scansByQr.set(scan.qr_code_id, list);
  });

  const campaignComparison = codes.map((code) => {
    const qrScans = scansByQr.get(code.id) || [];
    const recentScans = qrScans.filter((scan) => {
      if (!scan.created_at) return false;
      return now - new Date(scan.created_at).getTime() <= recentWindowMs;
    });

    return {
      id: code.id,
      name: code.name,
      slug: code.slug,
      totalScans: qrScans.length,
      recentScans: recentScans.length,
      uniqueScans: new Set(qrScans.map((scan) => scan.ip_hash).filter(Boolean)).size,
      trend: countValues(qrScans.map((scan) => dateKey(scan.created_at))).slice(0, 14),
      deviceMix: countValues(qrScans.map(getScanDevice)).slice(0, 5),
      locationMix: countValues(qrScans.map(getScanLocation)).slice(0, 5),
    };
  });

  const bestPerforming = [...campaignComparison].sort(
    (a, b) => b.totalScans - a.totalScans || b.recentScans - a.recentScans
  );

  return {
    filteredScans,
    totalScans: filteredScans.length,
    uniqueScans: new Set(filteredScans.map((scan) => scan.ip_hash).filter(Boolean)).size,
    scansByDay: countValues(filteredScans.map((scan) => dateKey(scan.created_at))).slice(0, 30),
    scansByHour: countValues(filteredScans.map((scan) => hourKey(scan.created_at))).sort((a, b) =>
      a.label.localeCompare(b.label)
    ),
    scansByWeekday: WEEKDAYS.map((label) => ({
      label,
      value: filteredScans.filter((scan) => weekdayKey(scan.created_at) === label).length,
    })),
    deviceBreakdown: countValues(filteredScans.map(getScanDevice)),
    browserBreakdown: countValues(filteredScans.map(getScanBrowser)),
    osBreakdown: countValues(filteredScans.map(getScanOs)),
    referrerBreakdown: countValues(filteredScans.map(getScanReferrer)),
    locationBreakdown: countValues(filteredScans.map(getScanLocation)),
    heatMap: countValues(filteredScans.map(getScanLocation).filter((value) => value !== "Unknown location")),
    campaignComparison,
    bestPerforming,
    filterOptions: {
      qrCodes: codes,
      devices: uniqueValues(scans.map(getScanDevice)),
      browsers: uniqueValues(scans.map(getScanBrowser)),
      locations: uniqueValues(scans.map(getScanLocation)),
      referrers: uniqueValues(scans.map(getScanReferrer)),
    },
  };
}

export function toCsv(rows: Array<Record<string, string | number | null | undefined>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n");
}

// Heatmap helpers
export function buildHeatMap(scans: QRAnalyticsScan[]): { day: string; hour: string; count: number }[] {
  const heatData = new Map<string, number>();
  
  scans.forEach((scan) => {
    if (!scan.created_at) return;
    const date = new Date(scan.created_at);
    const day = WEEKDAYS[date.getDay()];
    const hour = date.getHours().toString().padStart(2, "0");
    const key = `${day}|${hour}`;
    heatData.set(key, (heatData.get(key) || 0) + 1);
  });

  return Array.from(heatData.entries()).map(([key, count]) => {
    const [day, hour] = key.split("|");
    return { day, hour, count };
  });
}

// UTM analytics
export function getScanUtmSource(scan: QRAnalyticsScan) {
  return scan.utm_source || "No data";
}

export function getScanUtmMedium(scan: QRAnalyticsScan) {
  return scan.utm_medium || "No data";
}

export function getScanUtmCampaign(scan: QRAnalyticsScan) {
  return scan.utm_campaign || "No data";
}

// Get repeat scan stats
export function getRepeatScans(scans: QRAnalyticsScan[]) {
  const ipHashes = scans.map((s) => s.ip_hash).filter(Boolean) as string[];
  const uniqueIps = new Set(ipHashes);
  const repeatCount = ipHashes.length - uniqueIps.size;
  return {
    totalScans: scans.length,
    uniqueScans: uniqueIps.size,
    repeatScans: repeatCount,
    repeatRate: uniqueIps.size > 0 ? (repeatCount / scans.length) * 100 : 0,
  };
}

// Get best performing QR code in a set
export function getBestQr(
  codes: QRAnalyticsCode[],
  scans: QRAnalyticsScan[]
) {
  const scansByQr = new Map<string, QRAnalyticsScan[]>();
  codes.forEach((code) => scansByQr.set(code.id, []));
  scans.forEach((scan) => {
    const list = scansByQr.get(scan.qr_code_id) || [];
    list.push(scan);
    scansByQr.set(scan.qr_code_id, list);
  });

  const performances = codes.map((code) => ({
    code,
    scans: scansByQr.get(code.id)?.length || 0,
  }));

  const best = performances.reduce((a, b) => (a.scans > b.scans ? a : b));
  return best.code;
}

// Get best scan hour
export function getBestHour(scans: QRAnalyticsScan[]): string | null {
  const hourCounts = new Map<string, number>();
  scans.forEach((scan) => {
    if (!scan.created_at) return;
    const hour = new Date(scan.created_at).getHours().toString().padStart(2, "0");
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  if (hourCounts.size === 0) return null;
  return Array.from(hourCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
}

// Get best scan day
export function getBestDay(scans: QRAnalyticsScan[]): string | null {
  const dayCounts = new Map<string, number>();
  scans.forEach((scan) => {
    if (!scan.created_at) return;
    const day = dateKey(scan.created_at);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  });

  if (dayCounts.size === 0) return null;
  return Array.from(dayCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
}

// Get last scan info
export function getLastScan(scans: QRAnalyticsScan[]): QRAnalyticsScan | null {
  if (!scans.length) return null;
  return scans.reduce((latest, current) => {
    if (!latest.created_at) return current;
    if (!current.created_at) return latest;
    return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
  });
}

// Generate insights
export function generateInsights(
  codes: QRAnalyticsCode[],
  scans: QRAnalyticsScan[]
): string[] {
  const insights: string[] = [];

  if (scans.length === 0) {
    insights.push("No scans yet. Share your QR code to start tracking!");
    return insights;
  }

  // Best hour insight
  const bestHour = getBestHour(scans);
  if (bestHour) {
    const hour12 = parseInt(bestHour) % 12 || 12;
    const ampm = parseInt(bestHour) >= 12 ? "PM" : "AM";
    insights.push(`Your peak scan time is ${hour12}:00 ${ampm}.`);
  }

  // Device insights
  const devices = countValues(scans.map(getScanDevice));
  if (devices.length > 0) {
    const topDevice = devices[0];
    insights.push(`Most scans come from ${topDevice.label} (${topDevice.value} scans).`);
  }

  // Best QR code
  const best = getBestQr(codes, scans);
  if (best) {
    insights.push(`Your best performing QR is "${best.name}".`);
  }

  // UTM insight
  const hasUtm = scans.some(
    (s) => s.utm_source || s.utm_medium || s.utm_campaign
  );
  if (!hasUtm) {
    insights.push("Add UTM parameters to track campaigns and sources.");
  }

  // Geographic insight
  const locations = countValues(scans.map(getScanLocation));
  if (locations.length > 0 && locations[0].label !== "Unknown location") {
    insights.push(`Your scans are from ${locations[0].label}.`);
  }

  return insights;
}

// Date range calculations
export function getDateRangeFor(preset: "7d" | "30d" | "90d" | "ytd"): {
  from: string;
  to: string;
} {
  const today = new Date();
  const to = today.toISOString().split("T")[0];
  let from: Date;

  switch (preset) {
    case "7d":
      from = new Date(today.setDate(today.getDate() - 7));
      break;
    case "30d":
      from = new Date(today.setDate(today.getDate() - 30));
      break;
    case "90d":
      from = new Date(today.setDate(today.getDate() - 90));
      break;
    case "ytd":
      from = new Date(today.getFullYear(), 0, 1);
      break;
    default:
      from = new Date(today.setDate(today.getDate() - 30));
  }

  return {
    from: from.toISOString().split("T")[0],
    to,
  };
}
