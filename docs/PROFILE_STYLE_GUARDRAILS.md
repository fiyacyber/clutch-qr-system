# Connect Profile Style Guardrails

These rules prevent muddy or low-contrast previews when customers change style and theme settings.

## Runtime Rules

1. Glass style must be theme-aware.
- Light theme: use bright/frosted surface tokens.
- Dark theme: use dark/translucent surface tokens.

2. Dark glass overrides are dark-theme only.
- Do not apply dark section backgrounds, borders, or button shells unless `data-theme="dark"`.

3. Keep style tokens single-source.
- Define each style token block once per style/theme pair.
- Avoid duplicate selector blocks that can silently override previous values.

4. Buttons must preserve customer-selected brand colors in light mode.
- Do not force dark button backgrounds for light + glass.

## QA Rules

1. Verify each profile style in both theme modes.
- Matrix: Clutch/Minimal/Executive/Glass x Light/Dark.

2. Verify System mode on both OS appearances.
- Ensure style updates are legible when system resolves to light and dark.

3. Check section card readability.
- Cards and section labels must remain clearly distinct from page background.

4. Check hidden-state treatment separately.
- Hidden-state opacity should not be confused with base style tint.

## Release Checklist

1. Inspect computed values for `.builder-public-section` background in Light + Glass and Dark + Glass.
2. Confirm no duplicate `data-style` selector blocks exist in global styles.
3. Confirm style picker copy communicates adaptive behavior.
