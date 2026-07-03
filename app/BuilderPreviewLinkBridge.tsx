"use client";

import { useEffect } from "react";

function resolveProfileUrl(slug: string) {
  const cleanSlug = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (!cleanSlug) return null;

  const base = (process.env.NEXT_PUBLIC_CLUTCH_CONNECT_PUBLIC_BASE_URL || "https://clutchconnect.link").replace(/\/+$/, "");
  const path = `u/${encodeURIComponent(cleanSlug)}`;

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

function setRangeMax(input: HTMLInputElement, max: number) {
  const currentMax = Number(input.max || 0);
  if (!Number.isFinite(currentMax) || currentMax >= max) return;
  input.max = String(max);
  input.dataset.clutchExpandedMax = String(max);
}

function labelForRange(input: HTMLInputElement) {
  const field = input.closest(".saas-field");
  return (field?.textContent || "").toLowerCase();
}

function expandBuilderRangeLimits(root: ParentNode = document) {
  if (!window.location.pathname.includes("/portal/connect/build")) return;

  const ranges = Array.from(root.querySelectorAll('input[type="range"]')) as HTMLInputElement[];
  for (const input of ranges) {
    const label = labelForRange(input);

    if (label.includes("border width")) setRangeMax(input, 24);
    if (label.includes("avatar") && label.includes("border width")) setRangeMax(input, 32);
    if (label.includes("font size")) setRangeMax(input, 72);
    if (label.includes("letter spacing")) setRangeMax(input, 16);
    if (label.includes("padding x")) setRangeMax(input, 96);
    if (label.includes("padding y")) setRangeMax(input, 72);
    if (label.includes("margin top") || label.includes("margin bottom")) setRangeMax(input, 120);
    if (label.includes("glow blur")) setRangeMax(input, 120);
    if (label.includes("glow spread")) setRangeMax(input, 96);
    if (label.includes("badge size")) setRangeMax(input, 72);
    if (label.includes("banner height")) setRangeMax(input, 420);
  }
}

function stabilizePreviewToolbars(root: ParentNode = document) {
  if (!window.location.pathname.includes("/portal/connect/build")) return;

  const toolbars = Array.from(root.querySelectorAll(".builder-preview-toolbar"));
  for (const toolbar of toolbars) {
    toolbar.removeAttribute("aria-hidden");
  }
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

    expandBuilderRangeLimits();
    stabilizePreviewToolbars();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element || node instanceof DocumentFragment) {
            expandBuilderRangeLimits(node);
            stabilizePreviewToolbars(node);
          }
        });
      }
      expandBuilderRangeLimits();
      stabilizePreviewToolbars();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", handleClick, true);
    document.addEventListener("change", handleFontChange, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("change", handleFontChange, true);
    };
  }, []);

  return null;
}
