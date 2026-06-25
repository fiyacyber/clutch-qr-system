"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Palette, PlusCircle, SlidersHorizontal, X } from "lucide-react";
import { BuilderConfig, BlockType } from "@/lib/builder-types";
import { MAX_BUILDER_BLOCKS, createDefaultBuilderConfig, addBlockToConfig, updateBlockSettings, toggleBlockVisibility, updateTheme, sanitizeBuilderConfig } from "@/lib/builder-config";
import BlockLibrary from "./BlockLibrary";
import BuilderCanvas, { BlockSettingsPanel } from "./BuilderCanvas";
import BuilderPreview from "./BuilderPreview";
import PremiumColorPicker from "./PremiumColorPicker";
import TemplateSelector from "./TemplateSelector";

type SidebarTab = "content" | "design" | "blocks";

const sidebarTabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "content", label: "Content", icon: <Layers size={15} /> },
  { id: "design", label: "Design", icon: <Palette size={15} /> },
  { id: "blocks", label: "Blocks", icon: <PlusCircle size={15} /> },
];

const DESIGN_ACCENT_SWATCHES = ["#FFA665", "#FF6B2C", "#38BDF8", "#34D399", "#A78BFA", "#F472B6", "#F59E0B", "#F8FAFC"];
const DESIGN_BUTTON_SWATCHES = ["#FFA665", "#FF6B2C", "#1D4ED8", "#0F766E", "#7C3AED", "#BE185D", "#111827", "#F8FAFC"];
const DESIGN_TEXT_SWATCHES = ["#0F172A", "#1E293B", "#334155", "#FFFFFF", "#F8FAFC", "#FFD166"];
const FONT_FAMILY_OPTIONS = [
  { value: "exo2", label: "Exo2" },
  { value: "display", label: "Display (Large)" },
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
  { value: "rounded", label: "Rounded" },
  { value: "editorial", label: "Editorial" },
] as const;
const FONT_SCALE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
] as const;
const BUILDER_DRAFT_STORAGE_PREFIX = "clutch-connect-builder-draft";

interface BuilderEditorProps {
  profile: any;
}

