"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const value = input.trim().replace(/^#/, "");
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

  const saturation = max === 0 ? 0 : delta / max;
  return { h: hue, s: saturation, v: max };
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
    // noop
  }
}

function useColorModel(value: string) {
  const normalized = normalizeHex(value) || "#FFA665";
  const rgb = hexToRgb(normalized);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  return { normalized, rgb, hsv };
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [savedColors, setSavedColors] = useState<string[]>([]);
  const [hexText, setHexText] = useState("");
  const [rgbText, setRgbText] = useState({ r: "", g: "", b: "" });
  const [hsv, setHsv] = useState<HSV>({ h: 0, s: 0, v: 1 });
  const [isMounted, setIsMounted] = useState(false);

  const { normalized, rgb } = useColorModel(value);
  const textColor = useMemo(() => getReadableTextColor(normalized), [normalized]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setHexText(normalized);
    setRgbText({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
  }, [normalized, rgb.r, rgb.g, rgb.b]);

  useEffect(() => {
    if (!open) return;
    setRecents(readStorageList(storageKey));
    setSavedColors(readStorageList(SAVED_STORAGE_KEY));
  }, [open, storageKey]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const commitColor = (nextColor: string) => {
    const nextHex = normalizeHex(nextColor);
    if (!nextHex) return;

    onChange(nextHex);

    setRecents((current) => {
      const next = [nextHex, ...current.filter((item) => item !== nextHex)].slice(0, 8);
      writeStorageList(storageKey, next);
      return next;
    });
  };

  const updateFromHsv = (nextHsv: HSV) => {
    setHsv({
      h: ((nextHsv.h % 360) + 360) % 360,
      s: clamp(nextHsv.s, 0, 1),
      v: clamp(nextHsv.v, 0, 1),
    });
    const nextHex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
    commitColor(nextHex);
  };

  const updateFromHex = (nextValue: string) => {
    setHexText(nextValue);
    const nextHex = normalizeHex(nextValue);
    if (!nextHex) return;
    const nextRgb = hexToRgb(nextHex);
    setRgbText({ r: String(nextRgb.r), g: String(nextRgb.g), b: String(nextRgb.b) });
    setHsv(rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b));
    commitColor(nextHex);
  };

  const updateFromRgb = (channel: "r" | "g" | "b", nextValue: string) => {
    const numeric = clamp(Number(nextValue || 0), 0, 255);
    const nextRgb = {
      r: Number(channel === "r" ? numeric : rgbText.r),
      g: Number(channel === "g" ? numeric : rgbText.g),
      b: Number(channel === "b" ? numeric : rgbText.b),
    };
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setRgbText({
      r: String(nextRgb.r),
      g: String(nextRgb.g),
      b: String(nextRgb.b),
    });
    setHexText(nextHex);
    setHsv(rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b));
    commitColor(nextHex);
  };

  const saveCustomColor = () => {
    setSavedColors((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(0, 12);
      writeStorageList(SAVED_STORAGE_KEY, next);
      return next;
    });
  };

  const drawWheel = () => {
    const canvas = canvasRef.current;
    const wheel = wheelRef.current;
    if (!canvas || !wheel) return;

    const rect = wheel.getBoundingClientRect();
    const measuredSize = Math.min(rect.width || wheel.clientWidth, rect.height || wheel.clientHeight);
    const size = Math.max(180, Math.floor(measuredSize || wheel.clientWidth || 240));
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const image = ctx.createImageData(size, size);
    const center = size / 2;
    const radius = center - 1;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - center;
        const dy = y - center;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const index = (y * size + x) * 4;

        if (distance > radius) {
          image.data[index + 3] = 0;
          continue;
        }

        const saturation = distance / radius;
        const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const { r: red, g: green, b: blue } = hsvToRgb(hue, saturation, hsv.v);
        image.data[index] = red;
        image.data[index + 1] = green;
        image.data[index + 2] = blue;
        image.data[index + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);

    const gradient = ctx.createRadialGradient(center, center, radius * 0.48, center, center, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${Math.max(0, 1 - hsv.v) * 0.08})`);
    gradient.addColorStop(1, `rgba(15,23,42,${Math.max(0, 1 - hsv.v) * 0.18})`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(drawWheel);
    return () => cancelAnimationFrame(frame);
  }, [open, hsv.v]);

  useEffect(() => {
    if (!open) return;

    const onResize = () => requestAnimationFrame(drawWheel);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, hsv.v]);

  useEffect(() => {
    if (!open || !wheelRef.current || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(drawWheel);
    });

    observer.observe(wheelRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [open, hsv.v]);

  const handleWheelPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = wheelRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const radius = rect.width / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const saturation = clamp(distance / radius, 0, 1);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

    updateFromHsv({ h: hue, s: saturation, v: hsv.v });
  };

  const markerX = 50 + Math.cos((hsv.h * Math.PI) / 180) * Math.min(50, hsv.s * 50);
  const markerY = 50 + Math.sin((hsv.h * Math.PI) / 180) * Math.min(50, hsv.s * 50);

  return (
    <div className={`${styles.root}${className ? ` ${className}` : ""}`.trim()}>
      {name ? <input type="hidden" name={name} value={normalized} /> : null}
      <button
        type="button"
        className={`${styles.trigger}${triggerClassName ? ` ${triggerClassName}` : ""}`.trim()}
        onClick={() => !disabled && setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={styles.triggerSwatch} style={{ background: normalized }} />
        <span className={styles.triggerLabel}>{buttonText}</span>
      </button>

      <span className={`${styles.valueChip}${valueClassName ? ` ${valueClassName}` : ""}`.trim()} style={{ background: normalized, color: textColor }}>
        {normalized}
      </span>

      {open && isMounted
        ? createPortal(
            <div className={styles.overlay} role="presentation" onMouseDown={() => setOpen(false)}>
              <div className={styles.modal} role="dialog" aria-modal="true" aria-label={ariaLabel} onMouseDown={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                  <div>
                    <p className={styles.kicker}>Color Studio</p>
                    <h3 className={styles.title}>{ariaLabel}</h3>
                  </div>
                  <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close color picker">
                    ✕
                  </button>
                </div>

                <div className={styles.body}>
                  <div className={styles.wheelColumn}>
                    <div className={styles.wheelWrap} ref={wheelRef} onPointerDown={handleWheelPointer} onPointerMove={(event) => event.buttons === 1 && handleWheelPointer(event)}>
                      <canvas ref={canvasRef} className={styles.canvas} />
                      <div className={styles.marker} style={{ left: `${markerX}%`, top: `${markerY}%`, background: normalized }} />
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
                          onChange={(event) => setHexText(event.target.value)}
                          onBlur={(event) => {
                            const nextHex = normalizeHex(event.target.value) || normalized;
                            updateFromHex(nextHex);
                          }}
                          placeholder="#FFA665"
                        />
                      </label>

                      <div className={styles.rgbGrid}>
                        <label className={styles.inputGroup}>
                          <span>R</span>
                          <input type="number" min="0" max="255" value={rgbText.r} onChange={(event) => updateFromRgb("r", event.target.value)} />
                        </label>
                        <label className={styles.inputGroup}>
                          <span>G</span>
                          <input type="number" min="0" max="255" value={rgbText.g} onChange={(event) => updateFromRgb("g", event.target.value)} />
                        </label>
                        <label className={styles.inputGroup}>
                          <span>B</span>
                          <input type="number" min="0" max="255" value={rgbText.b} onChange={(event) => updateFromRgb("b", event.target.value)} />
                        </label>
                      </div>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span>Brand presets</span>
                      </div>
                      <div className={styles.swatchRow}>
                        {presets.map((preset) => (
                          <button key={preset} type="button" className={styles.swatchButton} onClick={() => commitColor(preset)} aria-label={`Use preset ${preset}`}>
                            <span className={styles.swatch} style={{ background: preset }} />
                            <span>{preset}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span>Recent colors</span>
                      </div>
                      <div className={styles.swatchRow}>
                        {recents.length > 0 ? recents.map((color) => (
                          <button key={color} type="button" className={styles.swatchButton} onClick={() => commitColor(color)} aria-label={`Use recent color ${color}`}>
                            <span className={styles.swatch} style={{ background: color }} />
                            <span>{color}</span>
                          </button>
                        )) : <p className={styles.emptyState}>Recent colors will appear here as you pick them.</p>}
                      </div>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <span>Saved custom colors</span>
                        <button type="button" className={styles.secondaryBtn} onClick={saveCustomColor}>Save current</button>
                      </div>
                      <div className={styles.swatchRow}>
                        {savedColors.length > 0 ? savedColors.map((color) => (
                          <button key={color} type="button" className={styles.swatchButton} onClick={() => commitColor(color)} aria-label={`Use saved color ${color}`}>
                            <span className={styles.swatch} style={{ background: color }} />
                            <span>{color}</span>
                          </button>
                        )) : <p className={styles.emptyState}>Save a custom color to keep it handy for this browser.</p>}
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