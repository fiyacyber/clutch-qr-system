"use client";

import { useId, useMemo, type ReactNode } from "react";
import QRCode from "qrcode";
import type {
  QrBodyPattern,
  QrCanvasShape,
  QrColorMode,
  QrEyeCenterShape,
  QrEyeFrameShape,
} from "@/lib/qr-design";

export type AdvancedQRPreviewProps = {
  url: string;
  qrShape?: QrCanvasShape;
  bodyPattern?: QrBodyPattern;
  eyeFrameShape?: QrEyeFrameShape;
  eyeCenterShape?: QrEyeCenterShape;
  colorMode?: QrColorMode;
  bodyColor?: string;
  gradientEndColor?: string;
  eyeFrameColor?: string;
  eyeCenterColor?: string;
  backgroundColor?: string;
  outerStrokeEnabled?: boolean;
  outerStrokeColor?: string;
  logoUrl?: string | null;
};

type Matrix = {
  size: number;
  get?: (row: number, col: number) => number | boolean;
  data?: ArrayLike<number>;
};

function isFinderCell(row: number, col: number, size: number) {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7)
  );
}

function moduleIsDark(matrix: Matrix, row: number, col: number) {
  if (typeof matrix.get === "function") return Boolean(matrix.get(row, col));
  return Boolean(matrix.data?.[row * matrix.size + col]);
}

function octagonPoints(x: number, y: number, size: number) {
  const cut = size * 0.27;
  return `${x + cut},${y} ${x + size - cut},${y} ${x + size},${y + cut} ${x + size},${y + size - cut} ${x + size - cut},${y + size} ${x + cut},${y + size} ${x},${y + size - cut} ${x},${y + cut}`;
}

function diamondPoints(x: number, y: number, size: number) {
  return `${x + size / 2},${y} ${x + size},${y + size / 2} ${x + size / 2},${y + size} ${x},${y + size / 2}`;
}

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
}

function BodyModule({
  x,
  y,
  pattern,
  fill,
  right,
  bottom,
}: {
  x: number;
  y: number;
  pattern: QrBodyPattern;
  fill: string;
  right: boolean;
  bottom: boolean;
}) {
  switch (pattern) {
    case "circle":
      return <circle cx={x + 0.5} cy={y + 0.5} r={0.43} fill={fill} />;
    case "rounded":
      return <rect x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} rx={0.28} fill={fill} />;
    case "diamond":
      return <polygon points={diamondPoints(x + 0.04, y + 0.04, 0.92)} fill={fill} />;
    case "vertical-bars":
      return <rect x={x + 0.27} y={y + 0.02} width={0.46} height={0.96} rx={0.22} fill={fill} />;
    case "horizontal-bars":
      return <rect x={x + 0.02} y={y + 0.27} width={0.96} height={0.46} rx={0.22} fill={fill} />;
    case "cross":
      return (
        <g fill={fill}>
          <rect x={x + 0.34} y={y + 0.05} width={0.32} height={0.9} rx={0.1} />
          <rect x={x + 0.05} y={y + 0.34} width={0.9} height={0.32} rx={0.1} />
        </g>
      );
    case "blob":
      return <rect x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.42} fill={fill} />;
    case "connected":
      return (
        <g fill={fill}>
          <rect x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.2} />
          {right ? <rect x={x + 0.5} y={y + 0.22} width={0.58} height={0.56} /> : null}
          {bottom ? <rect x={x + 0.22} y={y + 0.5} width={0.56} height={0.58} /> : null}
        </g>
      );
    default:
      return <rect x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} fill={fill} />;
  }
}

function EyeFrame({
  x,
  y,
  frame,
  center,
  frameColor,
  centerColor,
  backgroundColor,
}: {
  x: number;
  y: number;
  frame: QrEyeFrameShape;
  center: QrEyeCenterShape;
  frameColor: string;
  centerColor: string;
  backgroundColor: string;
}) {
  const outer = (() => {
    if (frame === "circle") return <circle cx={x + 3.5} cy={y + 3.5} r={3.5} fill={frameColor} />;
    if (frame === "octagon") return <polygon points={octagonPoints(x, y, 7)} fill={frameColor} />;
    if (frame === "diamond") return <polygon points={diamondPoints(x, y, 7)} fill={frameColor} />;
    return <rect x={x} y={y} width={7} height={7} rx={frame === "rounded" ? 1.45 : 0} fill={frameColor} />;
  })();

  const hole = (() => {
    if (frame === "circle") return <circle cx={x + 3.5} cy={y + 3.5} r={2.45} fill={backgroundColor} />;
    if (frame === "octagon") return <polygon points={octagonPoints(x + 1, y + 1, 5)} fill={backgroundColor} />;
    if (frame === "diamond") return <polygon points={diamondPoints(x + 1, y + 1, 5)} fill={backgroundColor} />;
    return <rect x={x + 1} y={y + 1} width={5} height={5} rx={frame === "rounded" ? 0.92 : 0} fill={backgroundColor} />;
  })();

  const centerNode = (() => {
    if (center === "circle") return <circle cx={x + 3.5} cy={y + 3.5} r={1.5} fill={centerColor} />;
    if (center === "diamond") return <polygon points={diamondPoints(x + 2, y + 2, 3)} fill={centerColor} />;
    if (center === "star") return <polygon points={starPoints(x + 3.5, y + 3.5, 1.65, 0.76)} fill={centerColor} />;
    return <rect x={x + 2} y={y + 2} width={3} height={3} rx={center === "rounded" ? 0.72 : 0} fill={centerColor} />;
  })();

  return <g>{outer}{hole}{centerNode}</g>;
}