export default function BuilderEditor({ profile }: BuilderEditorProps) {
  const router = useRouter();
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("content");
  const [useInspector, setUseInspector] = useState(false);
  const [isMobileBuilder, setIsMobileBuilder] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const savedConfigRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const getDraftStorageKey = () => `${BUILDER_DRAFT_STORAGE_PREFIX}:${profile?.id || profile?.customer_id || "anonymous"}`;

  const readLocalDraft = (): BuilderConfig | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getDraftStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { config?: BuilderConfig };
      if (!parsed?.config) return null;
      return sanitizeBuilderConfig(parsed.config);
    } catch {
      return null;
    }
  };

  const persistLocalDraft = (nextConfig: BuilderConfig) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        getDraftStorageKey(),
        JSON.stringify({ updatedAt: Date.now(), config: sanitizeBuilderConfig(nextConfig) })
      );
    } catch {
      // noop
    }
  };

  const clearLocalDraft = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(getDraftStorageKey());
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1200px)");
    const apply = () => setUseInspector(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 860px)");
    const apply = () => {
      setIsMobileBuilder(media.matches);
      if (!media.matches) setMobileSheetOpen(false);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/connect/builder-config");
        const data = await res.json();
        if (!res.ok || !data.config) {
          throw new Error(data.error || "Failed to load builder config");
        }
        const cleanConfig = sanitizeBuilderConfig(data.config);
        savedConfigRef.current = JSON.stringify(cleanConfig);
        const localDraft = readLocalDraft();
        if (localDraft && JSON.stringify(localDraft) !== JSON.stringify(cleanConfig)) {
          setConfig(localDraft);
          setIsDirty(true);
          setSaveError("Recovered unsaved local changes. We will sync them when connection is available.");
        } else {
          setConfig(cleanConfig);
        }
        if (data.isDefault && cleanConfig.blocks.length < 2) {
          setShowTemplates(true);
        }
      } catch {
        const localDraft = readLocalDraft();
        if (localDraft) {
          setConfig(localDraft);
          setIsDirty(true);
          savedConfigRef.current = null;
          setSaveError("You are offline. Unsaved local changes are loaded and ready.");
          return;
        }
        const def = createDefaultBuilderConfig(profile.theme_color);
        setConfig(def);
        savedConfigRef.current = JSON.stringify(def);
        setSaveError("We could not load your saved builder settings, so a default draft is showing.");
      }
    }
    loadConfig();
  }, [profile.id, profile.customer_id, profile.theme_color]);

  const handleAddBlock = (type: BlockType) => {
    if (!config) return;
    const newConfig = addBlockToConfig(config, type);
    handleConfigChange(newConfig);
    setActiveSidebarTab("content");
  };

  const handleApplyTemplate = (templateConfig: BuilderConfig) => {
    handleConfigChange(templateConfig);
  };

  const handleSave = async (configToSave?: BuilderConfig, options?: { silent?: boolean }) => {
    const targetConfig = sanitizeBuilderConfig(configToSave || config || createDefaultBuilderConfig(profile.theme_color));
    if (isSavingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      persistLocalDraft(targetConfig);
      if (!options?.silent) {
        setSaveError("You are offline. Changes are saved locally and will sync when back online.");
      }
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    if (!options?.silent) {
      setSaveError(null);
    }
    try {
      const res = await fetch("/api/connect/builder-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: targetConfig }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        savedConfigRef.current = JSON.stringify(targetConfig);
        setIsDirty(false);
        setSaveSuccess(true);
        clearLocalDraft();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        persistLocalDraft(targetConfig);
        if (!options?.silent) {
          setSaveError(data.error || "Failed to save builder changes. Please try again.");
        }
      }
    } catch {
      persistLocalDraft(targetConfig);
      if (!options?.silent) {
        setSaveError("Failed to save builder changes. Changes are saved locally.");
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleConfigChange = (newConfig: BuilderConfig) => {
    setConfig(newConfig);
    setIsDirty(savedConfigRef.current !== JSON.stringify(newConfig));
    persistLocalDraft(newConfig);
    setSaveSuccess(false);
    setSaveError(null);
  };

  useEffect(() => {
    if (!config || !isDirty) return;
    const timer = window.setTimeout(() => {
      void handleSave(config, { silent: true });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [config, isDirty]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBackOnline = () => {
      if (!config || !isDirty) return;
      void handleSave(config, { silent: true });
    };

    window.addEventListener("online", onBackOnline);
    return () => window.removeEventListener("online", onBackOnline);
  }, [config, isDirty]);

  const handleThemeChange = (themePatch: Parameters<typeof updateTheme>[1]) => {
    if (!config) return;
    handleConfigChange(updateTheme(config, themePatch));
  };

  const handlePreviewFocus = () => {
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  };

  const handlePreviewBlockSelect = (blockId: string) => {
    setSelectedBlockId(blockId);
    setActiveSidebarTab("content");
    if (isMobileBuilder) {
      setMobileSheetOpen(true);
    }
  };

  const selectedBlock = config && selectedBlockId ? config.blocks.find((block) => block.id === selectedBlockId) || null : null;

  const renderEditorTabPanel = ({ compactActions, mobileMode }: { compactActions: boolean; mobileMode: boolean }) => {
    if (!config) return null;

    if (activeSidebarTab === "content") {
      return (
        <BuilderCanvas
          config={config}
          onConfigChange={handleConfigChange}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          inlineEditing={!useInspector || mobileMode}
          compactActions={compactActions}
        />
      );
    }

    if (activeSidebarTab === "design") {
      return (
        <div className="saas-design-shell">
          <div className="saas-design-card saas-design-hero-card">
            <p className="saas-design-kicker">Global styling</p>
            <h3 className="saas-design-title">Design controls</h3>
            <p className="saas-design-copy">Shape the look of your public page in seconds with presets and accent controls.</p>
          </div>

          <div className="saas-design-card">
            <div className="saas-field">
              <span className="saas-field-label">Theme mode</span>
              <div className="saas-theme-mode-grid">
                <button
                  type="button"
                  className={`saas-theme-mode-btn${!config.theme.darkMode ? " active" : ""}`}
                  onClick={() => handleThemeChange({ darkMode: false })}
                >
                  <strong>Light</strong>
                  <span>Bright and clean</span>
                </button>
                <button
                  type="button"
                  className={`saas-theme-mode-btn${config.theme.darkMode ? " active" : ""}`}
                  onClick={() => handleThemeChange({ darkMode: true })}
                >
                  <strong>Dark</strong>
                  <span>Bold and premium</span>
                </button>
              </div>
            </div>

            <label className="saas-field">
              <span className="saas-field-label">Accent color</span>
              <div className="saas-swatch-grid" role="radiogroup" aria-label="Accent color swatches">
                {DESIGN_ACCENT_SWATCHES.map((swatch) => {
                  const selected = (config.theme.accentColor || "").toLowerCase() === swatch.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`saas-swatch-btn${selected ? " active" : ""}`}
                      style={{ "--swatch": swatch } as React.CSSProperties}
                      onClick={() => handleThemeChange({ accentColor: swatch })}
                      title={`Use ${swatch}`}
                    />
                  );
                })}
              </div>
              <PremiumColorPicker
                value={config.theme.accentColor || profile.theme_color || "#FFA665"}
                onChange={(color) => handleThemeChange({ accentColor: color })}
                ariaLabel="Builder accent color"
                buttonText="Advanced color picker"
                presets={DESIGN_ACCENT_SWATCHES}
              />
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Button color</span>
              <div className="saas-swatch-grid" role="radiogroup" aria-label="Button color swatches">
                {DESIGN_BUTTON_SWATCHES.map((swatch) => {
                  const selected = (config.theme.buttonColor || config.theme.accentColor || "").toLowerCase() === swatch.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`saas-swatch-btn${selected ? " active" : ""}`}
                      style={{ "--swatch": swatch } as React.CSSProperties}
                      onClick={() => handleThemeChange({ buttonColor: swatch })}
                      title={`Use ${swatch}`}
                    />
                  );
                })}
              </div>
              <PremiumColorPicker
                value={config.theme.buttonColor || config.theme.accentColor || profile.theme_color || "#FFA665"}
                onChange={(color) => handleThemeChange({ buttonColor: color })}
                ariaLabel="Builder button color"
                buttonText="Advanced button color"
                presets={DESIGN_BUTTON_SWATCHES}
              />
              <p className="saas-design-copy">Controls the main action cards in your live preview and public page.</p>
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Text color</span>
              <div className="saas-swatch-grid" role="radiogroup" aria-label="Text color swatches">
                {DESIGN_TEXT_SWATCHES.map((swatch) => {
                  const selected = (config.theme.textColor || "").toLowerCase() === swatch.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`saas-swatch-btn${selected ? " active" : ""}`}
                      style={{ "--swatch": swatch } as React.CSSProperties}
                      onClick={() => handleThemeChange({ textColor: swatch })}
                      title={`Use ${swatch}`}
                    />
                  );
                })}
              </div>
              <PremiumColorPicker
                value={config.theme.textColor || "#0F172A"}
                onChange={(color) => handleThemeChange({ textColor: color })}
                ariaLabel="Builder text color"
                buttonText="Advanced text color"
                presets={DESIGN_TEXT_SWATCHES}
              />
            </label>

            <div className="saas-field">
              <span className="saas-field-label">Font family</span>
              <div className="saas-density-row">
                {FONT_FAMILY_OPTIONS.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    className={`saas-density-btn${(config.theme.fontFamily || "exo2") === font.value ? " active" : ""}`}
                    onClick={() => handleThemeChange({ fontFamily: font.value })}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
              <p className="saas-design-copy">Applies to headings and body text across all blocks.</p>
            </div>

            <div className="saas-field">
              <span className="saas-field-label">Text scale</span>
              <div className="saas-density-row">
                {FONT_SCALE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`saas-density-btn${(config.theme.fontScale || "normal") === option.value ? " active" : ""}`}
                    onClick={() => handleThemeChange({ fontScale: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="saas-design-copy">Use Large for bigger headings and body text.</p>
            </div>

            <div className="saas-field">
              <span className="saas-field-label">Page density</span>
              <div className="saas-density-row">
                {[
                  { value: "default", label: "Default" },
                  { value: "minimal", label: "Minimal" },
                  { value: "compact", label: "Compact" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`saas-density-btn${(config.theme.layout || "default") === option.value ? " active" : ""}`}
                    onClick={() => handleThemeChange({ layout: option.value as any })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="saas-switch-row">
              <div>
                <span className="saas-field-label">Footer branding</span>
                <p className="saas-design-copy">Show or hide the “Powered by Clutch Connect” footer.</p>
              </div>
              <button
                type="button"
                className={`saas-toggle${config.theme.showFooter !== false ? " on" : ""}`}
                onClick={() => handleThemeChange({ showFooter: config.theme.showFooter === false })}
                role="switch"
                aria-checked={config.theme.showFooter !== false}
              >
                <span className="saas-toggle-thumb" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <BlockLibrary
        onAddBlock={handleAddBlock}
        existingBlockTypes={config.blocks.map((block) => String(block.type))}
        isAtBlockLimit={config.blocks.length >= MAX_BUILDER_BLOCKS}
      />
    );
  };

  if (!config) {
    return (
      <div className="saas-builder-loading">
        <div className="saas-loading-spinner" />
        <span>Loading builder…</span>
      </div>
    );
  }

  return (
    <>
      <div className="saas-builder" data-theme="builder-dark">
        {/* Top nav bar */}
        <header className="saas-topbar">
          <div className="saas-topbar-left">
            <div className="saas-topbar-title">
              <span className="saas-topbar-dot" />
              Profile Builder
            </div>
          </div>
          <div className="saas-topbar-right">
            <span className="saas-topbar-meta">Live builder</span>
          </div>
        </header>

        {isMobileBuilder ? (
          <div className="saas-mobile-builder">
            <div className="saas-preview-center saas-preview-center-mobile" ref={previewRef}>
              <BuilderPreview
                config={config}
                profile={profile}
                editablePreview
                selectedBlockId={selectedBlockId}
                onSelectBlock={handlePreviewBlockSelect}
              />
            </div>

            <button type="button" className="saas-mobile-edit-trigger" onClick={() => setMobileSheetOpen(true)}>
              <SlidersHorizontal size={16} />
              Edit Page
            </button>

            <div className="saas-mobile-savebar">
              <div className="saas-mobile-savebar-state">
                {isDirty && !saveSuccess ? <span className="saas-unsaved-badge">Unsaved changes</span> : null}
                {saveSuccess ? <span className="saas-saved-badge">✓ Saved</span> : null}
                {saveError ? <span className="saas-save-error">{saveError}</span> : null}
              </div>
              <button
                type="button"
                className="saas-sidebar-btn ghost"
                onClick={() => router.push("/portal/connect")}
              >
                Go Back
              </button>
              <button
                type="button"
                className={`saas-sidebar-btn primary${isSaving ? " loading" : ""}`}
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>

            <AnimatePresence>
              {mobileSheetOpen ? (
                <>
                  <motion.button
                    type="button"
                    className="saas-mobile-sheet-backdrop"
                    onClick={() => setMobileSheetOpen(false)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />

                  <motion.section
                    className="saas-mobile-sheet"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <div className="saas-mobile-sheet-header">
                      <div>
                        <p className="saas-sidebar-kicker">Editor</p>
                        <h3 className="saas-sidebar-title">Profile settings</h3>
                      </div>
                      <button
                        type="button"
                        className="saas-icon-btn"
                        onClick={() => setMobileSheetOpen(false)}
                        title="Close editor"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="saas-mobile-tabs">
                      {sidebarTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className={`sidebar-tab ${activeSidebarTab === tab.id ? "active" : ""}`}
                          onClick={() => setActiveSidebarTab(tab.id)}
                        >
                          {tab.icon}
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="saas-mobile-sheet-content">
                      {renderEditorTabPanel({ compactActions: true, mobileMode: true })}
                    </div>
                  </motion.section>
                </>
              ) : null}
            </AnimatePresence>
          </div>
        ) : (
          <div className={`saas-workspace${useInspector && selectedBlock ? " has-inspector" : ""}`}>
            {/* Left panel */}
            <div className="saas-left-panel">
            <div className="saas-sidebar-header">
              <div className="saas-sidebar-header-copy">
                <p className="saas-sidebar-kicker">Profile Builder</p>
                <h2 className="saas-sidebar-title">Customize your public profile</h2>
                <p className="saas-sidebar-subtitle">Edit content, adjust design, and manage blocks without leaving the live preview.</p>
              </div>

              <div className="saas-sidebar-actions">
                <button type="button" className="saas-sidebar-btn ghost" onClick={() => router.push("/portal/connect")}>
                  Go Back
                </button>
                <button type="button" className="saas-sidebar-btn ghost" onClick={handlePreviewFocus}>
                  Preview
                </button>
                <button
                  type="button"
                  className={`saas-sidebar-btn primary${isSaving ? " loading" : ""}`}
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="saas-sidebar-status-row">
                <AnimatePresence>
                  {isDirty && !saveSuccess && (
                    <motion.span
                      className="saas-unsaved-badge"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.2 }}
                    >
                      Unsaved changes
                    </motion.span>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {saveSuccess && (
                    <motion.span
                      className="saas-saved-badge"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                    >
                      ✓ Saved
                    </motion.span>
                  )}
                </AnimatePresence>
                {saveError ? <span className="saas-save-error">{saveError}</span> : null}
              </div>
            </div>

            <div className="sidebar-tabs">
              {sidebarTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`sidebar-tab ${activeSidebarTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveSidebarTab(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {activeSidebarTab === "content" ? (
                <motion.div
                  key="content"
                  className="saas-panel-inner sidebar-panel"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {renderEditorTabPanel({ compactActions: false, mobileMode: false })}
                </motion.div>
              ) : activeSidebarTab === "design" ? (
                <motion.div
                  key="design"
                  className="saas-panel-inner sidebar-panel"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {renderEditorTabPanel({ compactActions: false, mobileMode: false })}
                </motion.div>
              ) : (
                <motion.div
                  key="blocks"
                  className="saas-panel-inner sidebar-panel"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.18 }}
                >
                  {renderEditorTabPanel({ compactActions: false, mobileMode: false })}
                </motion.div>
              )}
            </AnimatePresence>
            </div>

            {/* Center preview */}
            <div className="saas-preview-center" ref={previewRef}>
              <BuilderPreview
                config={config}
                profile={profile}
                editablePreview
                selectedBlockId={selectedBlockId}
                onSelectBlock={handlePreviewBlockSelect}
              />
            </div>

            {useInspector && selectedBlock ? (
              <aside className="saas-right-inspector">
                <div className="saas-right-inspector-header">
                  <p className="saas-right-inspector-kicker">Inspector</p>
                  <h3 className="saas-right-inspector-title">{selectedBlock.type.replace(/-/g, " ")}</h3>
                </div>
                <div className="saas-right-inspector-body">
                  <BlockSettingsPanel
                    block={selectedBlock}
                    onUpdate={(settings) => {
                      if (Object.prototype.hasOwnProperty.call(settings, "__toggleVisibility")) {
                        const show = Boolean(settings.__toggleVisibility);
                        if (show !== selectedBlock.visible) {
                          handleConfigChange(toggleBlockVisibility(config, selectedBlock.id));
                        }
                        return;
                      }
                      handleConfigChange(updateBlockSettings(config, selectedBlock.id, settings));
                    }}
                  />
                </div>
              </aside>
            ) : null}
          </div>
        )}
      </div>

      <TemplateSelector
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleApplyTemplate}
      />
    </>
  );
}
