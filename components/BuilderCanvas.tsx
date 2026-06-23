"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Trash2, User, Mail, Phone, Share2, Link2, MapPin, ClipboardList, CalendarDays, Video, Star, Images, QrCode } from "lucide-react";
import { BuilderBlock, BuilderConfig } from "@/lib/builder-types";
import {
  removeBlockFromConfig,
  toggleBlockVisibility,
  updateBlockSettings,
  generateBlockId,
} from "@/lib/builder-config";
import {
  ProfileHeroEditor,
  ContactButtonsEditor,
  PhoneBlockEditor,
  BookingBlockEditor,
  SocialLinksEditor,
  ServicesEditor,
  TextSectionEditor,
  ImageBlockEditor,
  BusinessHoursEditor,
  FormBlockEditor,
  WalletButtonEditor,
  QRCodeBlockEditor,
} from "./builder/blockEditors";

interface BuilderCanvasProps {
  config: BuilderConfig;
  onConfigChange: (config: BuilderConfig) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
}

const BLOCK_LABELS: Record<string, string> = {
  "profile-hero": "Profile Hero",
  "contact-buttons": "Contact Buttons",
  "phone-button": "Phone Button",
  "email-button": "Email Button",
  "website-button": "Website Button",
  "directions-button": "Directions Button",
  "request-quote-button": "Request Quote",
  "social-media-links": "Social Media",
  "custom-link-button": "Custom Link",
  "image-banner": "Image Banner",
  "text-section": "Text Section",
  "business-hours": "Business Hours",
  "services-list": "Services List",
  "form-block": "Form Block",
  "apple-wallet-button": "Apple Wallet",
  "google-wallet-button": "Google Wallet",
  "qr-code-block": "QR Code",
};

const BLOCK_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  "profile-hero": User,
  "contact-buttons": Link2,
  "phone-button": Phone,
  "email-button": Mail,
  "website-button": Link2,
  "directions-button": MapPin,
  "request-quote-button": ClipboardList,
  "social-media-links": Share2,
  "custom-link-button": Link2,
  "image-banner": Images,
  "text-section": ClipboardList,
  "business-hours": CalendarDays,
  "services-list": Star,
  "form-block": ClipboardList,
  "apple-wallet-button": Link2,
  "google-wallet-button": Link2,
  "qr-code-block": QrCode,
};

