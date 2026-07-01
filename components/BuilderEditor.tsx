"use client";

import { type ChangeEvent, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Palette, PlusCircle } from "lucide-react";
import { BuilderConfig, BlockType } from "@/lib/builder-types";
import { DEFAULT_SECTION_STYLE, MAX_BUILDER_BLOCKS, createDefaultBuilderConfig, addBlockToConfig, removeBlockFromConfig, removeSectionFromConfig, updateBlockSettings, toggleBlockVisibility, updateTheme, sanitizeBuilderConfig } from "@/lib/builder-config";
import BlockLibrary from "./BlockLibrary";
import BuilderCanvas, { BlockSettingsPanel } from "./BuilderCanvas";
import BuilderPreview from "./BuilderPreview";
import FontFamilyPicker from "./FontFamilyPicker";
import PremiumColorPicker from "./PremiumColorPicker";
import TemplateSelector from "./TemplateSelector";

type SidebarTab = "content" | "design" | "blocks";

const sidebarTabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "content", label: "Setup", icon: <Layers size={15} /> },
  { id: "design", label: "Design", icon: <Palette size={15} /> },
  { id: "blocks", label: "Sections", icon: <PlusCircle size={15} /> },
];

const FONT_SCALE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
] as const;

const THEME_MODE_OPTIONS = [
  { value: "light", label: "Light", description: "Clean, sharp, and easy to read" },
  { value: "dark", label: "Dark", description: "Modern, bold, and high contrast" },
  { value: "system", label: "System", description: "Match the visitor’s device setting" },
] as const;

const PROFILE_STYLE_OPTIONS = [
  { value: "clutch", label: "Clutch", description: "Premium branded default" },
  { value: "minimal", label: "Minimal", description: "Simple and distraction-free" },
  { value: "executive", label: "Executive", description: "Polished business profile" },
  { value: "glass", label: "Glass", description: "Translucent cards that adapt to light/dark mode" },
] as const;

const BANNER_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
  { value: "glass", label: "Glass" },
] as const;

const BANNER_POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
] as const;

