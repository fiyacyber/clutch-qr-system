"use client";

import { useState } from "react";
import { CUSTOM_LINK_ICONS, SOCIAL_ICONS } from "@/lib/icon-system";

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
}

export default function IconSelector({
  value,
  onChange,
  label = "Icon",
}: IconSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tabs = [
    { id: "emoji", label: "Emoji" },
    { id: "social", label: "Social" },
  ];
  const [activeTab, setActiveTab] = useState<"emoji" | "social">("emoji");

  return (
    <div className="icon-selector">
      <label className="icon-selector-label">
        {label}
        <div className="icon-selector-preview">
          <span className="icon-selector-current">
            {value || "🔗"}
          </span>
          <button
            type="button"
            className="icon-selector-trigger"
            onClick={() => setIsOpen(!isOpen)}
            title="Choose icon"
          >
            ▼
          </button>
        </div>
      </label>

      {isOpen && (
        <div className="icon-selector-modal">
          <div className="icon-selector-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`icon-selector-tab ${
                  activeTab === tab.id ? "active" : ""
                }`}
                onClick={() => setActiveTab(tab.id as "emoji" | "social")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="icon-selector-content">
            {activeTab === "emoji" && (
              <div className="icon-selector-grid">
                {CUSTOM_LINK_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`icon-option ${value === icon ? "selected" : ""}`}
                    onClick={() => {
                      onChange(icon);
                      setIsOpen(false);
                    }}
                    title="Select icon"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "social" && (
              <div className="icon-selector-grid">
                {Object.entries(SOCIAL_ICONS).map(([key, social]) => (
                  <button
                    key={key}
                    type="button"
                    className={`icon-option social-icon ${
                      value === key ? "selected" : ""
                    }`}
                    onClick={() => {
                      onChange(key);
                      setIsOpen(false);
                    }}
                    style={{
                      backgroundColor: social.color,
                      color: "white",
                    }}
                    title={social.name}
                  >
                    <span className="social-icon-text">{social.name.charAt(0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
