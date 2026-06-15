import QRCode from "qrcode";

export function qrUrl(slug: string) {
  const base = process.env.CLUTCH_QR_BASE_URL || "https://qr.clutchprintshop.com";
  return `${base.replace(/\/$/, "")}/qr/${slug}`;
}

export async function qrDataUrl(slug: string) {
  return QRCode.toDataURL(qrUrl(slug), {
    margin: 2,
    width: 900,
    color: {
      dark: "#384862",
      light: "#FFFFFF"
    }
  });
}

export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "https://clutchprintshop.com";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}
