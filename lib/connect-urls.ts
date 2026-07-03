function trimBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeConnectHost(baseUrl: string) {
  return baseUrl.replace(/clutchonnect\.link/gi, "clutchconnect.link");
}

function normalizeSlugSegment(slug: string) {
  return String(slug || "").trim().replace(/^\/+|\/+$/g, "");
}

export function getAppBaseUrl() {
  return trimBaseUrl(
    process.env.CLUTCH_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_CLUTCH_APP_BASE_URL ||
    "https://qr.clutchprintshop.com"
  );
}

export function getConnectPublicBaseUrl() {
  return normalizeConnectHost(
    trimBaseUrl(
      process.env.CLUTCH_CONNECT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_CLUTCH_CONNECT_PUBLIC_BASE_URL ||
      "https://clutchconnect.link"
    )
  );
}

export function buildConnectPublicProfileUrl(slug: string) {
  const safeSlug = normalizeSlugSegment(slug);
  return `${getConnectPublicBaseUrl()}/u/${encodeURIComponent(safeSlug)}`;
}

export function buildAppQrUrl(qrSlug: string) {
  const safeQrSlug = normalizeSlugSegment(qrSlug);
  return `${getAppBaseUrl()}/qr/${encodeURIComponent(safeQrSlug)}`;
}
