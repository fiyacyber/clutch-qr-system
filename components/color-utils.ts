export function normalizeHexColor(input: string) {
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

export function clampColorValue(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function toHex(value: number) {
  return clampColorValue(value).toString(16).padStart(2, "0");
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex) || "#000000";
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}