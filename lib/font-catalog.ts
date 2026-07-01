export const BUILDER_FONT_OPTIONS = [
  { value: "exo2", label: "Exo2", keywords: "default modern" },
  { value: "sans", label: "Sans", keywords: "clean ui" },
  { value: "display", label: "Display", keywords: "bold headline" },
  { value: "serif", label: "Serif", keywords: "classic editorial" },
  { value: "mono", label: "Monospace", keywords: "code technical" },
  { value: "rounded", label: "Rounded", keywords: "soft friendly" },
  { value: "editorial", label: "Editorial", keywords: "magazine refined" },
  { value: "grotesk", label: "Grotesk", keywords: "neo grotesk swiss" },
  { value: "humanist", label: "Humanist", keywords: "readable warm" },
  { value: "condensed", label: "Condensed", keywords: "narrow compact" },
  { value: "geometric", label: "Geometric", keywords: "futura modern" },
  { value: "elegant", label: "Elegant Serif", keywords: "luxury didot bodoni" },
  { value: "newspaper", label: "Newspaper", keywords: "news times" },
  { value: "slab", label: "Slab Serif", keywords: "strong sturdy" },
  { value: "clean", label: "Clean UI", keywords: "product neutral" },
  { value: "system", label: "System", keywords: "default mac windows" },
  { value: "ui-sans", label: "UI Sans", keywords: "apple san francisco segoe" },
  { value: "ui-serif", label: "UI Serif", keywords: "apple serif georgia" },
  { value: "ui-mono", label: "UI Mono", keywords: "apple monospace terminal" },
  { value: "humanist-alt", label: "Humanist Alt", keywords: "optima gill sans" },
  { value: "neo-grotesk", label: "Neo Grotesk", keywords: "helvetica neue arial" },
  { value: "book", label: "Book", keywords: "book antiqua palatino" },
  { value: "modern-serif", label: "Modern Serif", keywords: "baskerville garamond" },
  { value: "tech", label: "Tech", keywords: "sf mono menlo console" },
  { value: "narrow", label: "Narrow", keywords: "compact condensed" },
  { value: "poster", label: "Poster", keywords: "impact heavy display" },
  { value: "friendly", label: "Friendly", keywords: "verdana trebuchet" },
  { value: "signature", label: "Signature", keywords: "script handwriting" },
  { value: "luxury", label: "Luxury", keywords: "didot bodoni elegant" },
  { value: "slab-alt", label: "Slab Alt", keywords: "roboto slab rockwell" },
] as const;

export type BuilderFontFamily = (typeof BUILDER_FONT_OPTIONS)[number]["value"];

const FONT_STACKS: Record<BuilderFontFamily, string> = {
  exo2: 'var(--font-exo2), "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif',
  sans: '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  display: '"Archivo Black", "Anton", "Avenir Next Condensed", sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  rounded: '"Avenir Next Rounded", "Nunito", "Trebuchet MS", sans-serif',
  editorial: '"Baskerville", "Times New Roman", Times, serif',
  grotesk: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  humanist: '"Gill Sans", "Optima", "Segoe UI", sans-serif',
  condensed: '"Arial Narrow", "Franklin Gothic Medium", "Roboto Condensed", sans-serif',
  geometric: '"Futura", "Century Gothic", "Avenir Next", sans-serif',
  elegant: '"Didot", "Bodoni MT", "Book Antiqua", serif',
  newspaper: '"Times New Roman", Georgia, Cambria, serif',
  slab: '"Rockwell", "Roboto Slab", "Georgia", serif',
  clean: 'Calibri, "Segoe UI", "Avenir Next", sans-serif',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "ui-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "ui-serif": 'ui-serif, Georgia, "Times New Roman", serif',
  "ui-mono": 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  "humanist-alt": 'Optima, "Gill Sans", "Segoe UI", sans-serif',
  "neo-grotesk": '"Helvetica Neue", Helvetica, Arial, sans-serif',
  book: '"Book Antiqua", Palatino, Georgia, serif',
  "modern-serif": 'Baskerville, "Garamond", Georgia, serif',
  tech: '"SF Mono", Menlo, Monaco, Consolas, monospace',
  narrow: '"Arial Narrow", "Franklin Gothic Medium", sans-serif',
  poster: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  friendly: 'Verdana, "Trebuchet MS", sans-serif',
  signature: '"Segoe Script", "Brush Script MT", cursive',
  luxury: 'Didot, "Bodoni MT", "Times New Roman", serif',
  "slab-alt": '"Roboto Slab", Rockwell, Georgia, serif',
};

export function isBuilderFontFamily(value: unknown): value is BuilderFontFamily {
  return BUILDER_FONT_OPTIONS.some((option) => option.value === value);
}

export function resolveBuilderFontFamily(value?: string, fallback?: string): string {
  if (value && isBuilderFontFamily(value)) {
    return FONT_STACKS[value];
  }
  return fallback || FONT_STACKS.exo2;
}