const HEADER_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
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
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null);
  const [pendingTargetSectionId, setPendingTargetSectionId] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const savedConfigRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);
  const pendingAutosaveRef = useRef(false);
  const latestConfigRef = useRef<BuilderConfig | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

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
        JSON.stringify({ config: sanitizeBuilderConfig(nextConfig) })
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
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      setIsMobileBuilder(media.matches);
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
    const newConfig = addBlockToConfig(config, type, undefined, pendingTargetSectionId || undefined);
    handleConfigChange(newConfig);
    setPendingTargetSectionId(null);
    setActiveSidebarTab("content");
  };

  const handleApplyTemplate = (templateConfig: BuilderConfig) => {
    handleConfigChange(templateConfig);
  };

  const handleSave = async (configToSave?: BuilderConfig, options?: { silent?: boolean }) => {
    const targetConfig = sanitizeBuilderConfig(configToSave || config || createDefaultBuilderConfig(profile.theme_color));
    if (isSavingRef.current) {
      pendingAutosaveRef.current = true;
      return;
    }
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
        const latestConfig = latestConfigRef.current;
        const stillDirty = latestConfig ? savedConfigRef.current !== JSON.stringify(latestConfig) : false;
        setIsDirty(stillDirty);
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

      if (pendingAutosaveRef.current) {
        pendingAutosaveRef.current = false;
        const latestConfig = latestConfigRef.current;
        if (latestConfig && savedConfigRef.current !== JSON.stringify(latestConfig)) {
          void handleSave(latestConfig, { silent: true });
        }
      }
    }
  };

  const handleConfigChange = (newConfig: BuilderConfig) => {
    latestConfigRef.current = newConfig;
    setConfig(newConfig);
    setIsDirty(savedConfigRef.current !== JSON.stringify(newConfig));
    persistLocalDraft(newConfig);
    setSaveSuccess(false);
    setSaveError(null);
  };

  useEffect(() => {
    latestConfigRef.current = config;
  }, [config]);

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

  const handleBackgroundChange = (backgroundPatch: Partial<BuilderConfig["theme"]["background"]>) => {
    if (!config) return;
    handleThemeChange({
      background: {
        ...config.theme.background,
        ...backgroundPatch,
      },
    });
  };

  const handleButtonsChange = (buttonsPatch: Partial<BuilderConfig["theme"]["buttons"]>) => {
    if (!config) return;
    const nextButtons = {
      ...config.theme.buttons,
      ...buttonsPatch,
    };
    handleThemeChange({
      buttons: nextButtons,
      ...(buttonsPatch.color ? { buttonColor: buttonsPatch.color } : {}),
    });
  };

  const handleBannerChange = (bannerPatch: Partial<BuilderConfig["theme"]["banner"]>) => {
    if (!config) return;
    const nextBanner = {
      ...config.theme.banner,
      ...bannerPatch,
    };

    handleThemeChange({
      banner: nextBanner,
    });
  };

  const uploadBannerImage = async (file: File) => {
    if (!config) return;
    setBannerUploadError(null);

    if (!file) {
      setBannerUploadError("Choose a banner image to upload.");
      return;
    }

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
    if (!allowedTypes.has(file.type)) {
      setBannerUploadError("Use a PNG, JPG, WebP, or SVG banner image.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setBannerUploadError("Banner image must be 3MB or smaller.");
      return;
    }

    setIsUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("banner", file);

      const response = await fetch("/api/connect/banner", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok || !result?.banner_url) {
        throw new Error(result?.error || "Banner upload failed.");
      }

      handleBannerChange({
        enabled: true,
        type: "image",
        imageUrl: result.banner_url,
      });
    } catch (error) {
      setBannerUploadError(error instanceof Error ? error.message : "Banner upload failed.");
    } finally {
      setIsUploadingBanner(false);
      if (bannerFileInputRef.current) {
        bannerFileInputRef.current.value = "";
      }
    }
  };

  const handleBannerFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadBannerImage(file);
  };

  const handlePreviewFocus = () => {
    if (isMobileBuilder) {
      requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" }));
      return;
    }

    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  };

  const handlePreviewBlockSelect = (blockId: string) => {
    setFocusedSectionId(null);
    setSelectedBlockId(blockId);
    setActiveSidebarTab("content");
  };

  const handlePreviewSectionSelect = (sectionId: string) => {
    setSelectedBlockId(null);
    setFocusedSectionId(sectionId);
    setActiveSidebarTab("content");
  };

  const handlePreviewSaveShareSelect = () => {
    setSelectedBlockId(null);
    setFocusedSectionId(null);
    setActiveSidebarTab("design");
  };

  const handlePreviewClearSelection = () => {
    setSelectedBlockId(null);
    setFocusedSectionId(null);
  };

  const handlePreviewRemoveBlock = (blockId: string) => {
    if (!config) return;
    const target = config.blocks.find((block) => block.id === blockId);
    if (!target || target.type === "avatar-block") return;

    handleConfigChange(removeBlockFromConfig(config, blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const handlePreviewRemoveSection = (sectionId: string) => {
    if (!config) return;
    handleConfigChange(removeSectionFromConfig(config, sectionId));
    setSelectedBlockId(null);
    if (focusedSectionId === sectionId) {
      setFocusedSectionId(null);
    }
  };

  const selectedBlock = config && selectedBlockId ? config.blocks.find((block) => block.id === selectedBlockId) || null : null;

  const handleResetContent = () => {
    if (!config) return;

    const shouldReset = window.confirm(
      "Reset all content? This will remove all sections and blocks from the preview."
    );
    if (!shouldReset) return;

    const defaults = createDefaultBuilderConfig(profile.theme_color);
    const keepOrder: BlockType[] = ["avatar-block", "business-name-block", "subheader-block"];
    const nextHeaderBlocks = keepOrder.map((type, idx) => {
      const existing = config.blocks.find((block) => block.type === type);
      const fallback = defaults.blocks.find((block) => block.type === type);
      const source = existing || fallback;
      if (!source) return null;
      return {
        ...source,
        order: idx,
        visible: true,
        sectionId: undefined,
      };
    }).filter((block): block is NonNullable<typeof block> => Boolean(block));

    const nextConfig: BuilderConfig = {
      ...config,
      theme: {
        ...config.theme,
        showSaveShareSection: false,
      },
      sections: [
        {
          id: `section-${Date.now()}`,
          label: "New Section",
          visible: true,
          order: 0,
          blockIds: [],
          style: { ...DEFAULT_SECTION_STYLE },
        },
      ],
      blocks: nextHeaderBlocks,
      forms: [],
    };

    setSelectedBlockId(null);
    setActiveSidebarTab("content");
    handleConfigChange(nextConfig);
  };

  const renderEditorTabPanel = ({ compactActions, mobileMode, tab = activeSidebarTab }: { compactActions: boolean; mobileMode: boolean; tab?: SidebarTab }) => {
    if (!config) return null;

    if (tab === "content") {
      return (
        <BuilderCanvas
          config={config}
          onConfigChange={handleConfigChange}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          focusedSectionId={focusedSectionId}
          inlineEditing={!useInspector || mobileMode}
          compactActions={compactActions}
          onRequestAddBlock={(sectionId) => {
            setPendingTargetSectionId(sectionId || null);
            setActiveSidebarTab("blocks");
          }}
        />
      );
    }

    if (tab === "design") {
      const banner = config.theme.banner;
      const bannerType = banner.type || "none";
      const bannerEnabled = banner.enabled !== false && bannerType !== "none";
      const showBannerColor = bannerType === "solid" || bannerType === "glass";
      const showBannerGradient = bannerType === "gradient";
      const showBannerImage = bannerType === "image";
      const showBannerOverlay = bannerType === "image" || bannerType === "gradient" || bannerType === "glass";

      return (
        <div className="saas-design-shell">
          <div className="saas-design-card saas-design-hero-card">
            <p className="saas-design-kicker">Global styling</p>
            <h3 className="saas-design-title">Design your public profile</h3>
            <p className="saas-design-copy">Choose the page style, colors, text, and utility sections customers see.</p>
          </div>

          <div className="saas-design-card">
            <p className="saas-design-kicker">Page style</p>
            <h3 className="saas-design-title">Overall look</h3>
            <div className="saas-field">
              <span className="saas-field-label">Light / dark mode</span>
              <div className="saas-choice-grid" role="radiogroup" aria-label="Theme mode">
                {THEME_MODE_OPTIONS.map((option) => {
                  const isActive = (config.theme.themeMode || "system") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`saas-choice-card${isActive ? " active" : ""}`}
                      onClick={() => handleThemeChange({ themeMode: option.value })}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="saas-field">
              <span className="saas-field-label">Profile style</span>
              <div className="saas-choice-grid" role="radiogroup" aria-label="Profile style">
                {PROFILE_STYLE_OPTIONS.map((option) => {
                  const isActive = (config.theme.profileStyle || "clutch") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`saas-choice-card${isActive ? " active" : ""}`}
                      onClick={() => handleThemeChange({ profileStyle: option.value })}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  );
                })}
              </div>
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
          </div>

          <div className="saas-design-card">
            <p className="saas-design-kicker">Colors</p>
            <h3 className="saas-design-title">Brand colors</h3>
            <label className="saas-field">
              <span className="saas-field-label">Background style</span>
              <div className="saas-density-row">
                {[
                  { value: "soft", label: "Soft" },
                  { value: "solid", label: "Solid" },
                  { value: "gradient", label: "Gradient" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`saas-density-btn${(config.theme.background.type || "soft") === option.value ? " active" : ""}`}
                    onClick={() => handleBackgroundChange({ type: option.value as BuilderConfig["theme"]["background"]["type"] })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Background color</span>
              <PremiumColorPicker
                value={config.theme.background.color || "#F8FAFC"}
                onChange={(color) => handleBackgroundChange({ color })}
                ariaLabel="Profile background color"
                buttonText="Choose Color"
                presets={[]}
              />
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Gradient from</span>
              <PremiumColorPicker
                value={config.theme.background.gradientFrom || "#FFFFFF"}
                onChange={(color) => handleBackgroundChange({ gradientFrom: color })}
                ariaLabel="Profile background gradient start"
                buttonText="Choose Color"
                presets={[]}
              />
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Gradient to</span>
              <PremiumColorPicker
                value={config.theme.background.gradientTo || "#FFF4EC"}
                onChange={(color) => handleBackgroundChange({ gradientTo: color })}
                ariaLabel="Profile background gradient end"
                buttonText="Choose Color"
                presets={[]}
              />
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Accent color</span>
              <PremiumColorPicker
                value={config.theme.accentColor || profile.theme_color || "#FFA665"}
                onChange={(color) => handleThemeChange({ accentColor: color })}
                ariaLabel="Builder accent color"
                buttonText="Choose Color"
                presets={[]}
              />
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Text color</span>
              <PremiumColorPicker
                value={config.theme.textColor || "#0F172A"}
                onChange={(color) => handleThemeChange({ textColor: color })}
                ariaLabel="Builder text color"
                buttonText="Choose Color"
                presets={[]}
              />
            </label>
          </div>

          <div className="saas-design-card">
            <p className="saas-design-kicker">Typography</p>
            <h3 className="saas-design-title">Text style</h3>
            <div className="saas-field">
              <span className="saas-field-label">Font family</span>
              <FontFamilyPicker value={config.theme.fontFamily || "exo2"} onChange={(value) => handleThemeChange({ fontFamily: value as any })} />
              <p className="saas-design-copy">Applies to headings and body text across your public profile.</p>
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
          </div>

          <div className="saas-design-card">
            <p className="saas-design-kicker">Buttons</p>
            <h3 className="saas-design-title">Action buttons</h3>
            <div className="saas-field">
              <span className="saas-field-label">Button shape</span>
              <div className="saas-density-row">
                {[
                  { value: "rounded", label: "Rounded" },
                  { value: "pill", label: "Pill" },
                  { value: "square", label: "Square" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`saas-density-btn${(config.theme.buttons.style || "rounded") === option.value ? " active" : ""}`}
                    onClick={() => handleButtonsChange({ style: option.value as BuilderConfig["theme"]["buttons"]["style"] })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="saas-field">
              <span className="saas-field-label">Button color</span>
              <PremiumColorPicker
                value={config.theme.buttons.color || config.theme.buttonColor || config.theme.accentColor || profile.theme_color || "#FFA665"}
                onChange={(color) => handleButtonsChange({ color })}
                ariaLabel="Profile button color"
                buttonText="Choose Color"
                presets={[]}
              />
            </label>

            <label className="saas-field">
              <span className="saas-field-label">Button text color</span>
              <PremiumColorPicker
                value={config.theme.buttons.textColor || "#111827"}
                onChange={(color) => handleButtonsChange({ textColor: color })}
                ariaLabel="Profile button text color"
                buttonText="Choose Color"
                presets={[]}
              />
            </label>
          </div>

          <div className="saas-design-card">
            <p className="saas-design-kicker">Header / Banner</p>
            <h3 className="saas-design-title">Header / Banner</h3>
            <p className="saas-design-copy">Customize the top section of your public profile.</p>
            <p className="saas-design-copy">This is the first thing visitors see when they tap your card or scan your QR code.</p>

            <div className="saas-banner-control-group">
              <span className="saas-banner-control-heading">Banner visibility</span>
              <div className="saas-switch-row">
                <div>
                  <span className="saas-field-label">Banner enabled</span>
                  <p className="saas-design-copy">Show a visual header above your profile photo and headline.</p>
                </div>
                <button
                  type="button"
                  className={`saas-toggle${bannerEnabled ? " on" : ""}`}
                  onClick={() => handleBannerChange({
                    enabled: !bannerEnabled,
                    type: bannerEnabled ? "none" : (bannerType === "none" ? "glass" : bannerType),
                  })}
                  role="switch"
                  aria-checked={bannerEnabled}
                >
                  <span className="saas-toggle-thumb" />
                </button>
              </div>
            </div>

            <div className="saas-banner-control-group">
              <span className="saas-banner-control-heading">Banner style</span>
              <div className="saas-field">
                <span className="saas-field-label">Banner type</span>
                <div className="saas-density-row" role="radiogroup" aria-label="Banner type">
                  {BANNER_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={bannerType === option.value}
                      className={`saas-density-btn${bannerType === option.value ? " active" : ""}`}
                      onClick={() => handleBannerChange({
                        type: option.value,
                        enabled: option.value !== "none",
                      })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {bannerEnabled ? (
                <label className="saas-field">
                  <span className="saas-field-label">Banner height: {banner.height || 160}px</span>
                  <input
                    type="range"
                    min="80"
                    max="320"
                    step="1"
                    value={banner.height || 160}
                    onChange={(event) => handleBannerChange({ height: Number(event.target.value) })}
                  />
                  <p className="saas-design-copy">Recommended: 140-180px for most profiles.</p>
                </label>
              ) : null}

              {bannerEnabled && showBannerColor ? (
                <label className="saas-field">
                  <span className="saas-field-label">{bannerType === "glass" ? "Glass tint" : "Banner color"}</span>
                  <PremiumColorPicker
                    value={banner.backgroundColor || "#FFA665"}
                    onChange={(color) => handleBannerChange({ backgroundColor: color })}
                    ariaLabel="Banner color"
                    buttonText="Choose Color"
                    presets={[]}
                  />
                </label>
              ) : null}

              {bannerEnabled && showBannerGradient ? (
                <>
                  <label className="saas-field">
                    <span className="saas-field-label">Gradient from</span>
                    <PremiumColorPicker
                      value={banner.gradientFrom || "#FFFFFF"}
                      onChange={(color) => handleBannerChange({ gradientFrom: color })}
                      ariaLabel="Banner gradient start"
                      buttonText="Choose Color"
                      presets={[]}
                    />
                  </label>
                  <label className="saas-field">
                    <span className="saas-field-label">Gradient to</span>
                    <PremiumColorPicker
                      value={banner.gradientTo || "#FFA665"}
                      onChange={(color) => handleBannerChange({ gradientTo: color })}
                      ariaLabel="Banner gradient end"
                      buttonText="Choose Color"
                      presets={[]}
                    />
                  </label>
                </>
              ) : null}
            </div>

            {bannerEnabled && showBannerImage ? (
              <div className="saas-banner-control-group">
                <span className="saas-banner-control-heading">Image</span>
                  <div className="saas-field">
                    <span className="saas-field-label">Banner image</span>
                    <input
                      ref={bannerFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="sr-only"
                      onChange={handleBannerFileChange}
                    />
                    <div className="saas-banner-upload-control">
                      {banner.imageUrl ? (
                        <div
                          className="saas-banner-upload-preview"
                          style={{ backgroundImage: `url(${banner.imageUrl})` }}
                          aria-label="Current banner image"
                        />
                      ) : (
                        <div className="saas-banner-upload-empty">No banner image uploaded yet.</div>
                      )}
                      <div className="saas-banner-upload-actions">
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => bannerFileInputRef.current?.click()}
                          disabled={isUploadingBanner}
                        >
                          {isUploadingBanner ? "Uploading..." : "Upload banner image"}
                        </button>
                        {banner.imageUrl ? (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => handleBannerChange({ imageUrl: null })}
                            disabled={isUploadingBanner}
                          >
                            Remove image
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="saas-design-copy">Recommended: wide image, 1600x600px, PNG/JPG/WebP/SVG, max 3MB.</p>
                    {bannerUploadError ? <p className="saas-field-error">{bannerUploadError}</p> : null}
                    {banner.imageUrl ? <p className="saas-design-copy">Image URL saved in this design after upload.</p> : null}

                    <div className="saas-field">
                      <span className="saas-field-label">Image position</span>
                      <div className="saas-density-row" role="radiogroup" aria-label="Banner image position">
                        {BANNER_POSITION_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={(banner.imagePosition || "center") === option.value}
                            className={`saas-density-btn${(banner.imagePosition || "center") === option.value ? " active" : ""}`}
                            onClick={() => handleBannerChange({ imagePosition: option.value })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
              </div>
            ) : null}

            {bannerEnabled && showBannerOverlay ? (
              <div className="saas-banner-control-group">
                <span className="saas-banner-control-heading">Overlay</span>
                <div className="saas-switch-row">
                  <div>
                    <span className="saas-field-label">Overlay</span>
                    <p className="saas-design-copy">Add a subtle layer so the header stays polished.</p>
                  </div>
                  <button
                    type="button"
                    className={`saas-toggle${banner.overlayEnabled ? " on" : ""}`}
                    onClick={() => handleBannerChange({ overlayEnabled: !banner.overlayEnabled })}
                    role="switch"
                    aria-checked={banner.overlayEnabled}
                  >
                    <span className="saas-toggle-thumb" />
                  </button>
                </div>

                {banner.overlayEnabled ? (
                  <label className="saas-field">
                    <span className="saas-field-label">Overlay opacity: {Number(banner.overlayOpacity ?? 0.22).toFixed(2)}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={banner.overlayOpacity ?? 0.22}
                      onChange={(event) => handleBannerChange({ overlayOpacity: Number(event.target.value) })}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            {bannerEnabled ? (
              <div className="saas-banner-control-group">
                <span className="saas-banner-control-heading">Layout</span>
                <label className="saas-field">
                  <span className="saas-field-label">Border radius: {banner.borderRadius ?? 24}px</span>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={banner.borderRadius ?? 24}
                    onChange={(event) => handleBannerChange({ borderRadius: Number(event.target.value) })}
                  />
                </label>

                <div className="saas-switch-row">
                  <div>
                    <span className="saas-field-label">Avatar overlap</span>
                    <p className="saas-design-copy">Let the profile photo sit partly over the banner.</p>
                  </div>
                  <button
                    type="button"
                    className={`saas-toggle${banner.avatarOverlap !== false ? " on" : ""}`}
                    onClick={() => handleBannerChange({ avatarOverlap: banner.avatarOverlap === false })}
                    role="switch"
                    aria-checked={banner.avatarOverlap !== false}
                  >
                    <span className="saas-toggle-thumb" />
                  </button>
                </div>

                <div className="saas-field">
                  <span className="saas-field-label">Header text alignment</span>
                  <div className="saas-density-row" role="radiogroup" aria-label="Header text alignment">
                    {HEADER_ALIGN_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={(banner.textAlign || "center") === option.value}
                        className={`saas-density-btn${(banner.textAlign || "center") === option.value ? " active" : ""}`}
                        onClick={() => handleBannerChange({ textAlign: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="saas-design-card">
            <p className="saas-design-kicker">Footer</p>
            <h3 className="saas-design-title">Footer branding</h3>

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

            <div className="saas-switch-row">
              <div>
                <span className="saas-field-label">Save and Share section</span>
                <p className="saas-design-copy">Show or hide the profile utility actions section.</p>
              </div>
              <button
                type="button"
                className={`saas-toggle${config.theme.showSaveShareSection !== false ? " on" : ""}`}
                onClick={() => handleThemeChange({ showSaveShareSection: config.theme.showSaveShareSection === false })}
                role="switch"
                aria-checked={config.theme.showSaveShareSection !== false}
              >
                <span className="saas-toggle-thumb" />
              </button>
            </div>

            <div className="saas-field">
              <span className="saas-field-label">Save and Share position</span>
              <div className="saas-density-row">
                {[
                  { value: "top", label: "Top" },
                  { value: "bottom", label: "Bottom" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`saas-density-btn${(config.theme.saveSharePosition || "bottom") === option.value ? " active" : ""}`}
                    onClick={() => handleThemeChange({ saveSharePosition: option.value as "top" | "bottom" })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="saas-design-copy">Choose whether utility actions appear below the header or at the bottom of the page.</p>
            </div>

            <div className="saas-field">
              <span className="saas-field-label">Save and Share alignment</span>
              <div className="saas-density-row" role="radiogroup" aria-label="Save and Share alignment">
                {(["left", "center", "right"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={(config.theme.saveShareAlignment || "center") === option}
                    className={`saas-density-btn${(config.theme.saveShareAlignment || "center") === option ? " active" : ""}`}
                    onClick={() => handleThemeChange({ saveShareAlignment: option })}
                  >
                    {option[0].toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="saas-field">
              <span className="saas-field-label">Save and Share actions</span>
              {[
                ["saveShareShowSaveContact", "Save Contact"],
                ["saveShareShowAppleWallet", "Apple Wallet"],
                ["saveShareShowGoogleWallet", "Google Wallet"],
                ["saveShareShowShareProfile", "Share Profile"],
                ["saveShareShowCopyLink", "Copy Link"],
                ["saveShareShowDownloadQr", "Download QR"],
              ].map(([key, label]) => {
                const enabled = (config.theme as any)[key] !== false;
                return (
                  <div className="saas-switch-row" key={key}>
                    <div>
                      <span className="saas-field-label">{label}</span>
                    </div>
                    <button
                      type="button"
                      className={`saas-toggle${enabled ? " on" : ""}`}
                      onClick={() => handleThemeChange({ [key]: !enabled } as any)}
                      role="switch"
                      aria-checked={enabled}
                    >
                      <span className="saas-toggle-thumb" />
                    </button>
                  </div>
                );
              })}
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
            <div className="saas-mobile-dev-card">
              <div>
                <p className="saas-sidebar-kicker">Profile Builder</p>
                <h3 className="saas-sidebar-title">Mobile Builder Is In Active Development</h3>
                <p className="saas-sidebar-subtitle">
                  For the best editing experience, please use the desktop builder. Your public Clutch Connect profile is still mobile-friendly and works for customers.
                </p>
              </div>
              <div className="saas-mobile-builder-header-actions">
                <button
                  type="button"
                  className="saas-sidebar-btn ghost"
                  onClick={() => router.push("/portal/connect")}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  className="saas-sidebar-btn ghost"
                  onClick={handlePreviewFocus}
                >
                  Preview
                </button>
              </div>
            </div>

            <div className="saas-mobile-body">
              <div className="saas-preview-center saas-preview-center-mobile" ref={previewRef}>
                <BuilderPreview
                  config={config}
                  profile={profile}
                  editablePreview={false}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={handlePreviewBlockSelect}
                  onSelectSection={handlePreviewSectionSelect}
                  onSelectSaveShare={handlePreviewSaveShareSelect}
                  onRemoveBlock={handlePreviewRemoveBlock}
                  onRemoveSection={handlePreviewRemoveSection}
                  onClearSelection={handlePreviewClearSelection}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className={`saas-workspace${useInspector && selectedBlock ? " has-inspector" : ""}`}>
            {/* Left panel */}
            <div className="saas-left-panel">
            <div className="saas-sidebar-header">
              <div className="saas-sidebar-header-copy">
                <p className="saas-sidebar-kicker">Profile Builder</p>
                <h2 className="saas-sidebar-title">Build your smart profile</h2>
                <p className="saas-sidebar-subtitle">Set up the page customers see when they tap your card or scan your QR code.</p>
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
                onSelectSection={handlePreviewSectionSelect}
                onSelectSaveShare={handlePreviewSaveShareSelect}
                onRemoveBlock={handlePreviewRemoveBlock}
                onRemoveSection={handlePreviewRemoveSection}
                onClearSelection={handlePreviewClearSelection}
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
