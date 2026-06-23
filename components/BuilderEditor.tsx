"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BuilderConfig, BlockType } from "@/lib/builder-types";
import { createDefaultBuilderConfig, addBlockToConfig } from "@/lib/builder-config";
import BlockLibrary from "./BlockLibrary";
import BuilderCanvas from "./BuilderCanvas";
import BuilderPreview from "./BuilderPreview";
import TemplateSelector from "./TemplateSelector";

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
  const [activeTab, setActiveTab] = useState<"blocks" | "library">("blocks");
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
    setActiveTab("blocks");
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
            <nav className="saas-tab-nav">
              <button
                className={`saas-tab${activeTab === "blocks" ? " active" : ""}`}
                onClick={() => setActiveTab("blocks")}
              >
                Blocks
              </button>
              <button
                className={`saas-tab${activeTab === "library" ? " active" : ""}`}
                onClick={() => setActiveTab("library")}
              >
                Library
              </button>
            </nav>
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
            <AnimatePresence mode="wait">
              {activeTab === "blocks" ? (
                <motion.div
                  key="blocks"
                  className="saas-panel-inner"
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
              ) : (
                <motion.div
                  key="library"
                  className="saas-panel-inner"
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
