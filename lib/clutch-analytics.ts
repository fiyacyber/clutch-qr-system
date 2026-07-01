import {
  getBrowser,
  getDeviceType,
  getOperatingSystem,
  getReferrerSource,
} from "@/lib/analytics";

type CustomerShape = {
  id: string;
  is_admin?: boolean | null;
};

export type UnifiedQrCode = {
  id: string;
  customer_id: string;
  name: string;
  slug: string;
  destination_url: string;
  foreground_color?: string | null;
  background_color?: string | null;
  scan_count: number | null;
  is_active?: boolean | null;
  profile_id?: string | null;
  connect_profile_id?: string | null;
  created_at?: string | null;
};

export type UnifiedProfile = {
  id: string;
  customer_id: string;
  slug: string;
  business_name?: string | null;
  contact_name?: string | null;
  primary_qr_code_id?: string | null;
  is_active?: boolean | null;
};

export type UnifiedQrScan = {
  id: string | number;
  qr_code_id: string;
  ip_hash?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  browser?: string | null;
  operating_system?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_source?: string | null;
  referrer?: string | null;
  created_at?: string | null;
};

export type UnifiedConnectEvent = {
  id: string | number;
  profile_id: string;
  qr_code_id?: string | null;
  event_type: string;
  link_id?: string | null;
  link_label?: string | null;
  link_url?: string | null;
  visitor_id?: string | null;
  ip_hash?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  referrer?: string | null;
  created_at?: string | null;
};

export type UnifiedAnalyticsData = {
  isAdmin: boolean;
  qrCodes: UnifiedQrCode[];
  profiles: UnifiedProfile[];
  qrScans: UnifiedQrScan[];
  connectEvents: UnifiedConnectEvent[];
};

function normalizeLegacyEventType(eventType: string) {
  switch (eventType) {
    case "profile_view":
      return "profile_view";
    case "lead_submit":
      return "lead_submit";
    case "vcard_download":
      return "save_contact";
    case "apple_wallet_download":
    case "google_wallet_add":
      return "wallet_click";
    case "link_click":
    case "call_click":
    case "text_click":
    case "email_click":
    case "website_click":
    case "directions_click":
    case "quote_cta_click":
      return "link_click";
    default:
      return "link_click";
  }
}

type SupabaseAdmin = ReturnType<typeof import("@/lib/supabase-server").createSupabaseAdminClient>;

