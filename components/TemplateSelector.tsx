"use client";

import { getTemplates } from "@/lib/templates";
import { BuilderConfig } from "@/lib/builder-types";

interface TemplateSelectorProps {
  onSelectTemplate: (config: BuilderConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function TemplateSelector({
  onSelectTemplate,
  isOpen,
  onClose,
}: TemplateSelectorProps) {
  const templates = getTemplates();

  if (!isOpen) return null;

  return (
    <div className="template-modal-overlay" onClick={onClose}>
      <div className="template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Choose a Template</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content">
          <p className="modal-subtitle">
            Start with a pre-built layout for your industry
          </p>

          <div className="template-grid">
            {templates.map((template) => (
              <button
                key={template.id}
                className="template-card"
                onClick={() => {
                  onSelectTemplate(template.config);
                  onClose();
                }}
              >
                <div className="template-icon">{template.icon}</div>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
