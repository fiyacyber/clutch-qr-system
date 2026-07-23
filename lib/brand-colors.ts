const HEX_COLOR_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const MAX_BRAND_COLORS = 8;

export function normalizeBrandColor(value: unknown) {
  const raw = String(value || "").trim();
  const match = raw.match(HEX_COLOR_PATTERN);
  if (!match) return null;

  const hex = match[1];
  const expanded = hex.length === 3
    ? hex.split("").map((character) => character + character).join("")
    : hex;

  return `#${expanded.toUpperCase()}`;
}

export function normalizeBrandColors(value: unknown, limit = MAX_BRAND_COLORS) {
  let source = value;

  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch {
      source = [];
    }
  }

  if (!Array.isArray(source)) return [] as string[];

  const colors: string[] = [];
  for (const entry of source) {
    const normalized = normalizeBrandColor(entry);
    if (!normalized || colors.includes(normalized)) continue;
    colors.push(normalized);
    if (colors.length >= limit) break;
  }

  return colors;
}
