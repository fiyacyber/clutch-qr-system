"use client";

import { BuilderBlock, BuilderConfig } from "@/lib/builder-types";
import { removeBlockFromConfig, toggleBlockVisibility, updateBlockSettings } from "@/lib/builder-config";
import IconSelector from "./IconSelector";

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

    case "phone-button":
    case "email-button":
    case "website-button":
    case "directions-button":
      return (
        <div className="settings-panel">
          <label>
            Button Label
            <input
              type="text"
              value={block.settings.label || ""}
              onChange={(e) => handleChange("label", e.target.value)}
              placeholder={`e.g., ${block.type === "phone-button" ? "Call Us" : block.type === "email-button" ? "Send Email" : block.type === "website-button" ? "Visit Website" : "Get Directions"}`}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={block.settings.showIcon !== false}
              onChange={(e) => handleChange("showIcon", e.target.checked)}
            />
            Show icon
          </label>
        </div>
      );

    case "request-quote-button":
    case "apple-wallet-button":
    case "google-wallet-button":
      return (
        <div className="settings-panel">
          <label>
            Button Label
            <input
              type="text"
              value={block.settings.label || ""}
              onChange={(e) => handleChange("label", e.target.value)}
              placeholder={block.type === "request-quote-button" ? "Request Quote" : "Add to Wallet"}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={block.settings.showIcon !== false}
              onChange={(e) => handleChange("showIcon", e.target.checked)}
            />
            Show icon
          </label>
        </div>
      );

    case "custom-link-button":
      return (
        <div className="settings-panel">
          <label>
            Button Label
            <input
              type="text"
              value={block.settings.label || ""}
              onChange={(e) => handleChange("label", e.target.value)}
              placeholder="Click here"
            />
          </label>
          <label>
            URL
            <input
              type="text"
              value={block.settings.url || ""}
              onChange={(e) => handleChange("url", e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <IconSelector
            value={block.settings.icon || "🔗"}
            onChange={(icon) => handleChange("icon", icon)}
            label="Icon"
          />
        </div>
      );

    case "contact-buttons":
      return (
        <div className="settings-panel">
          <label>
            Layout Style
            <select
              value={block.settings.style || "grid"}
              onChange={(e) => handleChange("style", e.target.value)}
            >
              <option value="grid">Grid</option>
              <option value="stack">Stack</option>
              <option value="buttons">Buttons</option>
            </select>
          </label>
        </div>
      );

    case "social-media-links":
      return (
        <div className="settings-panel">
          <label>
            <input
              type="checkbox"
              checked={block.settings.showLabels !== false}
              onChange={(e) => handleChange("showLabels", e.target.checked)}
            />
            Show platform labels
          </label>
          <label>
            <input
              type="checkbox"
              checked={block.settings.showTooltips !== false}
              onChange={(e) => handleChange("showTooltips", e.target.checked)}
            />
            Show tooltips on hover
          </label>
        </div>
      );

    case "business-hours":
      return (
        <div className="settings-panel">
          <label>
            Section Title
            <input
              type="text"
              value={block.settings.title || ""}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Business Hours"
            />
          </label>
          <label>
            Monday
            <input
              type="text"
              value={block.settings.hours?.Monday || ""}
              onChange={(e) =>
                handleChange("hours", {
                  ...block.settings.hours,
                  Monday: e.target.value,
                })
              }
              placeholder="9:00 AM - 5:00 PM"
            />
          </label>
          <label>
            Tuesday
            <input
              type="text"
              value={block.settings.hours?.Tuesday || ""}
              onChange={(e) =>
                handleChange("hours", {
                  ...block.settings.hours,
                  Tuesday: e.target.value,
                })
              }
              placeholder="9:00 AM - 5:00 PM"
            />
          </label>
          <label>
            Wednesday
            <input
              type="text"
              value={block.settings.hours?.Wednesday || ""}
              onChange={(e) =>
                handleChange("hours", {
                  ...block.settings.hours,
                  Wednesday: e.target.value,
                })
              }
              placeholder="9:00 AM - 5:00 PM"
            />
          </label>
          <label>
            Thursday
            <input
              type="text"
              value={block.settings.hours?.Thursday || ""}
              onChange={(e) =>
                handleChange("hours", {
                  ...block.settings.hours,
                  Thursday: e.target.value,
                })
              }
              placeholder="9:00 AM - 5:00 PM"
            />
          </label>
          <label>
            Friday
            <input
              type="text"
              value={block.settings.hours?.Friday || ""}
              onChange={(e) =>
                handleChange("hours", {
                  ...block.settings.hours,
                  Friday: e.target.value,
                })
              }
              placeholder="9:00 AM - 5:00 PM"
            />
          </label>
          <label>
            Saturday
            <input
              type="text"
              value={block.settings.hours?.Saturday || ""}
              onChange={(e) =>
                handleChange("hours", {
                  ...block.settings.hours,
                  Saturday: e.target.value,
                })
              }
              placeholder="Closed"
            />
          </label>
          <label>
            Sunday
            <input
              type="text"
              value={block.settings.hours?.Sunday || ""}
              onChange={(e) =>
                handleChange("hours", {
                  ...block.settings.hours,
                  Sunday: e.target.value,
                })
              }
              placeholder="Closed"
            />
          </label>
        </div>
      );

    case "form-block":
      return (
        <div className="settings-panel">
          <label>
            Form Label
            <input
              type="text"
              value={block.settings.formLabel || ""}
              onChange={(e) => handleChange("formLabel", e.target.value)}
              placeholder="Contact Form"
            />
          </label>
          <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "8px" }}>
            Form configuration is available in the Forms section.
          </p>
        </div>
      );

    case "qr-code-block":
      return (
        <div className="settings-panel">
          <label>
            Label
            <input
              type="text"
              value={block.settings.label || ""}
              onChange={(e) => handleChange("label", e.target.value)}
              placeholder="Scan to save contact"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={block.settings.showLabel !== false}
              onChange={(e) => handleChange("showLabel", e.target.checked)}
            />
            Show label
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
