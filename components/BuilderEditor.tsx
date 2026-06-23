"use client";

import { useEffect, useState } from "react";
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
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Load builder config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/connect/builder-config");
        const data = await res.json();
        setConfig(data.config);
        // Show templates if profile just created (no blocks yet)
        if (data.isDefault && data.config.blocks.length < 2) {
          setShowTemplates(true);
        }
      } catch (error) {
        console.error("Failed to load builder config:", error);
        setConfig(createDefaultBuilderConfig(profile.theme_color));
      }
    }

    loadConfig();
  }, [profile.theme_color]);

  const handleAddBlock = (type: BlockType) => {
    if (!config) return;
    const newConfig = addBlockToConfig(config, type);
    setConfig(newConfig);
  };

  const handleApplyTemplate = (templateConfig: BuilderConfig) => {
    setConfig(templateConfig);
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
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfigChange = (newConfig: BuilderConfig) => {
    setConfig(newConfig);
    setSaveSuccess(false);
  };

  if (!config) {
    return (
      <div className="builder-editor">
        <p>Loading builder...</p>
      </div>
    );
  }

  return (
    <>
      <div className="builder-editor">
        <div className="builder-header">
          <div>
            <h1>Profile Builder</h1>
            <p>Customize your profile with blocks</p>
          </div>
          <div className="builder-header-actions">
            <button
              className="btn secondary"
              onClick={() => setShowTemplates(true)}
            >
              Templates
            </button>
            {saveSuccess && <span className="save-indicator">✓ Saved</span>}
            <button
              className="btn primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        <div className="builder-layout">
          {/* Left Sidebar: Block Library */}
          <div className="builder-sidebar">
            <BlockLibrary onAddBlock={handleAddBlock} />
          </div>

          {/* Center: Canvas with Blocks */}
          <div className="builder-canvas-container">
            <BuilderCanvas
              config={config}
              onConfigChange={handleConfigChange}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
            />
          </div>

          {/* Right Panel: Live Preview */}
          <div className="builder-preview-panel">
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
