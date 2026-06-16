"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

type StyledQRPreviewProps = {
  url: string;
  foregroundColor?: string;
  backgroundColor?: string;
  dotStyle?: "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
  cornerStyle?: "square" | "dot" | "extra-rounded";
  logoEnabled?: boolean;
};

export default function StyledQRPreview({
  url,
  foregroundColor = "#384862",
  backgroundColor = "#ffffff",
  dotStyle = "square",
  cornerStyle = "square",
  logoEnabled = false,
}: StyledQRPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    ref.current.innerHTML = "";

    qrRef.current = new QRCodeStyling({
      width: 220,
      height: 220,
      type: "svg",
      data: url,
      image: logoEnabled ? "/clutch-logo.png" : undefined,
      margin: 8,
      qrOptions: {
        errorCorrectionLevel: "H",
      },
      dotsOptions: {
        color: foregroundColor,
        type: dotStyle,
      },
      backgroundOptions: {
        color: backgroundColor,
      },
      cornersSquareOptions: {
        color: foregroundColor,
        type: cornerStyle,
      },
      cornersDotOptions: {
        color: foregroundColor,
        type: cornerStyle === "square" ? "square" : "dot",
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 6,
        imageSize: 0.28,
      },
    });

    qrRef.current.append(ref.current);
  }, [url, foregroundColor, backgroundColor, dotStyle, cornerStyle, logoEnabled]);

  return <div className="qr-preview" ref={ref} />;
}
