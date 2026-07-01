"use client";

import { useMemo } from "react";
import { BUILDER_FONT_OPTIONS, resolveBuilderFontFamily } from "@/lib/font-catalog";

interface FontFamilyPickerProps {
  value: string;
  onChange: (value: string) => void;
  allowInherit?: boolean;
  inheritLabel?: string;
}

function recommendedWeightForFont(value: string) {
  if (["display", "poster"].includes(value)) return "900";
  if (["condensed", "narrow", "geometric", "grotesk", "neo-grotesk"].includes(value)) return "800";
  if (["serif", "editorial", "elegant", "luxury", "newspaper", "slab", "slab-alt", "book", "modern-serif"].includes(value)) return "700";
  if (["signature"].includes(value)) return "500";
  if (["mono", "ui-mono", "tech"].includes(value)) return "700";
  if (value === "inherit") return "700";
  return "700";
}

export default function FontFamilyPicker({
  value,
  onChange,
  allowInherit = false,
  inheritLabel = "Theme default",
}: FontFamilyPickerProps) {
  const options = useMemo(() => {
    const base = BUILDER_FONT_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      keywords: option.keywords,
    }));

    if (allowInherit) {
      return [{ value: "inherit", label: inheritLabel, keywords: "Uses the profile template font" }, ...base];
    }

    return base;
  }, [allowInherit, inheritLabel]);

  const selectedOption = options.find((option) => option.value === value) || options[0];
  const selectedFontFamily = selectedOption?.value === "inherit" ? undefined : resolveBuilderFontFamily(selectedOption?.value);

  return (
    <div className="saas-font-picker saas-font-picker-simple">
      <label className="saas-font-select-wrap">
        <span className="saas-font-select-label">Font</span>
        <select
          className="saas-font-select"
          data-clutch-font-select="true"
          data-recommended-weight={recommendedWeightForFont(selectedOption?.value || "inherit")}
          value={selectedOption?.value || "inherit"}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Choose font family"
          style={{ fontFamily: selectedFontFamily }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} data-recommended-weight={recommendedWeightForFont(option.value)}>
              {option.label} — {option.keywords}
            </option>
          ))}
        </select>
      </label>

      <div className="saas-font-picker-selected saas-font-picker-selected-simple" aria-live="polite">
        <span className="saas-font-picker-selected-label">Selected</span>
        <span className="saas-font-picker-selected-value" style={{ fontFamily: selectedFontFamily }}>
          {selectedOption?.label || inheritLabel}
        </span>
      </div>
    </div>
  );
}
