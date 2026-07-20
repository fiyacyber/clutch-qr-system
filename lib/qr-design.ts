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
