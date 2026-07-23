"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Info, Plus, Save, X } from "lucide-react";
import PremiumColorPicker from "@/components/PremiumColorPicker";
import { MAX_BRAND_COLORS, normalizeBrandColor, normalizeBrandColors } from "@/lib/brand-colors";
import styles from "./BrandColorsSettingsPanel.module.css";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function BrandColorsSettingsPanel({ initialColors }: { initialColors: string[] }) {
  const normalizedInitial = useMemo(() => normalizeBrandColors(initialColors), [initialColors]);
  const [colors, setColors] = useState<string[]>(normalizedInitial);
  const [savedColors, setSavedColors] = useState<string[]>(normalizedInitial);
  const [draftColor, setDraftColor] = useState(normalizedInitial[0] || "#384862");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const hasChanges = JSON.stringify(colors) !== JSON.stringify(savedColors);
  const canAdd = colors.length < MAX_BRAND_COLORS;

  function addColor() {
    const normalized = normalizeBrandColor(draftColor);
    if (!normalized) {
      setSaveState("error");
      setMessage("Choose a valid hex color before adding it.");
      return;
    }

    if (colors.includes(normalized)) {
      setSaveState("error");
      setMessage("That color is already in your brand palette.");
      return;
    }

    if (!canAdd) {
      setSaveState("error");
      setMessage(`You can save up to ${MAX_BRAND_COLORS} brand colors.`);
      return;
    }

    setColors((current) => [...current, normalized]);
    setSaveState("idle");
    setMessage("Save your changes when the palette is ready.");
  }

  function removeColor(color: string) {
    setColors((current) => current.filter((item) => item !== color));
    setSaveState("idle");
    setMessage("Save your changes to update the QR color picker.");
  }

  async function saveColors() {
    setSaveState("saving");
    setMessage("Saving brand colors...");

    try {
      const response = await fetch("/api/customer/brand-colors", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSaveState("error");
        setMessage(data.error || "Unable to save brand colors right now.");
        return;
      }

      const nextColors = normalizeBrandColors(data.colors || colors);
      setColors(nextColors);
      setSavedColors(nextColors);
      setSaveState("saved");
      setMessage("Brand colors saved. They are now available in the QR Studio color picker.");
    } catch (error) {
      console.error("[BrandColorsSettingsPanel] save failed", error);
      setSaveState("error");
      setMessage("Unable to save brand colors right now.");
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <div>
          <strong>Build a reusable QR color palette</strong>
          <p>
            Save the colors your business uses most. They appear as optional presets inside the QR Studio color picker.
          </p>
        </div>
        <span className={styles.count}>{colors.length}/{MAX_BRAND_COLORS}</span>
      </div>

      {colors.length ? (
        <div className={styles.palette} aria-label="Saved brand colors">
          {colors.map((color) => (
            <article key={color} className={styles.colorCard}>
              <span className={styles.colorPreview} style={{ background: color }} />
              <strong className={styles.colorCode}>{color}</strong>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeColor(color)}
                aria-label={`Remove brand color ${color}`}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <div>
            <strong>No brand colors saved yet</strong>
            <p>Add the primary and accent colors customers should see when designing a Clutch Code.</p>
          </div>
        </div>
      )}

      <div className={styles.editor}>
        <div className={styles.pickerWrap}>
          <span className={styles.pickerLabel}>Add a brand color</span>
          <PremiumColorPicker
            value={draftColor}
            onChange={setDraftColor}
            ariaLabel="Brand color"
            buttonText="Choose color"
            presets={colors}
            storageKey="clutch-brand-color-settings-recents"
            className={styles.picker}
          />
        </div>
        <button type="button" className={styles.addButton} onClick={addColor} disabled={!canAdd}>
          <Plus size={16} aria-hidden="true" />
          Add color
        </button>
      </div>

      <div className={styles.notice}>
        <Info size={17} aria-hidden="true" />
        <div>
          <strong>Brand colors are presets only</strong>
          <p>
            Saving this palette does not recolor existing QR codes and does not automatically apply a color to new codes. Customers choose a saved color inside the QR color picker.
          </p>
        </div>
      </div>

      <div className={styles.saveRow}>
        <span
          className={`${styles.saveStatus} ${saveState === "saved" ? styles.saveStatusSuccess : ""} ${saveState === "error" ? styles.saveStatusError : ""}`}
          role="status"
          aria-live="polite"
        >
          {saveState === "saved" ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
          {message || (hasChanges ? "You have unsaved palette changes." : "Your saved palette is up to date.")}
        </span>
        <button
          type="button"
          className={styles.saveButton}
          onClick={saveColors}
          disabled={!hasChanges || saveState === "saving"}
        >
          <Save size={16} aria-hidden="true" />
          {saveState === "saving" ? "Saving..." : "Save brand colors"}
        </button>
      </div>
    </div>
  );
}
