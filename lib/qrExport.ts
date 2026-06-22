import QRCode from "qrcode";

export type QRExportFormat = "png" | "svg" | "jpeg" | "pdf";

const QR_SIZE = 1024;
const QR_DARK = "#000000";
const QR_LIGHT = "#ffffff";

const QR_OPTIONS = {
  errorCorrectionLevel: "H" as const,
  margin: 4,
  width: QR_SIZE,
  color: {
    dark: QR_DARK,
    light: QR_LIGHT,
  },
};

export function getExportShortUrl(slug: string) {
  const base = process.env.CLUTCH_QR_BASE_URL || "https://qr.clutchprintshop.com";
  return `${base.replace(/\/$/, "")}/qr/${encodeURIComponent(slug)}`;
}

export function getQrExportFilename(slug: string, format: QRExportFormat) {
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "-");
  const extension = format === "jpeg" ? "jpg" : format;
  return `clutch-qr-${safeSlug}.${extension}`;
}

async function generateQrRaster(
  shortUrl: string,
  type: "image/png" | "image/jpeg",
  quality?: number
) {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, shortUrl, QR_OPTIONS);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = QR_SIZE;
  outputCanvas.height = QR_SIZE;
  const context = outputCanvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available for QR export.");
  }

  context.fillStyle = QR_LIGHT;
  context.fillRect(0, 0, QR_SIZE, QR_SIZE);
  context.imageSmoothingEnabled = false;
  const offsetX = Math.floor((QR_SIZE - qrCanvas.width) / 2);
  const offsetY = Math.floor((QR_SIZE - qrCanvas.height) / 2);
  context.drawImage(qrCanvas, offsetX, offsetY);

  return outputCanvas.toDataURL(type, quality);
}

export function generateQrPng(shortUrl: string) {
  return generateQrRaster(shortUrl, "image/png");
}

export function generateQrJpeg(shortUrl: string) {
  return generateQrRaster(shortUrl, "image/jpeg", 0.92);
}

export function generateQrSvg(shortUrl: string) {
  return QRCode.toString(shortUrl, {
    ...QR_OPTIONS,
    type: "svg",
  });
}

export async function generateQrPdf(shortUrl: string) {
  const [{ jsPDF }, pngDataUrl] = await Promise.all([
    import("jspdf"),
    generateQrPng(shortUrl),
  ]);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const qrSize = 360;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = (pageHeight - qrSize) / 2 - 28;

  pdf.addImage(pngDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(56, 72, 98);
  const urlLines = pdf.splitTextToSize(shortUrl, pageWidth - 72);
  pdf.text(urlLines, pageWidth / 2, qrY + qrSize + 28, {
    align: "center",
  });

  return pdf.output("blob");
}

function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  downloadUrl(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function exportQrCode(slug: string, format: QRExportFormat) {
  const shortUrl = getExportShortUrl(slug);
  const filename = getQrExportFilename(slug, format);

  if (format === "png") {
    downloadUrl(await generateQrPng(shortUrl), filename);
    return;
  }

  if (format === "jpeg") {
    downloadUrl(await generateQrJpeg(shortUrl), filename);
    return;
  }

  if (format === "svg") {
    const svg = await generateQrSvg(shortUrl);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename);
    return;
  }

  downloadBlob(await generateQrPdf(shortUrl), filename);
}
