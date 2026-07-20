export type QrCanvasShape = "square" | "circle";
export type QrBodyPattern =
  | "square"
  | "circle"
  | "rounded"
  | "diamond"
  | "vertical-bars"
  | "horizontal-bars"
  | "cross"
  | "blob"
  | "connected";
export type QrEyeFrameShape = "square" | "rounded" | "circle" | "octagon" | "diamond";
export type QrEyeCenterShape = "square" | "circle" | "rounded" | "diamond" | "star";
export type QrColorMode = "solid" | "linear" | "radial";

export type AdvancedQrDesign = {
  qrShape: QrCanvasShape;
  bodyPattern: QrBodyPattern;
  eyeFrameShape: QrEyeFrameShape;
  eyeCenterShape: QrEyeCenterShape;
  colorMode: QrColorMode;
  bodyColor: string;
  gradientEndColor: string;
  eyeFrameColor: string;
  eyeCenterColor: string;
  backgroundColor: string;
  outerStrokeEnabled: boolean;
  outerStrokeColor: string;
};

export type QrCanvasLayout = {
  quietZone: number;
  quietSquareSize: number;
  total: number;
  offset: number;
};

export const DEFAULT_QR_DESIGN: AdvancedQrDesign = {
  qrShape: "square",
  bodyPattern: "square",
  eyeFrameShape: "square",
  eyeCenterShape: "square",
  colorMode: "solid",
  bodyColor: "#384862",
  gradientEndColor: "#ff7a1a",
  eyeFrameColor: "#384862",
  eyeCenterColor: "#384862",
  backgroundColor: "#ffffff",
  outerStrokeEnabled: false,
  outerStrokeColor: "#384862",
};

export const QR_CANVAS_SHAPES = new Set<QrCanvasShape>(["square", "circle"]);
export const QR_BODY_PATTERNS = new Set<QrBodyPattern>([
  "square",
  "circle",
  "rounded",
  "diamond",
  "vertical-bars",
  "horizontal-bars",
  "cross",
  "blob",
  "connected",
]);
export const QR_EYE_FRAME_SHAPES = new Set<QrEyeFrameShape>([
  "square",
  "rounded",
  "circle",
  "octagon",
  "diamond",
]);
export const QR_EYE_CENTER_SHAPES = new Set<QrEyeCenterShape>([
  "square",
  "circle",
  "rounded",
  "diamond",
  "star",
]);
export const QR_COLOR_MODES = new Set<QrColorMode>(["solid", "linear", "radial"]);

/**
 * Circular canvases use a conservative subset because narrow modules and
 * heavily altered finder patterns lose reliability fastest at print size.
 */
export const SAFE_CIRCLE_BODY_PATTERNS = new Set<QrBodyPattern>(["square", "circle", "rounded"]);
export const SAFE_CIRCLE_EYE_FRAMES = new Set<QrEyeFrameShape>(["square", "rounded", "circle"]);
export const SAFE_CIRCLE_EYE_CENTERS = new Set<QrEyeCenterShape>(["square", "rounded", "circle"]);

export function getQrCanvasLayout(matrixSize: number, qrShape: QrCanvasShape): QrCanvasLayout {
  if (!Number.isInteger(matrixSize) || matrixSize <= 0) {
    throw new Error("QR matrix size must be a positive integer.");
  }

  const quietZone = 4;
  const quietSquareSize = matrixSize + quietZone * 2;
  const total = qrShape === "circle"
    ? Math.ceil(quietSquareSize * Math.SQRT2) + 2
    : quietSquareSize;

  return {
    quietZone,
    quietSquareSize,
    total,
    offset: (total - matrixSize) / 2,
  };
}

export function circularCanvasContainsQuietZone(matrixSize: number, strokeInset = 0.8): boolean {
  const layout = getQrCanvasLayout(matrixSize, "circle");
  const requiredRadius = Math.hypot(
    matrixSize / 2 + layout.quietZone,
    matrixSize / 2 + layout.quietZone
  );
  const availableRadius = layout.total / 2 - strokeInset;
  return availableRadius >= requiredRadius;
}

export function legacyDotStyle(pattern: QrBodyPattern): "square" | "rounded" | "dots" {
  if (pattern === "circle") return "dots";
  if (pattern === "rounded" || pattern === "blob" || pattern === "connected") return "rounded";
  return "square";
}

export function legacyCornerStyle(frame: QrEyeFrameShape): "square" | "dot" | "extra-rounded" {
  if (frame === "circle") return "dot";
  if (frame === "rounded") return "extra-rounded";
  return "square";
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function channelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: string): number {
  if (!isHexColor(color)) return 1;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hasPrintSafeContrast(foreground: string, background: string): boolean {
  return (
    isHexColor(foreground) &&
    isHexColor(background) &&
    relativeLuminance(foreground) < relativeLuminance(background) &&
    contrastRatio(foreground, background) >= 4.5
  );
}

export function getQrDesignScanIssues(design: AdvancedQrDesign): string[] {
  const issues: string[] = [];

  if (!hasPrintSafeContrast(design.bodyColor, design.backgroundColor)) {
    issues.push("Body color must be substantially darker than the background.");
  }
  if (
    design.colorMode !== "solid" &&
    !hasPrintSafeContrast(design.gradientEndColor, design.backgroundColor)
  ) {
    issues.push("Both gradient colors must remain substantially darker than the background.");
  }
  if (!hasPrintSafeContrast(design.eyeFrameColor, design.backgroundColor)) {
    issues.push("Eye-frame color must be substantially darker than the background.");
  }
  if (!hasPrintSafeContrast(design.eyeCenterColor, design.backgroundColor)) {
    issues.push("Eye-center color must be substantially darker than the background.");
  }

  if (design.qrShape === "circle") {
    if (!SAFE_CIRCLE_BODY_PATTERNS.has(design.bodyPattern)) {
      issues.push("Circular QR codes support Square, Circle, or Rounded body modules only.");
    }
    if (!SAFE_CIRCLE_EYE_FRAMES.has(design.eyeFrameShape)) {
      issues.push("Circular QR codes support Square, Rounded, or Circle eye frames only.");
    }
    if (!SAFE_CIRCLE_EYE_CENTERS.has(design.eyeCenterShape)) {
      issues.push("Circular QR codes support Square, Rounded, or Circle eye centers only.");
    }
  }

  return issues;
}

export function isQrDesignStructurallySafe(design: AdvancedQrDesign): boolean {
  return getQrDesignScanIssues(design).length === 0;
}

export function normalizeCircleDesign(design: AdvancedQrDesign): AdvancedQrDesign {
  if (design.qrShape !== "circle") return design;
  return {
    ...design,
    bodyPattern: SAFE_CIRCLE_BODY_PATTERNS.has(design.bodyPattern) ? design.bodyPattern : "square",
    eyeFrameShape: SAFE_CIRCLE_EYE_FRAMES.has(design.eyeFrameShape) ? design.eyeFrameShape : "square",
    eyeCenterShape: SAFE_CIRCLE_EYE_CENTERS.has(design.eyeCenterShape) ? design.eyeCenterShape : "square",
  };
}
