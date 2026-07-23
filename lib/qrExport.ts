import QRCode from "qrcode";

export type QRExportFormat = "png" | "svg" | "jpeg" | "pdf";

const QR_SIZE = 2400;
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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Unable to read image data."));
    reader.readAsDataURL(blob);
  });
}

async function cloneSvgWithInlineImages(sourceSvg: SVGSVGElement) {
  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(QR_SIZE));
  clone.setAttribute("height", String(QR_SIZE));
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const images = Array.from(clone.querySelectorAll("image"));
  await Promise.all(images.map(async (image) => {
    const href = image.getAttribute("href") || image.getAttribute("xlink:href");
    if (!href || href.startsWith("data:")) return;
    try {
      const response = await fetch(href, { credentials: "omit", mode: "cors" });
      if (!response.ok) throw new Error(`Logo request failed with ${response.status}.`);
      const dataUrl = await blobToDataUrl(await response.blob());
      image.setAttribute("href", dataUrl);
      image.removeAttribute("xlink:href");
    } catch (error) {
      console.warn("QR export could not inline the logo image.", error);
      image.remove();
    }
  }));

  return clone;
}

async function serializeRenderedQr(sourceSvg: SVGSVGElement) {
  const clone = await cloneSvgWithInlineImages(sourceSvg);
  return new XMLSerializer().serializeToString(clone);
}

async function svgMarkupToRaster(
  svgMarkup: string,
  type: "image/png" | "image/jpeg",
  quality?: number
) {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Unable to rasterize the QR SVG."));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = QR_SIZE;
    canvas.height = QR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available for QR export.");

    if (type === "image/jpeg") {
      context.fillStyle = QR_LIGHT;
      context.fillRect(0, 0, QR_SIZE, QR_SIZE);
    } else {
      context.clearRect(0, 0, QR_SIZE, QR_SIZE);
    }
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, QR_SIZE, QR_SIZE);
    return canvas.toDataURL(type, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function generateFallbackQrRaster(
  shortUrl: string,
  type: "image/png" | "image/jpeg",
  quality?: number
) {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, shortUrl, QR_OPTIONS);
  return qrCanvas.toDataURL(type, quality);
}

async function generateQrPng(shortUrl: string, sourceSvg?: SVGSVGElement | null) {
  if (sourceSvg) return svgMarkupToRaster(await serializeRenderedQr(sourceSvg), "image/png");
  return generateFallbackQrRaster(shortUrl, "image/png");
}

async function generateQrJpeg(shortUrl: string, sourceSvg?: SVGSVGElement | null) {
  if (sourceSvg) return svgMarkupToRaster(await serializeRenderedQr(sourceSvg), "image/jpeg", 0.94);
  return generateFallbackQrRaster(shortUrl, "image/jpeg", 0.94);
}

async function generateQrSvg(shortUrl: string, sourceSvg?: SVGSVGElement | null) {
  if (sourceSvg) return serializeRenderedQr(sourceSvg);
  return QRCode.toString(shortUrl, { ...QR_OPTIONS, type: "svg" });
}

async function generateQrPdf(shortUrl: string, sourceSvg?: SVGSVGElement | null) {
  const [{ jsPDF }, pngDataUrl] = await Promise.all([
    import("jspdf"),
    generateQrPng(shortUrl, sourceSvg),
  ]);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const qrSize = 420;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = (pageHeight - qrSize) / 2 - 28;

  pdf.addImage(pngDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(56, 72, 98);
  const urlLines = pdf.splitTextToSize(shortUrl, pageWidth - 72);
  pdf.text(urlLines, pageWidth / 2, qrY + qrSize + 28, { align: "center" });
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

export async function exportQrCode(
  slug: string,
  format: QRExportFormat,
  sourceSvg?: SVGSVGElement | null
) {
  const shortUrl = getExportShortUrl(slug);
  const filename = getQrExportFilename(slug, format);

  if (format === "png") {
    downloadUrl(await generateQrPng(shortUrl, sourceSvg), filename);
    return;
  }
  if (format === "jpeg") {
    downloadUrl(await generateQrJpeg(shortUrl, sourceSvg), filename);
    return;
  }
  if (format === "svg") {
    const svg = await generateQrSvg(shortUrl, sourceSvg);
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename);
    return;
  }
  downloadBlob(await generateQrPdf(shortUrl, sourceSvg), filename);
}
