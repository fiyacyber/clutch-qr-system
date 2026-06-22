import QRCode from "qrcode";

export function qrUrl(slug: string) {
  const base = process.env.CLUTCH_QR_BASE_URL || "https://connect.clutchprintshop.com";
  return `${base.replace(/\/$/, "")}/qr/${slug}`;
}

export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "https://clutchprintshop.com";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export async function qrDataUrl(
  slug: string,
  options?: {
    foreground_color?: string;
    background_color?: string;
  }
) {
  return QRCode.toDataURL(qrUrl(slug), {
    margin: 2,
    width: 900,
    color: {
      dark: options?.foreground_color || "#384862",
      light: options?.background_color || "#ffffff",
    },
  });
}

export function qrServerImageUrl({
  url,
  foreground_color = "#384862",
  background_color = "#ffffff",
  size = 220,
}: {
  url: string;
  foreground_color?: string;
  background_color?: string;
  size?: number;
}) {
  const fg = foreground_color.replace("#", "");
  const bg = background_color.replace("#", "");

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=${fg}&bgcolor=${bg}&data=${encodeURIComponent(
    url
  )}`;
}