export async function fetchUnifiedAnalyticsData(admin: SupabaseAdmin, customer: CustomerShape): Promise<UnifiedAnalyticsData> {
  const isAdmin = Boolean(customer?.is_admin);

  let codesQuery = admin
    .from("qr_codes")
    .select("id, customer_id, name, slug, destination_url, foreground_color, background_color, scan_count, is_active, profile_id, connect_profile_id, created_at")
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    codesQuery = codesQuery.eq("customer_id", customer.id);
  }

  const { data: qrCodesRows, error: qrCodesError } = await codesQuery;
  if (qrCodesError) throw qrCodesError;
  const qrCodes = (qrCodesRows || []) as UnifiedQrCode[];

  let profilesQuery = admin
    .from("profiles")
    .select("id, customer_id, slug, business_name, contact_name, primary_qr_code_id, is_active")
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    profilesQuery = profilesQuery.eq("customer_id", customer.id);
  }

  const { data: profilesRows, error: profilesError } = await profilesQuery;
  if (profilesError) throw profilesError;
  const profiles = (profilesRows || []) as UnifiedProfile[];

  const qrIds = qrCodes.map((row) => row.id);
  const profileIds = profiles.map((row) => row.id);

  let qrScans: UnifiedQrScan[] = [];
  if (qrIds.length) {
    const primaryQrScanQuery = await admin
      .from("qr_scans")
      .select("id, qr_code_id, ip_hash, user_agent, device_type, browser, operating_system, country, region, city, latitude, longitude, location_source, referrer, created_at")
      .in("qr_code_id", qrIds)
      .order("created_at", { ascending: false })
      .limit(20000);

    if (!primaryQrScanQuery.error) {
      qrScans = (primaryQrScanQuery.data || []) as UnifiedQrScan[];
    } else {
      const fallbackQrScanQuery = await admin
        .from("qr_scans")
        .select("id, qr_code_id, ip_hash, user_agent, device_type, browser, operating_system, country, region, city, latitude, longitude, referrer, created_at")
        .in("qr_code_id", qrIds)
        .order("created_at", { ascending: false })
        .limit(20000);

      if (fallbackQrScanQuery.error) throw fallbackQrScanQuery.error;
      qrScans = (fallbackQrScanQuery.data || []) as UnifiedQrScan[];
    }
  }

  let connectEvents: UnifiedConnectEvent[] = [];

  if (profileIds.length) {
    const { data: modernConnectRows, error: modernConnectError } = await admin
      .from("connect_events")
      .select("id, profile_id, qr_code_id, event_type, link_id, link_label, link_url, visitor_id, ip_hash, user_agent, device_type, browser, os, country, region, city, referrer, created_at")
      .in("profile_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(30000);

    if (!modernConnectError && modernConnectRows && modernConnectRows.length) {
      connectEvents = modernConnectRows as UnifiedConnectEvent[];
    } else {
      const { data: legacyEvents } = await admin
        .from("profile_click_events")
        .select("id, profile_id, profile_link_id, event_type, metadata, ip_hash, user_agent, created_at")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(30000);

      const { data: leadRows } = await admin
        .from("profile_leads")
        .select("id, profile_id, ip_hash, user_agent, created_at")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(20000);

      const { data: walletRows } = await admin
        .from("wallet_events")
        .select("id, profile_id, ip_hash, user_agent, created_at")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(20000);

      connectEvents = [
        ...((legacyEvents || []).map((row: any) => ({
          id: row.id,
          profile_id: row.profile_id,
          qr_code_id: row.metadata?.qr_code_id || null,
          event_type: normalizeLegacyEventType(String(row.event_type || "")),
          link_id: row.profile_link_id || null,
          link_label: row.metadata?.link_label || row.metadata?.label || null,
          link_url: row.metadata?.link_url || row.metadata?.url || null,
          visitor_id: row.ip_hash || null,
          ip_hash: row.ip_hash || null,
          user_agent: row.user_agent || null,
          device_type: getDeviceType(row.user_agent),
          browser: getBrowser(row.user_agent),
          os: getOperatingSystem(row.user_agent),
          country: null,
          region: null,
          city: null,
          referrer: getReferrerSource(row.metadata?.referrer || null),
          created_at: row.created_at,
        })) as UnifiedConnectEvent[]),
        ...((leadRows || []).map((row: any) => ({
          id: `lead-${row.id}`,
          profile_id: row.profile_id,
          qr_code_id: null,
          event_type: "lead_submit",
          link_id: null,
          link_label: null,
          link_url: null,
          visitor_id: row.ip_hash || null,
          ip_hash: row.ip_hash || null,
          user_agent: row.user_agent || null,
          device_type: getDeviceType(row.user_agent),
          browser: getBrowser(row.user_agent),
          os: getOperatingSystem(row.user_agent),
          country: null,
          region: null,
          city: null,
          referrer: null,
          created_at: row.created_at,
        })) as UnifiedConnectEvent[]),
        ...((walletRows || []).map((row: any) => ({
          id: `wallet-${row.id}`,
          profile_id: row.profile_id,
          qr_code_id: null,
          event_type: "wallet_click",
          link_id: null,
          link_label: "Wallet",
          link_url: null,
          visitor_id: row.ip_hash || null,
          ip_hash: row.ip_hash || null,
          user_agent: row.user_agent || null,
          device_type: getDeviceType(row.user_agent),
          browser: getBrowser(row.user_agent),
          os: getOperatingSystem(row.user_agent),
          country: null,
          region: null,
          city: null,
          referrer: null,
          created_at: row.created_at,
        })) as UnifiedConnectEvent[]),
      ];
    }
  }

  return {
    isAdmin,
    qrCodes,
    profiles,
    qrScans,
    connectEvents,
  };
}

export function countBy(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = String(value || "Unknown").trim() || "Unknown";
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function buildScansOverTime(
  timestamps: Array<string | null | undefined>,
  days = 30
): { date: string; scans: number }[] {
  const now = new Date();
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const ts of timestamps) {
    if (!ts) continue;
    const key = new Date(ts).toISOString().slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  return Object.entries(buckets).map(([date, scans]) => ({ date, scans }));
}

export function buildHourlyHeatmap(timestamps: Array<string | null | undefined>) {
  const rows: Array<{ day: string; hour: number; count: number }> = [];
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const countMap = new Map<string, number>();

  for (const value of timestamps) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;

    const day = dayLabels[date.getDay()];
    const hour = date.getHours();
    const key = `${day}-${hour}`;
    countMap.set(key, (countMap.get(key) || 0) + 1);
  }

  for (const day of dayLabels) {
    for (let hour = 0; hour < 24; hour += 1) {
      const key = `${day}-${hour}`;
      rows.push({ day, hour, count: countMap.get(key) || 0 });
    }
  }

  return rows;
}
