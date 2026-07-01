"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { BUILDER_FONT_OPTIONS, resolveBuilderFontFamily } from "@/lib/font-catalog";

interface FontFamilyPickerProps {
  value: string;
  onChange: (value: string) => void;
  allowInherit?: boolean;
  inheritLabel?: string;
}

export default function FontFamilyPicker({
  value,
  onChange,
  allowInherit = false,
  inheritLabel = "Theme default",
}: FontFamilyPickerProps) {
  const [query, setQuery] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const PREVIEW_FONT_COUNT = 6;

  const options = useMemo(() => {
    const base = BUILDER_FONT_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      keywords: option.keywords,
    }));

    if (allowInherit) {
      return [{ value: "inherit", label: inheritLabel, keywords: "default theme" }, ...base];
    }

    return base;
  }, [allowInherit, inheritLabel]);

  const previewOptions = useMemo(() => options.slice(0, PREVIEW_FONT_COUNT), [options]);
  const moreOptions = useMemo(() => options.slice(PREVIEW_FONT_COUNT), [options]);

  const queryLower = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!queryLower) return options;
    return options.filter((option) => `${option.label} ${option.value} ${option.keywords}`.toLowerCase().includes(queryLower));
  }, [options, queryLower]);

  const filteredPreviewOptions = useMemo(
    () => filteredOptions.filter((option) => previewOptions.some((previewOption) => previewOption.value === option.value)),
    [filteredOptions, previewOptions]
  );

  const filteredMoreOptions = useMemo(
    () => filteredOptions.filter((option) => moreOptions.some((moreOption) => moreOption.value === option.value)),
    [filteredOptions, moreOptions]
  );

  const showCollapsedHint = !queryLower && !previewOpen && !moreOpen;

  const selectedOption = useMemo(() => options.find((option) => option.value === value) || options[0], [options, value]);

  const handleSelect = (nextValue: string, collapseMore = false) => {
    onChange(nextValue);
    if (collapseMore) {
      setMoreOpen(false);
    }
  };

  useEffect(() => {
    if (!queryLower) return;
    setPreviewOpen(filteredPreviewOptions.length > 0);
    setMoreOpen(filteredMoreOptions.length > 0);
  }, [queryLower, filteredPreviewOptions.length, filteredMoreOptions.length]);

  const renderFontOption = (option: { value: string; label: string; keywords: string }, collapseMore = false) => {
    const isActive = option.value === value;
    const previewFontFamily = option.value === "inherit" ? undefined : resolveBuilderFontFamily(option.value);

    return (
      <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={isActive}
        className={`saas-font-option${isActive ? " is-active" : ""}`}
        onClick={() => handleSelect(option.value, collapseMore)}
      >
        <span className="saas-font-option-copy">
          <span className="saas-font-option-label">{option.label}</span>
          <span className="saas-font-option-keywords">{option.keywords}</span>
        </span>
        <span className="saas-font-option-preview" style={{ fontFamily: previewFontFamily }}>
          Aa
        </span>
        {isActive ? <Check size={16} className="saas-font-option-check" aria-hidden="true" /> : null}
      </button>
    );
  };

  return (
    <div className="saas-font-picker">
      <div className="saas-font-picker-topbar">
        <label className="saas-font-search-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            className="saas-font-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fonts"
            aria-label="Search font families"
          />
          {query ? (
            <button type="button" className="saas-font-search-clear" onClick={() => setQuery("")} aria-label="Clear font search">
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <p className="saas-font-picker-count">{queryLower ? `${filteredOptions.length} matches` : `${previewOptions.length} preview fonts`}</p>
      </div>

      <div className="saas-font-picker-selected" aria-live="polite">
        <span className="saas-font-picker-selected-label">Selected</span>
        <span className="saas-font-picker-selected-value" style={{ fontFamily: selectedOption?.value === "inherit" ? undefined : resolveBuilderFontFamily(selectedOption?.value) }}>
          {selectedOption?.label || inheritLabel}
        </span>
      </div>

      <details
        className="saas-font-picker-section saas-font-picker-preview"
        open={previewOpen}
        onToggle={(event) => setPreviewOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <span>Preview fonts</span>
          <span>{queryLower ? filteredPreviewOptions.length : previewOptions.length}</span>
        </summary>
        <div className="saas-font-picker-grid" role="listbox" aria-label="Preview font families">
          {(queryLower ? filteredPreviewOptions : previewOptions).map((option) => renderFontOption(option))}
        </div>
      </details>

      <details
        className="saas-font-picker-section saas-font-picker-more"
        open={moreOpen}
        onToggle={(event) => setMoreOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <span>More fonts</span>
          <span>{queryLower ? filteredMoreOptions.length : moreOptions.length}</span>
        </summary>
        <div className="saas-font-picker-grid saas-font-picker-grid-more" role="listbox" aria-label="More font families">
          {(queryLower ? filteredMoreOptions : moreOptions).map((option) => renderFontOption(option, true))}
        </div>
      </details>

      {showCollapsedHint ? <p className="saas-field-hint">Expand Preview fonts or More fonts to choose a font.</p> : null}

      {queryLower && filteredOptions.length === 0 ? <p className="saas-field-hint">No fonts match that search.</p> : null}
    </div>
  );
}
