"use client";

import { useEffect, useRef } from "react";

type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

type CornerStyle = "square" | "dot" | "extra-rounded";

type StyledQRPreviewProps = {
  url: string;
  foregroundColor?: string;
  backgroundColor?: string;
  dotStyle?: DotStyle;
  cornerStyle?: CornerStyle;
};

export default function StyledQRPreview({
  url,
  foregroundColor = "#384862",
  backgroundColor = "#ffffff",
  dotStyle = "square",
  cornerStyle = "square",
}: StyledQRPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const container = ref.current;

    if (!container) return;

    container.innerHTML = "";

    async function renderQr() {
      const QRCodeStyling = (await import("qr-code-styling")).default;

      if (!isMounted || !container) return;

      container.innerHTML = "";

      const qrCode = new QRCodeStyling({
        width: 220,
        height: 220,
        type: "svg",
        data: url,
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
      });

      qrCode.append(container);
    }

    renderQr();

    return () => {
      isMounted = false;
      container.innerHTML = "";
    };
  }, [url, foregroundColor, backgroundColor, dotStyle, cornerStyle]);

  return <div className="qr-preview" ref={ref} />;
}
