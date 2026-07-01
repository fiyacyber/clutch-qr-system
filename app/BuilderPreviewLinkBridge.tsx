"use client";

import { useEffect } from "react";

function resolveProfileUrl(slug: string) {
  const cleanSlug = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (!cleanSlug) return null;

  const explicitBase = process.env.NEXT_PUBLIC_CLUTCH_CONNECT_PUBLIC_BASE_URL;
  const fallbackBase = process.env.NEXT_PUBLIC_CLUTCH_QR_BASE_URL || window.location.origin;
  const base = (explicitBase || fallbackBase).replace(/\/+$/, "");
  const path = explicitBase ? encodeURIComponent(cleanSlug) : `u/${encodeURIComponent(cleanSlug)}`;

  return `${base}/${path}`;
}

function isBuilderPreviewButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const button = target.closest("button");
  if (!button) return false;

  const label = (button.textContent || "").trim().toLowerCase();
  if (label !== "preview") return false;

  return Boolean(button.closest(".saas-builder"));
}

export default function BuilderPreviewLinkBridge() {
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      if (!window.location.pathname.includes("/portal/connect/build")) return;
      if (!isBuilderPreviewButton(event.target)) return;

      event.preventDefault();
      event.stopPropagation();

      const popup = window.open("about:blank", "_blank", "noopener,noreferrer");

      try {
        const response = await fetch("/api/connect/builder-config", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        const url = resolveProfileUrl(payload?.profile?.slug);

        if (!response.ok || !url) {
          throw new Error(payload?.error || "Profile preview is not available yet.");
        }

        if (popup) {
          popup.location.href = url;
        } else {
          window.location.href = url;
        }
      } catch {
        if (popup) {
          popup.close();
        }
        window.location.href = "/portal/connect";
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
