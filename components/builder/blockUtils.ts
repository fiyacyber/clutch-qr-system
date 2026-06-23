import { BuilderBlock } from "@/lib/builder-types";

export function getBlockData(block: BuilderBlock): Record<string, any> {
  return block.data || block.settings || {};
}

export function normalizeBlockType(type: string): string {
  const aliases: Record<string, string> = {
    contact: "contact-buttons",
    "social-links": "social-media-links",
    "image-block": "image-banner",
    booking: "request-quote-button",
    "booking-block": "request-quote-button",
  };
  return aliases[type] || type;
}

export function withBlockData(
  block: BuilderBlock,
  patch: Record<string, any>
): Record<string, any> {
  const current = getBlockData(block);
  return {
    ...current,
    ...patch,
  };
}

export function createInitials(name?: string, business?: string, email?: string): string {
  const source = (name || business || email || "CC").trim();
  if (!source) return "CC";
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}
