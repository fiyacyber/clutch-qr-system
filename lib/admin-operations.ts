export type AdminStatusTone = "neutral" | "warning" | "attention" | "success";

const ACRONYMS: Record<string, string> = {
  qr: "QR",
  nfc: "NFC",
  api: "API",
};

export function formatAdminLabel(value: string | null | undefined, fallback = "—") {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  if (!normalized.includes("_") && !normalized.includes("-")) {
    if (/\s/.test(normalized)) return normalized;
    return ACRONYMS[normalized.toLowerCase()] || `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`;
  }

  const words = normalized
    .split(/[_-]+/)
    .map((word) => ACRONYMS[word.toLowerCase()] || `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`);

  return words
    .map((word, index) => index > 0 && ["And", "For", "Of", "To"].includes(word) ? word.toLowerCase() : word)
    .join(" ");
}

export function getAdminStatusTone(value: string | null | undefined): AdminStatusTone {
  const status = String(value || "").toLowerCase();
  if (["failed", "needs_attention", "changes_requested", "cancelled", "blocked"].includes(status)) return "attention";
  if (["ready", "ready_for_production", "approved", "completed", "fulfilled", "delivered", "active"].includes(status)) return "success";
  if (["pending", "preparing", "sent", "in_production", "submitted", "submitted_to_supplier", "partial"].includes(status)) return "warning";
  return "neutral";
}

export function formatOrderAge(value: string, now = new Date()) {
  const elapsedMs = Math.max(0, now.getTime() - new Date(value).getTime());
  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}