export default function BuilderCanvas({
  config,
  onConfigChange,
  selectedBlockId,
  onSelectBlock,
}: BuilderCanvasProps) {
  const handleDeleteBlock = (blockId: string) => {
    const newConfig = removeBlockFromConfig(config, blockId);
    onConfigChange(newConfig);
    if (selectedBlockId === blockId) onSelectBlock(null);
  };

  const handleToggleVisibility = (blockId: string) => {
    onConfigChange(toggleBlockVisibility(config, blockId));
  };

  const handleUpdateSettings = (blockId: string, settings: Record<string, any>) => {
    onConfigChange(updateBlockSettings(config, blockId, settings));
  };

  const handleDuplicate = (block: BuilderBlock) => {
    const newBlock: BuilderBlock = {
      ...block,
      id: generateBlockId(block.type),
      order: block.order + 0.5,
    };
    const newBlocks = [...config.blocks, newBlock]
      .sort((a, b) => a.order - b.order)
      .map((b, i) => ({ ...b, order: i }));
    onConfigChange({ ...config, blocks: newBlocks });
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const blocks = [...config.blocks];
    [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
    onConfigChange({ ...config, blocks: blocks.map((b, i) => ({ ...b, order: i })) });
  };

  const handleMoveDown = (idx: number) => {
    if (idx === config.blocks.length - 1) return;
    const blocks = [...config.blocks];
    [blocks[idx], blocks[idx + 1]] = [blocks[idx + 1], blocks[idx]];
    onConfigChange({ ...config, blocks: blocks.map((b, i) => ({ ...b, order: i })) });
  };

  return (
    <div className="saas-canvas">
      <div className="saas-canvas-header">
        <span className="saas-canvas-title">Blocks</span>
        <span className="saas-block-badge">{config.blocks.length}</span>
      </div>

      <div className="saas-canvas-list">
        {config.blocks.length === 0 ? (
          <div className="saas-canvas-empty">
            <div className="saas-empty-icon">✦</div>
            <p>No blocks yet</p>
            <p className="saas-empty-sub">Switch to Library tab to add blocks</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {config.blocks.map((block, idx) => (
              <motion.div
                key={block.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: block.visible ? 1 : 0.45, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className={`saas-block-card${selectedBlockId === block.id ? " selected" : ""}${!block.visible ? " hidden" : ""}`}
              >
                {/* Block header row */}
                <div className="saas-block-row">
                  {/* Drag handle + icon + name */}
                  <button
                    type="button"
                    className="saas-block-main"
                    onClick={() => onSelectBlock(selectedBlockId === block.id ? null : block.id)}
                  >
                    <div className="saas-drag-handle" title="Drag to reorder">
                      <GripVertical size={14} strokeWidth={2} />
                    </div>
                    <div className="saas-block-icon-pill">
                      {(() => {
                        const Icon = BLOCK_ICONS[block.type] || Link2;
                        return <Icon size={15} strokeWidth={2} />;
                      })()}
                    </div>
                    <div className="saas-block-meta">
                      <span className="saas-block-name">{BLOCK_LABELS[block.type] || block.type}</span>
                      <span className="saas-block-index">#{idx + 1}</span>
                    </div>
                  </button>

                  {/* Action buttons */}
                  <div className="saas-block-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="saas-icon-btn"
                      onClick={() => handleMoveUp(idx)}
                      title="Move up"
                      disabled={idx === 0}
                    >↑</button>
                    <button
                      className="saas-icon-btn"
                      onClick={() => handleMoveDown(idx)}
                      title="Move down"
                      disabled={idx === config.blocks.length - 1}
                    >↓</button>
                    <button
                      className="saas-icon-btn"
                      onClick={() => handleDuplicate(block)}
                      title="Duplicate"
                    ><Copy size={14} strokeWidth={2} /></button>
                    <button
                      className="saas-icon-btn"
                      onClick={() => handleToggleVisibility(block.id)}
                      title={block.visible ? "Hide" : "Show"}
                    >
                      {block.visible ? <Eye size={14} strokeWidth={2} /> : <EyeOff size={14} strokeWidth={2} />}
                    </button>
                    <button
                      className="saas-icon-btn danger"
                      onClick={() => handleDeleteBlock(block.id)}
                      title="Delete"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                    <span className="saas-block-chevron" aria-hidden="true">
                      {selectedBlockId === block.id ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
                    </span>
                  </div>
                </div>

                {/* Settings panel (animated expand) */}
                <AnimatePresence>
                  {selectedBlockId === block.id && (
                    <motion.div
                      layout
                      className="saas-settings-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <div className="saas-settings-inner">
                        <BlockSettingsPanel
                          block={block}
                          onUpdate={(settings) => {
                            if (Object.prototype.hasOwnProperty.call(settings, "__toggleVisibility")) {
                              if (Boolean(settings.__toggleVisibility) !== block.visible) {
                                handleToggleVisibility(block.id);
                              }
                              return;
                            }
                            handleUpdateSettings(block.id, settings);
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
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
  switch (block.type as string) {
    case "profile-hero":
      return <ProfileHeroEditor block={block} onUpdate={onUpdate} />;

    case "text-section":
      return <TextSectionEditor block={block} onUpdate={onUpdate} />;

    case "image-banner":
      return <ImageBlockEditor block={block} onUpdate={onUpdate} />;

    case "services-list":
      return <ServicesEditor block={block} onUpdate={onUpdate} />;

    case "phone-button":
      return <PhoneBlockEditor block={block} onUpdate={onUpdate} />;

    case "email-button":
    case "website-button":
    case "directions-button":
      return <PhoneBlockEditor block={block} onUpdate={onUpdate} />;

    case "request-quote-button":
      return <BookingBlockEditor block={block} onUpdate={onUpdate} />;

    case "apple-wallet-button":
    case "google-wallet-button":
      return <WalletButtonEditor block={block} onUpdate={onUpdate} />;

    case "custom-link-button":
      return <BookingBlockEditor block={block} onUpdate={onUpdate} />;

    case "contact-buttons":
      return <ContactButtonsEditor block={block} onUpdate={onUpdate} />;

    case "social-media-links":
      return <SocialLinksEditor block={block} onUpdate={onUpdate} />;

    case "contact":
      return <ContactButtonsEditor block={block} onUpdate={onUpdate} />;

    case "social-links":
      return <SocialLinksEditor block={block} onUpdate={onUpdate} />;

    case "image-block":
      return <ImageBlockEditor block={block} onUpdate={onUpdate} />;

    case "business-hours":
      return <BusinessHoursEditor block={block} onUpdate={onUpdate} />;

    case "form-block":
      return <FormBlockEditor block={block} onUpdate={onUpdate} />;

    case "qr-code-block":
      return <QRCodeBlockEditor block={block} onUpdate={onUpdate} />;

    default:
      return <p className="saas-field-hint">No settings available for this block.</p>;
  }
}
