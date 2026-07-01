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

function dispatchReactChange(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function findFontWeightSelect(fontSelect: HTMLSelectElement) {
  const panel = fontSelect.closest(".builder-selected-section-panel");
  if (!panel) return null;

  const selects = Array.from(panel.querySelectorAll("select")) as HTMLSelectElement[];
  return selects.find((select) => {
    const values = Array.from(select.options).map((option) => option.value);
    return ["500", "600", "700", "800", "900"].every((value) => values.includes(value));
  }) || null;
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

    const handleFontChange = (event: Event) => {
      if (!window.location.pathname.includes("/portal/connect/build")) return;
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (target.dataset.clutchFontSelect !== "true") return;

      const selectedOption = target.selectedOptions?.[0];
      const recommendedWeight = selectedOption?.dataset.recommendedWeight || target.dataset.recommendedWeight;
      if (!recommendedWeight) return;

      const weightSelect = findFontWeightSelect(target);
      if (!weightSelect || weightSelect.value === recommendedWeight) return;

      dispatchReactChange(weightSelect, recommendedWeight);
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("change", handleFontChange, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("change", handleFontChange, true);
    };
  }, []);

  return null;
}
