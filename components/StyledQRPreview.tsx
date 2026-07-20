"use client";

import AdvancedQRPreview from "@/components/AdvancedQRPreview";
import QRExportMenu from "@/components/QRExportMenu";
import type {
  QrBodyPattern,
  QrCanvasShape,
  QrColorMode,
  QrEyeCenterShape,
  QrEyeFrameShape,
} from "@/lib/qr-design";

type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type CornerStyle = "square" | "dot" | "extra-rounded";

type StyledQRPreviewProps = {
  url: string;
  foregroundColor?: string;
  backgroundColor?: string;
  dotStyle?: DotStyle;
  cornerStyle?: CornerStyle;
  logoUrl?: string | null;
  showExportMenu?: boolean;
  embedded?: boolean;
  qrShape?: QrCanvasShape;
  bodyPattern?: QrBodyPattern;
  eyeFrameShape?: QrEyeFrameShape;
  eyeCenterShape?: QrEyeCenterShape;
  colorMode?: QrColorMode;
  gradientEndColor?: string;
  eyeFrameColor?: string;
  eyeCenterColor?: string;
  outerStrokeEnabled?: boolean;
  outerStrokeColor?: string;
};

function bodyPatternFromLegacy(dotStyle: DotStyle): QrBodyPattern {
  if (dotStyle === "dots") return "circle";
  if (dotStyle === "rounded" || dotStyle === "classy" || dotStyle === "classy-rounded" || dotStyle === "extra-rounded") return "rounded";
  return "square";
}

function eyeFrameFromLegacy(cornerStyle: CornerStyle): QrEyeFrameShape {
  if (cornerStyle === "dot") return "circle";
  if (cornerStyle === "extra-rounded") return "rounded";
  return "square";
}

export default function StyledQRPreview({
  url,
  foregroundColor = "#384862",
  backgroundColor = "#ffffff",
  dotStyle = "square",
  cornerStyle = "square",
  logoUrl,
  showExportMenu = true,
  embedded = false,
  qrShape = "square",
  bodyPattern,
  eyeFrameShape,
  eyeCenterShape = "square",
  colorMode = "solid",
  gradientEndColor = "#ff7a1a",
  eyeFrameColor,
  eyeCenterColor,
  outerStrokeEnabled = false,
  outerStrokeColor = "#384862",
}: StyledQRPreviewProps) {
  const exportSlug = url.split(/[?#]/)[0].split("/").filter(Boolean).pop();
  const centeredWrapperStyle = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    marginInline: "auto",
    boxSizing: "border-box" as const,
    display: "grid",
    placeItems: "center",
  };

  return (
    <div
      className={`styled-qr-wrap${embedded ? " embedded" : ""}`}
      style={centeredWrapperStyle}
    >
      <div
        className={`qr-preview${embedded ? " embedded" : ""}`}
        style={{
          ...centeredWrapperStyle,
          minHeight: 0,
          height: "auto",
          aspectRatio: "1 / 1",
        }}
      >
        <AdvancedQRPreview
          url={url}
          qrShape={qrShape}
          bodyPattern={bodyPattern || bodyPatternFromLegacy(dotStyle)}
          eyeFrameShape={eyeFrameShape || eyeFrameFromLegacy(cornerStyle)}
          eyeCenterShape={eyeCenterShape}
          colorMode={colorMode}
          bodyColor={foregroundColor}
          gradientEndColor={gradientEndColor}
          eyeFrameColor={eyeFrameColor || foregroundColor}
          eyeCenterColor={eyeCenterColor || foregroundColor}
          backgroundColor={backgroundColor}
          outerStrokeEnabled={outerStrokeEnabled}
          outerStrokeColor={outerStrokeColor}
          logoUrl={logoUrl}
        />
      </div>
      {showExportMenu && exportSlug ? <QRExportMenu slug={exportSlug} /> : null}
    </div>
  );
}
