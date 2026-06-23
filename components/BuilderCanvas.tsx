"use client";

import { BuilderBlock, BuilderConfig } from "@/lib/builder-types";
import { removeBlockFromConfig, toggleBlockVisibility, updateBlockSettings } from "@/lib/builder-config";

interface BuilderCanvasProps {
  config: BuilderConfig;
  onConfigChange: (config: BuilderConfig) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
}

export default function BuilderCanvas({
  config,
  onConfigChange,
  selectedBlockId,
  onSelectBlock,
}: BuilderCanvasProps) {
  const handleDeleteBlock = (blockId: string) => {
    const newConfig = removeBlockFromConfig(config, blockId);
    onConfigChange(newConfig);
    if (selectedBlockId === blockId) {
      onSelectBlock(null);
    }
  };

  const handleToggleVisibility = (blockId: string) => {
    const newConfig = toggleBlockVisibility(config, blockId);
    onConfigChange(newConfig);
  };

  const handleUpdateSettings = (blockId: string, settings: Record<string, any>) => {
    const newConfig = updateBlockSettings(config, blockId, settings);
    onConfigChange(newConfig);
  };

  return (
    <div className="builder-canvas">
      <div className="canvas-header">
        <h3>Blocks</h3>
        <span className="block-count">{config.blocks.length}</span>
      </div>

      <div className="canvas-blocks">
        {config.blocks.length === 0 ? (
          <div className="canvas-empty">
            <p>No blocks yet</p>
            <p className="text-muted">Add blocks from the library on the left</p>
          </div>
        ) : (
          config.blocks.map((block, idx) => (
            <div
              key={block.id}
              className={`canvas-block ${selectedBlockId === block.id ? "selected" : ""} ${
                !block.visible ? "hidden" : ""
              }`}
              onClick={() => onSelectBlock(block.id)}
            >
              <div className="block-header">
                <div className="block-info">
                  <span className="block-order">{idx + 1}</span>
                  <span className="block-type">{block.type}</span>
                </div>
                <div className="block-actions">
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(block.id);
                    }}
                    title={block.visible ? "Hide" : "Show"}
                  >
                    {block.visible ? "👁️" : "👁️‍🗨️"}
                  </button>
                  <button
                    className="icon-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBlock(block.id);
                    }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {selectedBlockId === block.id && (
                <div className="block-settings">
                  <BlockSettingsPanel
                    block={block}
                    onUpdate={(settings) => handleUpdateSettings(block.id, settings)}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface BlockSettingsPanelProps {
  block: BuilderBlock;
  onUpdate: (settings: Record<string, any>) => void;
}

function BlockSettingsPanel({ block, onUpdate }: BlockSettingsPanelProps) {
  const handleChange = (key: string, value: any) => {
    onUpdate({
      [key]: value,
    });
  };

  // Simple settings based on block type
  switch (block.type) {
    case "profile-hero":
      return (
        <div className="settings-panel">
          <label>
            <input
              type="checkbox"
              checked={block.settings.showProfilePicture}
              onChange={(e) => handleChange("showProfilePicture", e.target.checked)}
            />
            Show profile picture
          </label>
          <label>
            <input
              type="checkbox"
              checked={block.settings.showName}
              onChange={(e) => handleChange("showName", e.target.checked)}
            />
            Show name
          </label>
          <label>
            <input
              type="checkbox"
              checked={block.settings.showTitle}
              onChange={(e) => handleChange("showTitle", e.target.checked)}
            />
            Show title
          </label>
          <label>
            <input
              type="checkbox"
              checked={block.settings.showBio}
              onChange={(e) => handleChange("showBio", e.target.checked)}
            />
            Show bio
          </label>
        </div>
      );

    case "text-section":
      return (
        <div className="settings-panel">
          <label>
            Heading
            <input
              type="text"
              value={block.settings.heading}
              onChange={(e) => handleChange("heading", e.target.value)}
              placeholder="Section heading"
            />
          </label>
          <label>
            Content
            <textarea
              value={block.settings.content}
              onChange={(e) => handleChange("content", e.target.value)}
              placeholder="Your text content"
              rows={4}
            />
          </label>
        </div>
      );

    case "image-banner":
      return (
        <div className="settings-panel">
          <label>
            Image URL
            <input
              type="text"
              value={block.settings.imageUrl}
              onChange={(e) => handleChange("imageUrl", e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            Alt text
            <input
              type="text"
              value={block.settings.altText}
              onChange={(e) => handleChange("altText", e.target.value)}
              placeholder="Describe the image"
            />
          </label>
          <label>
            Caption
            <input
              type="text"
              value={block.settings.caption}
              onChange={(e) => handleChange("caption", e.target.value)}
              placeholder="Optional caption"
            />
          </label>
        </div>
      );

    case "services-list":
      return (
        <div className="settings-panel">
          <label>
            Title
            <input
              type="text"
              value={block.settings.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Services"
            />
          </label>
          <label>
            Services (one per line)
            <textarea
              value={(block.settings.items || []).join("\n")}
              onChange={(e) =>
                handleChange("items", e.target.value.split("\n").filter(Boolean))
              }
              placeholder="Service 1&#10;Service 2&#10;Service 3"
              rows={4}
            />
          </label>
        </div>
      );

    default:
      return (
        <div className="settings-panel">
          <p className="text-muted">No settings available for this block</p>
        </div>
      );
  }
}
