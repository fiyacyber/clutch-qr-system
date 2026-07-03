export function sanitizeNextPath(value: string | null | undefined, fallback = "/portal") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//")) return fallback;
  if (decoded.includes("\\")) return fallback;

  try {
    const parsed = new URL(decoded, "https://clutch.local");
    if (parsed.origin !== "https://clutch.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
