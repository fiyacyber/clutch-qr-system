export type ExistingClutchCodeReference = { kind: "id" | "slug"; value: string };

export type ExistingClutchCodeRow = {
  id: string;
  customer_id: string;
  slug?: string | null;
  is_system?: boolean | null;
  capacity_source?: string | null;
  counts_toward_capacity?: boolean | null;
  customer_can_edit_destination?: boolean | null;
  is_active?: boolean | null;
  qr_type?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,118}[a-z0-9]$/i;
const REDIRECT_HOSTS = new Set(["qr.clutchprintshop.com"]);

export function normalizeExistingClutchCodeReference(value: unknown): ExistingClutchCodeReference | null {
  const raw = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 512);
  if (!raw) return null;
  if (UUID_PATTERN.test(raw)) return { kind: "id", value: raw.toLowerCase() };

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password || url.port || !REDIRECT_HOSTS.has(url.hostname.toLowerCase())) return null;
      const match = url.pathname.match(/^\/qr\/([^/]+)\/?$/i);
      if (!match) return null;
      const slug = decodeURIComponent(match[1]);
      return SLUG_PATTERN.test(slug) ? { kind: "slug", value: slug.toLowerCase() } : null;
    } catch {
      return null;
    }
  }

  return SLUG_PATTERN.test(raw) ? { kind: "slug", value: raw.toLowerCase() } : null;
}

export function isEligibleExistingClutchCode(row: ExistingClutchCodeRow | null, customerId: string) {
  return Boolean(
    row &&
    row.customer_id === customerId &&
    row.is_system === false &&
    row.capacity_source === "subscription" &&
    row.counts_toward_capacity === true &&
    row.customer_can_edit_destination === true &&
    row.is_active === true &&
    !["smart_card", "tracked_print", "business_kit", "system_exempt"].includes(String(row.qr_type || ""))
  );
}

export async function resolveExistingClutchCode(
  reference: unknown,
  customerId: string,
  lookup: (reference: ExistingClutchCodeReference, customerId: string) => Promise<ExistingClutchCodeRow | null>
) {
  const normalized = normalizeExistingClutchCodeReference(reference);
  if (!normalized) return null;
  const row = await lookup(normalized, customerId);
  return isEligibleExistingClutchCode(row, customerId) ? row!.id : null;
}
