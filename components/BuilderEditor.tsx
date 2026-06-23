"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Palette, PlusCircle } from "lucide-react";
import { BuilderConfig, BlockType } from "@/lib/builder-types";
import { createDefaultBuilderConfig, addBlockToConfig } from "@/lib/builder-config";
import BlockLibrary from "./BlockLibrary";
import BuilderCanvas from "./BuilderCanvas";
import BuilderPreview from "./BuilderPreview";
import TemplateSelector from "./TemplateSelector";

type SidebarTab = "content" | "design" | "blocks";

const sidebarTabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "content", label: "Content", icon: <Layers size={15} /> },
  { id: "design", label: "Design", icon: <Palette size={15} /> },
  { id: "blocks", label: "Blocks", icon: <PlusCircle size={15} /> },
];

interface BuilderEditorProps {
  profile: any;
}

export default function BuilderEditor({ profile }: BuilderEditorProps) {
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("content");
  const savedConfigRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/connect/builder-config");
        const data = await res.json();
        setConfig(data.config);
        savedConfigRef.current = JSON.stringify(data.config);
        if (data.isDefault && data.config.blocks.length < 2) {
          setShowTemplates(true);
        }
      } catch {
        const def = createDefaultBuilderConfig(profile.theme_color);
        setConfig(def);
        savedConfigRef.current = JSON.stringify(def);
      }
    }
    loadConfig();
  }, [profile.theme_color]);

  const handleAddBlock = (type: BlockType) => {
    if (!config) return;
    const newConfig = addBlockToConfig(config, type);
    setConfig(newConfig);
    setIsDirty(true);
    setActiveSidebarTab("content");
  };

  const handleApplyTemplate = (templateConfig: BuilderConfig) => {
    setConfig(templateConfig);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/connect/builder-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (res.ok) {
        savedConfigRef.current = JSON.stringify(config);
        setIsDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // noop
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfigChange = (newConfig: BuilderConfig) => {
    setConfig(newConfig);
    setIsDirty(savedConfigRef.current !== JSON.stringify(newConfig));
    setSaveSuccess(false);
  };

  const handleToggleDarkMode = () => {
    if (!config) return;
    handleConfigChange({
      ...config,
      theme: { ...config.theme, darkMode: !config.theme.darkMode },
    });
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
            <button className="saas-pill-btn" onClick={() => setShowTemplates(true)}>
              Templates
            </button>
            <button
              className="saas-pill-btn"
              onClick={handleToggleDarkMode}
              title={config.theme.darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {config.theme.darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>
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
            <button
              className={`saas-save-btn${isSaving ? " loading" : ""}${isDirty ? " dirty" : ""}`}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </header>

        {/* 3-column layout */}
        <div className="saas-workspace">
          {/* Left panel */}
          <div className="saas-left-panel">
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
                  <BuilderCanvas
                    config={config}
                    onConfigChange={handleConfigChange}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                  />
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
                  <div className="saas-design-shell">
                    <div className="saas-design-card">
                      <p className="saas-design-kicker">Global styling</p>
                      <h3 className="saas-design-title">Design controls</h3>
                      <p className="saas-design-copy">Use this space for page-wide styling without leaving the builder.</p>
                    </div>

                    <div className="saas-design-card">
                      <label className="saas-field">
                        <span className="saas-field-label">Theme preset</span>
                        <select disabled>
                          <option>Coming soon</option>
                        </select>
                      </label>
                      <label className="saas-field">
                        <span className="saas-field-label">Page background</span>
                        <input type="text" value="Coming soon" disabled readOnly />
                      </label>
                      <label className="saas-field">
                        <span className="saas-field-label">Card background</span>
                        <input type="text" value="Coming soon" disabled readOnly />
                      </label>
                      <label className="saas-field">
                        <span className="saas-field-label">Accent color</span>
                        <input type="text" value={config.theme.accentColor || profile.theme_color || "#FFA665"} disabled readOnly />
                      </label>
                      <label className="saas-field">
                        <span className="saas-field-label">Button radius</span>
                        <input type="range" min="0" max="32" value="16" disabled readOnly />
                      </label>
                      <label className="saas-field">
                        <span className="saas-field-label">Glow strength</span>
                        <input type="range" min="0" max="100" value="35" disabled readOnly />
                      </label>
                    </div>
                  </div>
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
                  <BlockLibrary onAddBlock={handleAddBlock} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center preview */}
          <div className="saas-preview-center">
            <BuilderPreview config={config} profile={profile} />
          </div>
        </div>
      </div>

      <TemplateSelector
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleApplyTemplate}
      />
    </>
  );
}
