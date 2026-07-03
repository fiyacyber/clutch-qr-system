const SAFE_FALLBACK_PATH = "/portal";

export function sanitizeNextPath(nextPath: string | null | undefined, fallback = SAFE_FALLBACK_PATH) {
  if (!nextPath) return fallback;

  const candidate = nextPath.trim();
  if (!candidate) return fallback;
  const isAbsoluteHttp = candidate.startsWith("http://") || candidate.startsWith("https://");
  if (!candidate.startsWith("/") && !isAbsoluteHttp) return fallback;

  try {
    const parsed = new URL(candidate, "http://localhost");
    const configuredOrigin = process.env.CLUTCH_QR_BASE_URL
      ? new URL(process.env.CLUTCH_QR_BASE_URL).origin
      : null;

    const allowedOrigins = new Set(["http://localhost"]);
    if (configuredOrigin) allowedOrigins.add(configuredOrigin);

    if (!allowedOrigins.has(parsed.origin)) return fallback;

    if (candidate.startsWith("//")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}