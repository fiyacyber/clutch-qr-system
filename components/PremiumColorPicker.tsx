"use client";

import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./PremiumColorPicker.module.css";

type HSV = { h: number; s: number; v: number };

const BRAND_PRESETS = ["#FF7A1A", "#384862", "#0B1F35", "#F5F7FB", "#FFF1E7"];
const RECENT_STORAGE_KEY = "clutch-color-picker-recents";
const SAVED_STORAGE_KEY = "clutch-color-picker-saved";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toHexByte(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function normalizeHex(input: string) {
  const value = String(input || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value
      .split("")
      .map((char) => char + char)
      .join("")
      .toUpperCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    return `#${value.toUpperCase()}`;
  }

  return null;
}

function coerceHexDraft(input: string) {
  const raw = String(input || "").replace(/[^#0-9a-fA-F]/g, "");
  const withoutHash = raw.replace(/#/g, "").slice(0, 6).toUpperCase();
  return `#${withoutHash}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex) || "#000000";
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): HSV {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
  }

  if (hue < 0) hue += 360;
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number) {
  const hue = ((h % 360) + 360) % 360;
  const sector = Math.floor(hue / 60);
  const fraction = hue / 60 - sector;
  const p = v * (1 - s);
  const q = v * (1 - fraction * s);
  const t = v * (1 - (1 - fraction) * s);

  let red = v;
  let green = t;
  let blue = p;

  switch (sector) {
    case 0:
      red = v;
      green = t;
      blue = p;
      break;
    case 1:
      red = q;
      green = v;
      blue = p;
      break;
    case 2:
      red = p;
      green = v;
      blue = t;
      break;
    case 3:
      red = p;
      green = q;
      blue = v;
      break;
    case 4:
      red = t;
      green = p;
      blue = v;
      break;
    default:
      red = v;
      green = p;
      blue = q;
      break;
  }

  return {
    r: Math.round(red * 255),
    g: Math.round(green * 255),
    b: Math.round(blue * 255),
  };
}

function hsvToHex(h: number, s: number, v: number) {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function getReadableTextColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#f8fafc";
}

function readStorageList(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [] as string[];
  }
}

function writeStorageList(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values.slice(0, 24)));
  } catch {
    // Storage is optional. The picker still works without it.
  }
}

function compactRecentColors(values: string[], limit = 8) {
  const compacted: string[] = [];

  for (const value of values) {
    const normalized = normalizeHex(value);
    if (!normalized) continue;

    const nextRgb = hexToRgb(normalized);
    const isDuplicateOrNearDuplicate = compacted.some((existing) => {
      const existingRgb = hexToRgb(existing);
      const redDelta = nextRgb.r - existingRgb.r;
      const greenDelta = nextRgb.g - existingRgb.g;
      const blueDelta = nextRgb.b - existingRgb.b;
      return Math.sqrt(redDelta ** 2 + greenDelta ** 2 + blueDelta ** 2) <= 10;
    });

    if (!isDuplicateOrNearDuplicate) compacted.push(normalized);
    if (compacted.length >= limit) break;
  }

  return compacted;
}

function modelFromHex(value: string) {
  const normalized = normalizeHex(value) || "#FFA665";
  const rgb = hexToRgb(normalized);
  return { normalized, rgb, hsv: rgbToHsv(rgb.r, rgb.g, rgb.b) };
}

interface PremiumColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  triggerClassName?: string;
  valueClassName?: string;
  buttonText?: string;
  disabled?: boolean;
  presets?: string[];
  storageKey?: string;
  name?: string;
}

export default function PremiumColorPicker({
  value,
  onChange,
  ariaLabel,
  className,
  triggerClassName,
  valueClassName,
  buttonText = "Pick color",
  disabled,
  presets = BRAND_PRESETS,
  storageKey = RECENT_STORAGE_KEY,
  name,
}: PremiumColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [savedColors, setSavedColors] = useState<string[]>([]);
  const [hexText, setHexText] = useState("");
  const [rgbText, setRgbText] = useState({ r: "", g: "", b: "" });
  const [hsv, setHsv] = useState<HSV>({ h: 24, s: 0.6, v: 1 });
  const [isMounted, setIsMounted] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentColorRef = useRef(modelFromHex(value).normalized);
  const hasUncommittedRecentRef = useRef(false);

  const { normalized } = modelFromHex(value);
  const textColor = useMemo(() => getReadableTextColor(normalized), [normalized]);

  const syncLocalState = (nextHex: string) => {
    const model = modelFromHex(nextHex);
    setHexText(model.normalized);
    setRgbText({ r: String(model.rgb.r), g: String(model.rgb.g), b: String(model.rgb.b) });
    setHsv(model.hsv);
    return model.normalized;
  };

  const rememberRecentColor = (color = currentColorRef.current) => {
    const cleanHex = normalizeHex(color);
    if (!cleanHex) return;

    setRecents((current) => {
      const stored = readStorageList(storageKey);
      const next = compactRecentColors([cleanHex, ...current, ...stored]);
      writeStorageList(storageKey, next);
      return next;
    });
  };

  const applyColor = (nextColor: string) => {
    const nextHex = normalizeHex(nextColor);
    if (!nextHex) return null;

    const cleanHex = syncLocalState(nextHex);
    if (cleanHex !== currentColorRef.current) hasUncommittedRecentRef.current = true;
    currentColorRef.current = cleanHex;
    onChange(cleanHex);
    return cleanHex;
  };

  const finalizeCurrentColor = () => {
    if (!hasUncommittedRecentRef.current) return;
    rememberRecentColor(currentColorRef.current);
    hasUncommittedRecentRef.current = false;
  };

  const selectColor = (nextColor: string) => {
    const cleanHex = applyColor(nextColor);
    if (!cleanHex) return;
    rememberRecentColor(cleanHex);
    hasUncommittedRecentRef.current = false;
  };

  const closePicker = () => {
    finalizeCurrentColor();
    setOpen(false);
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const nextModel = modelFromHex(value);
    setHexText(nextModel.normalized);
    setRgbText({ r: String(nextModel.rgb.r), g: String(nextModel.rgb.g), b: String(nextModel.rgb.b) });
    setHsv(nextModel.hsv);
    currentColorRef.current = nextModel.normalized;
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const nextRecents = compactRecentColors(readStorageList(storageKey));
    setRecents(nextRecents);
    writeStorageList(storageKey, nextRecents);
    setSavedColors(compactRecentColors(readStorageList(SAVED_STORAGE_KEY), 12));
  }, [open, storageKey]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePicker();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = window.innerWidth <= 560 ? 8 : 12;
      const preferredWidth = window.innerWidth <= 560 ? 360 : 540;
      const width = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2);
      const maxHeight = Math.min(window.innerHeight - viewportPadding * 2, window.innerWidth <= 560 ? 560 : 640);
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
      const availableAbove = rect.top - viewportPadding;
      const placeAbove = availableBelow < Math.min(420, maxHeight) && availableAbove > availableBelow;
      const left = clamp(rect.left, viewportPadding, Math.max(viewportPadding, window.innerWidth - width - viewportPadding));

      const nextStyle: CSSProperties = {
        left,
        width,
        maxHeight,
        visibility: "visible",
      };

      if (placeAbove) nextStyle.bottom = window.innerHeight - rect.top + 8;
      else nextStyle.top = rect.bottom + 8;

      setPopoverStyle(nextStyle);
    };

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open]);

  const updateFromHsv = (nextHsv: HSV) => {
    const safeHsv = {
      h: ((nextHsv.h % 360) + 360) % 360,
      s: clamp(nextHsv.s, 0, 1),
      v: clamp(nextHsv.v, 0, 1),
    };
    const nextHex = hsvToHex(safeHsv.h, safeHsv.s, safeHsv.v);
    setHsv(safeHsv);
    setHexText(nextHex);
    const nextRgb = hexToRgb(nextHex);
    setRgbText({ r: String(nextRgb.r), g: String(nextRgb.g), b: String(nextRgb.b) });
    applyColor(nextHex);
  };

  const updateFromHex = (nextValue: string) => {
    const draft = coerceHexDraft(nextValue);
    setHexText(draft);
    const nextHex = normalizeHex(nextValue);
    if (nextHex) applyColor(nextHex);
  };

  const updateFromRgb = (channel: "r" | "g" | "b", nextValue: string) => {
    const numeric = clamp(Number(nextValue || 0), 0, 255);
    const nextRgb = {
      r: Number(channel === "r" ? numeric : rgbText.r || 0),
      g: Number(channel === "g" ? numeric : rgbText.g || 0),
      b: Number(channel === "b" ? numeric : rgbText.b || 0),
    };
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setRgbText({ r: String(nextRgb.r), g: String(nextRgb.g), b: String(nextRgb.b) });
    setHexText(nextHex);
    setHsv(rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b));
    applyColor(nextHex);
  };

  const saveCustomColor = () => {
    const nextHex = normalizeHex(hexText) || normalized;
    selectColor(nextHex);

    setSavedColors((current) => {
      const stored = readStorageList(SAVED_STORAGE_KEY);
      const next = compactRecentColors([nextHex, ...current, ...stored], 12);
      writeStorageList(SAVED_STORAGE_KEY, next);
      return next;
    });
  };

  const handleWheelPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const saturation = clamp(distance / radius, 0, 1);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const brightness = hsv.v < 0.12 ? 0.9 : hsv.v;

    updateFromHsv({ h: hue, s: saturation, v: brightness });
  };

  const markerX = 50 + Math.cos((hsv.h * Math.PI) / 180) * Math.min(50, hsv.s * 50);
  const markerY = 50 + Math.sin((hsv.h * Math.PI) / 180) * Math.min(50, hsv.s * 50);
  const wheelBackground = `
    radial-gradient(circle at center, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.72) 10%, rgba(255,255,255,0) 48%),
    conic-gradient(from 0deg, #ff004c, #ff8a00, #fff000, #00d46a, #00d7ff, #2f55ff, #aa00ff, #ff004c)
  `;

  return (
    <div className={`${styles.root}${className ? ` ${className}` : ""}`.trim()}>
      {name ? <input type="hidden" name={name} value={normalized} /> : null}
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger}${triggerClassName ? ` ${triggerClassName}` : ""}`.trim()}
        onClick={() => {
          if (disabled) return;
          if (open) closePicker();
          else {
            hasUncommittedRecentRef.current = false;
            currentColorRef.current = normalized;
            setOpen(true);
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={styles.triggerSwatch} style={{ background: normalized }} />
        <span className={styles.triggerLabel}>{buttonText}</span>
      </button>

      <input
        type="text"
        className={`${styles.valueChip}${valueClassName ? ` ${valueClassName}` : ""}`.trim()}
        style={{ background: normalized, color: textColor }}
        value={hexText}
        onChange={(event) => updateFromHex(event.target.value)}
        onBlur={(event) => selectColor(normalizeHex(event.target.value) || normalized)}
        onKeyDown={(event) => {
          const target = event.target as HTMLInputElement;
          if (
            (event.key === "Backspace" || event.key === "Delete") &&
            target.selectionStart !== null &&
            target.selectionStart <= 1 &&
            target.selectionEnd !== null &&
            target.selectionEnd <= 1
          ) {
            event.preventDefault();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            selectColor(normalizeHex(target.value) || normalized);
            target.blur();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          updateFromHex(event.clipboardData.getData("text"));
        }}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={`${ariaLabel} hex value`}
        placeholder="#FFFFFF"
        spellCheck={false}
      />

      {open && isMounted
        ? createPortal(
            <div className={styles.overlay} role="presentation" onMouseDown={closePicker}>
              <div
                className={styles.modal}
                role="dialog"
                aria-label={ariaLabel}
                style={popoverStyle}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={styles.header}>
                  <div>
                    <p className={styles.kicker}>Color Studio</p>
                    <h3 className={styles.title}>{ariaLabel}</h3>
                  </div>
                  <button type="button" className={styles.closeBtn} onClick={closePicker} aria-label="Close color picker">
                    ✕
                  </button>
                </div>

                <div className={styles.body}>
                  <div className={styles.wheelColumn}>
                    <div
                      className={styles.wheelWrap}
                      style={{ background: wheelBackground }}
                      onPointerDown={handleWheelPointer}
                      onPointerMove={(event) => event.buttons === 1 && handleWheelPointer(event)}
                      onPointerUp={finalizeCurrentColor}
                      onPointerCancel={finalizeCurrentColor}
                      role="application"
                      aria-label={`${ariaLabel} hue and saturation`}
                    >
                      <div
                        className={styles.marker}
                        style={{ left: `${markerX}%`, top: `${markerY}%`, background: normalized }}
                      />
                    </div>

                    <label className={styles.sliderRow}>
                      <span>Brightness</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={hsv.v}
                        onChange={(event) => updateFromHsv({ ...hsv, v: Number(event.target.value) })}
                        onPointerUp={finalizeCurrentColor}
                        onKeyUp={finalizeCurrentColor}
                        onBlur={finalizeCurrentColor}
                      />
                    </label>
                  </div>

                  <div className={styles.controlsColumn}>
                    <div className={styles.previewCard} style={{ background: normalized }}>
                      <span className={styles.previewLabel} style={{ color: textColor }}>
                        {normalized}
                      </span>
                    </div>

                    <div className={styles.grid}>
                      <label className={styles.inputGroup}>
                        <span>HEX</span>
                        <input
                          type="text"
                          value={hexText}
                          onChange={(event) => updateFromHex(event.target.value)}
                          onBlur={(event) => selectColor(normalizeHex(event.target.value) || normalized)}
                          onKeyDown={(event) => {
                            const target = event.target as HTMLInputElement;
                            if (
                              (event.key === "Backspace" || event.key === "Delete") &&
                              target.selectionStart !== null &&
                              target.selectionStart <= 1 &&
                              target.selectionEnd !== null &&
                              target.selectionEnd <= 1
                            ) {
                              event.preventDefault();
                              return;
                            }
                            if (event.key === "Enter") {
                              event.preventDefault();
                              selectColor(normalizeHex(target.value) || normalized);
                              target.blur();
                            }
                          }}
                          onPaste={(event) => {
                            event.preventDefault();
                            updateFromHex(event.clipboardData.getData("text"));
                          }}
                          placeholder="#FFFFFF"
                        />
                      </label>

                      <div className={styles.rgbGrid}>
                        {(["r", "g", "b"] as const).map((channel) => (
                          <label key={channel} className={styles.inputGroup}>
                            <span>{channel.toUpperCase()}</span>
                            <input
                              type="number"
                              min="0"
                              max="255"
                              value={rgbText[channel]}
                              onChange={(event) => updateFromRgb(channel, event.target.value)}
                              onBlur={finalizeCurrentColor}
                              onKeyUp={(event) => event.key === "Enter" && finalizeCurrentColor()}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {presets.length > 0 ? (
                      <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                          <span>Brand presets</span>
                        </div>
                        <div className={styles.swatchRow}>
                          {presets.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={styles.swatchButton}
                              onClick={() => selectColor(preset)}
                              aria-label={`Use preset ${preset}`}
                            >
                              <span className={styles.swatch} style={{ background: preset }} />
                              <span>{preset}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span>Recent colors</span>
                      </div>
                      <div className={styles.swatchRow}>
                        {recents.length > 0 ? (
                          recents.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={styles.swatchButton}
                              onClick={() => selectColor(color)}
                              aria-label={`Use recent color ${color}`}
                            >
                              <span className={styles.swatch} style={{ background: color }} />
                              <span>{color}</span>
                            </button>
                          ))
                        ) : (
                          <p className={styles.emptyState}>Recent colors appear after you finish selecting a color.</p>
                        )}
                      </div>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span>Saved custom colors</span>
                        <button type="button" className={styles.secondaryBtn} onClick={saveCustomColor}>
                          Save current
                        </button>
                      </div>
                      <div className={styles.swatchRow}>
                        {savedColors.length > 0 ? (
                          savedColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={styles.swatchButton}
                              onClick={() => selectColor(color)}
                              aria-label={`Use saved color ${color}`}
                            >
                              <span className={styles.swatch} style={{ background: color }} />
                              <span>{color}</span>
                            </button>
                          ))
                        ) : (
                          <p className={styles.emptyState}>Save a custom color to keep it handy for this browser.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
