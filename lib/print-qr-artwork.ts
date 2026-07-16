import QRCode from "qrcode";

const HEX = /^#[0-9a-fA-F]{6}$/;
const DOT_STYLES = new Set(["square", "rounded", "dots"]);
const CORNER_STYLES = new Set(["square", "dot", "extra-rounded"]);
const FRAME_STYLES = new Set(["none", "outline", "label"]);

export type PrintQrDesign = {
  codeName: string;
  campaignName: string;
  destinationUrl: string;
  foregroundColor: string;
  backgroundColor: string;
  dotStyle: "square" | "rounded" | "dots";
  cornerStyle: "square" | "dot" | "extra-rounded";
  frameStyle: "none" | "outline" | "label";
  frameColor: string;
  frameLabel: string;
  logoPath: string | null;
  logoUrl: string | null;
  logoSize: number;
};

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

export function parsePrintQrDestination(value: unknown): string | null {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function color(value: unknown, fallback: string) {
  const candidate = text(value, 7);
  return HEX.test(candidate) ? candidate.toLowerCase() : fallback;
}

function channel(value: string) {
  const normalized = Number.parseInt(value, 16) / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  return 0.2126 * channel(hex.slice(1, 3)) + 0.7152 * channel(hex.slice(3, 5)) + 0.0722 * channel(hex.slice(5, 7));
}

export function getQrContrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function sanitizePrintQrDesign(input: Record<string, unknown>, existing: Partial<PrintQrDesign> = {}): PrintQrDesign {
  const destinationUrl = parsePrintQrDestination(input.destinationUrl ?? existing.destinationUrl);
  if (!destinationUrl) throw new Error("Enter a valid http or https destination without credentials.");
  const foregroundColor = color(input.foregroundColor ?? existing.foregroundColor, "#384862");
  const backgroundColor = color(input.backgroundColor ?? existing.backgroundColor, "#ffffff");
  if (getQrContrastRatio(foregroundColor, backgroundColor) < 4.5) {
    throw new Error("Choose QR colors with stronger contrast for reliable scanning.");
  }
  const requestedDotStyle = text(input.dotStyle ?? existing.dotStyle, 24);
  const requestedCornerStyle = text(input.cornerStyle ?? existing.cornerStyle, 24);
  const requestedFrameStyle = text(input.frameStyle ?? existing.frameStyle, 24);
  return {
    codeName: text(input.codeName ?? existing.codeName, 80) || "Printed Clutch Code",
    campaignName: text(input.campaignName ?? existing.campaignName, 100) || "Print campaign",
    destinationUrl,
    foregroundColor,
    backgroundColor,
    dotStyle: (DOT_STYLES.has(requestedDotStyle) ? requestedDotStyle : "square") as PrintQrDesign["dotStyle"],
    cornerStyle: (CORNER_STYLES.has(requestedCornerStyle) ? requestedCornerStyle : "square") as PrintQrDesign["cornerStyle"],
    frameStyle: (FRAME_STYLES.has(requestedFrameStyle) ? requestedFrameStyle : "none") as PrintQrDesign["frameStyle"],
    frameColor: color(input.frameColor ?? existing.frameColor, "#384862"),
    frameLabel: text(input.frameLabel ?? existing.frameLabel, 40) || "SCAN ME",
    logoPath: text(input.logoPath ?? existing.logoPath, 500) || null,
    logoUrl: text(input.logoUrl ?? existing.logoUrl, 1000) || null,
    logoSize: Math.max(12, Math.min(24, Math.round(Number(input.logoSize ?? existing.logoSize ?? 18)))),
  };
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function moduleShape(x: number, y: number, style: PrintQrDesign["dotStyle"], colorValue: string) {
  if (style === "dots") return `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.46" fill="${colorValue}"/>`;
  const radius = style === "rounded" ? 0.26 : 0;
  return `<rect x="${x + 0.04}" y="${y + 0.04}" width="0.92" height="0.92" rx="${radius}" fill="${colorValue}"/>`;
}

export function renderPrintQrSvg(shortUrl: string, design: PrintQrDesign, logoDataUri?: string | null) {
  const qr = QRCode.create(shortUrl, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const margin = 4;
  const labelHeight = design.frameStyle === "label" ? 4 : 0;
  const totalWidth = size + margin * 2;
  const totalHeight = totalWidth + labelHeight;
  const modules: string[] = [];
  const finderDotStyle: PrintQrDesign["dotStyle"] = design.cornerStyle === "dot" ? "dots" : design.cornerStyle === "extra-rounded" ? "rounded" : "square";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inTopLeft = x < 7 && y < 7;
      const inTopRight = x >= size - 7 && y < 7;
      const inBottomLeft = x < 7 && y >= size - 7;
      if (qr.modules.get(x, y)) modules.push(moduleShape(x + margin, y + margin, inTopLeft || inTopRight || inBottomLeft ? finderDotStyle : design.dotStyle, design.foregroundColor));
    }
  }
  const frame = design.frameStyle === "none" ? "" : `<rect x="1" y="1" width="${totalWidth - 2}" height="${totalHeight - 2}" rx="1.4" fill="none" stroke="${design.frameColor}" stroke-width="0.7"/>`;
  const label = design.frameStyle === "label" ? `<text x="${totalWidth / 2}" y="${totalWidth + 2.25}" text-anchor="middle" font-family="Arial,sans-serif" font-size="1.65" font-weight="700" fill="${design.frameColor}">${escapeXml(design.frameLabel)}</text>` : "";
  const logoSide = size * (design.logoSize / 100);
  const logoX = (totalWidth - logoSide) / 2;
  const logoY = (totalWidth - logoSide) / 2;
  const logo = logoDataUri
    ? `<rect x="${logoX - 0.7}" y="${logoY - 0.7}" width="${logoSide + 1.4}" height="${logoSide + 1.4}" rx="0.8" fill="${design.backgroundColor}"/><image href="${escapeXml(logoDataUri)}" x="${logoX}" y="${logoY}" width="${logoSide}" height="${logoSide}" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${Math.round(2400 * totalHeight / totalWidth)}" viewBox="0 0 ${totalWidth} ${totalHeight}" shape-rendering="geometricPrecision" role="img" aria-label="${escapeXml(design.codeName)}"><metadata>Clutch Code short URL: ${escapeXml(shortUrl)}</metadata><rect width="100%" height="100%" fill="${design.backgroundColor}"/>${frame}<g>${modules.join("")}</g>${logo}${label}</svg>`;
}