export default function AdvancedQRPreview({
  url,
  qrShape = "square",
  bodyPattern = "square",
  eyeFrameShape = "square",
  eyeCenterShape = "square",
  colorMode = "solid",
  bodyColor = "#384862",
  gradientEndColor = "#ff7a1a",
  eyeFrameColor = "#384862",
  eyeCenterColor = "#384862",
  backgroundColor = "#ffffff",
  outerStrokeEnabled = false,
  outerStrokeColor = "#384862",
  logoUrl,
}: AdvancedQRPreviewProps) {
  const rawId = useId();
  const gradientId = `qr-gradient-${rawId.replace(/[^a-z0-9]/gi, "")}`;
  const matrix = useMemo(
    () => QRCode.create(url, { errorCorrectionLevel: "H" }).modules as unknown as Matrix,
    [url]
  );
  const quiet = 4;
  const total = matrix.size + quiet * 2;
  const circleScale = qrShape === "circle" ? 0.82 : 1;
  const offset = quiet + (matrix.size * (1 - circleScale)) / 2;
  const bodyFill =
    colorMode === "solid"
      ? bodyColor
      : colorMode === "radial"
        ? `url(#${gradientId}-radial)`
        : `url(#${gradientId})`;
  const modules: ReactNode[] = [];

  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (!moduleIsDark(matrix, row, col) || isFinderCell(row, col, matrix.size)) continue;
      modules.push(
        <BodyModule
          key={`${row}-${col}`}
          x={col}
          y={row}
          pattern={bodyPattern}
          fill={bodyFill}
          right={col + 1 < matrix.size && moduleIsDark(matrix, row, col + 1) && !isFinderCell(row, col + 1, matrix.size)}
          bottom={row + 1 < matrix.size && moduleIsDark(matrix, row + 1, col) && !isFinderCell(row + 1, col, matrix.size)}
        />
      );
    }
  }

  const backgroundInset = outerStrokeEnabled ? 0.8 : 0.25;
  const logoSize = Math.max(5, matrix.size * 0.2);
  const logoX = (matrix.size - logoSize) / 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="QR code preview"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bodyColor} />
          <stop offset="100%" stopColor={gradientEndColor} />
        </linearGradient>
        <radialGradient id={`${gradientId}-radial`} cx="50%" cy="50%" r="68%">
          <stop offset="0%" stopColor={gradientEndColor} />
          <stop offset="100%" stopColor={bodyColor} />
        </radialGradient>
      </defs>

      {qrShape === "circle" ? (
        <circle
          cx={total / 2}
          cy={total / 2}
          r={total / 2 - backgroundInset}
          fill={backgroundColor}
          stroke={outerStrokeEnabled ? outerStrokeColor : "none"}
          strokeWidth={outerStrokeEnabled ? 0.8 : 0}
        />
      ) : (
        <rect
          x={backgroundInset}
          y={backgroundInset}
          width={total - backgroundInset * 2}
          height={total - backgroundInset * 2}
          rx={1.1}
          fill={backgroundColor}
          stroke={outerStrokeEnabled ? outerStrokeColor : "none"}
          strokeWidth={outerStrokeEnabled ? 0.8 : 0}
        />
      )}

      <g transform={`translate(${offset} ${offset}) scale(${circleScale})`}>
        {modules}
        <EyeFrame x={0} y={0} frame={eyeFrameShape} center={eyeCenterShape} frameColor={eyeFrameColor} centerColor={eyeCenterColor} backgroundColor={backgroundColor} />
        <EyeFrame x={matrix.size - 7} y={0} frame={eyeFrameShape} center={eyeCenterShape} frameColor={eyeFrameColor} centerColor={eyeCenterColor} backgroundColor={backgroundColor} />
        <EyeFrame x={0} y={matrix.size - 7} frame={eyeFrameShape} center={eyeCenterShape} frameColor={eyeFrameColor} centerColor={eyeCenterColor} backgroundColor={backgroundColor} />

        {logoUrl ? (
          <g>
            <rect x={logoX - 0.45} y={logoX - 0.45} width={logoSize + 0.9} height={logoSize + 0.9} rx={1.05} fill={backgroundColor} />
            <image href={logoUrl} x={logoX} y={logoX} width={logoSize} height={logoSize} preserveAspectRatio="xMidYMid meet" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
