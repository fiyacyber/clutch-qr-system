"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, MoreHorizontal, Trash2, User, Mail, Phone, Share2, Link2, MapPin, ClipboardList, CalendarDays, Video, Star, Images, QrCode, MessageCircleMore } from "lucide-react";
import { BuilderBlock, BuilderConfig } from "@/lib/builder-types";
import {
  removeBlockFromConfig,
  toggleBlockVisibility,
  updateBlockSettings,
  generateBlockId,
} from "@/lib/builder-config";
import {
  AvatarBlockEditor,
  BusinessNameBlockEditor,
  SubheaderBlockEditor,
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
  inlineEditing?: boolean;
  compactActions?: boolean;
}

const BLOCK_LABELS: Record<string, string> = {
  "profile-hero": "Profile Hero",
  "avatar-block": "Avatar",
  "business-name-block": "Business Name",
  "subheader-block": "Subheader",
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

const BLOCK_SUBTITLES: Record<string, string> = {
  "profile-hero": "Profile and branding",
  "avatar-block": "Photo and glow styling",
  "business-name-block": "Primary headline text",
  "subheader-block": "Secondary title text",
  "contact-buttons": "Pinned contact actions",
  "phone-button": "Single action",
  "email-button": "Single action",
  "website-button": "Single action",
  "directions-button": "Single action",
  "request-quote-button": "Lead capture CTA",
  "social-media-links": "Network links",
  "custom-link-button": "Custom destination",
  "image-banner": "Media block",
  "text-section": "Rich text block",
  "business-hours": "Business details",
  "services-list": "Offerings list",
  "form-block": "Lead form",
  "apple-wallet-button": "Wallet action",
  "google-wallet-button": "Wallet action",
  "qr-code-block": "Scan destination",
};

const BLOCK_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  "profile-hero": User,
  "avatar-block": User,
  "business-name-block": ClipboardList,
  "subheader-block": ClipboardList,
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

function resolveBlockIcon(block: BuilderBlock): React.ComponentType<{ size?: number; strokeWidth?: number }> {
  if (block.type === "phone-button") {
    const data = (block.data || block.settings || {}) as Record<string, any>;
    const behavior = data.behavior === "text" ? "sms" : data.behavior;
    return behavior === "sms" ? MessageCircleMore : Phone;
  }

  return BLOCK_ICONS[block.type] || Link2;
}

export default function BuilderCanvas({
  config,
  onConfigChange,
  selectedBlockId,
  onSelectBlock,
  inlineEditing = true,
  compactActions = false,
}: BuilderCanvasProps) {
  const [openActionMenu, setOpenActionMenu] = useState<{
    blockId: string;
    top: number;
    left: number;
    openDirection: "above" | "below";
  } | null>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const orderedBlocks = [...config.blocks].sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (!selectedBlockId || !selectedCardRef.current || !inlineEditing) return;
    selectedCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedBlockId, inlineEditing]);

  useEffect(() => {
    if (!openActionMenu) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".saas-block-menu-wrap") || target?.closest(".saas-action-menu")) return;
      setOpenActionMenu(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openActionMenu]);

  useEffect(() => {
    if (!openActionMenu) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionMenu(null);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [openActionMenu]);

  useEffect(() => {
    if (!openActionMenu) return;

    const closeOnScroll = () => setOpenActionMenu(null);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => window.removeEventListener("scroll", closeOnScroll, true);
  }, [openActionMenu]);

  const openBlockMenu = (blockId: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 146;
    const menuHeight = 222;
    const menuGap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const openBelow = rect.bottom + menuGap + menuHeight <= viewportHeight;
    const top = openBelow ? rect.bottom + menuGap : Math.max(8, rect.top - menuHeight - menuGap);
    const left = Math.min(Math.max(rect.right - menuWidth, 8), Math.max(8, viewportWidth - menuWidth - 8));

    setOpenActionMenu({
      blockId,
      top,
      left,
      openDirection: openBelow ? "below" : "above",
    });
  };

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

  const handleReorderBlocks = (blocks: BuilderBlock[]) => {
    onConfigChange({ ...config, blocks: blocks.map((block, index) => ({ ...block, order: index })) });
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const blocks = [...orderedBlocks];
    [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
    onConfigChange({ ...config, blocks: blocks.map((b, i) => ({ ...b, order: i })) });
  };

  const handleMoveDown = (idx: number) => {
    if (idx === orderedBlocks.length - 1) return;
    const blocks = [...orderedBlocks];
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
        {orderedBlocks.length === 0 ? (
          <div className="saas-canvas-empty">
            <div className="saas-empty-icon">✦</div>
            <p>No blocks yet</p>
            <p className="saas-empty-sub">Switch to Library tab to add blocks</p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={orderedBlocks}
            onReorder={handleReorderBlocks}
            className="saas-reorder-list"
            as="div"
          >
            <AnimatePresence initial={false}>
              {orderedBlocks.map((block, idx) => (
              <Reorder.Item
                key={block.id}
                value={block}
                as="div"
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: block.visible ? 1 : 0.45, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className={`saas-block-card${selectedBlockId === block.id ? " selected" : ""}${!block.visible ? " hidden" : ""}`}
                ref={selectedBlockId === block.id ? selectedCardRef : null}
                whileDrag={{ scale: 1.02, zIndex: 20 }}
              >
                {/* Block header row */}
                <div className="saas-block-row">
                  <div className="saas-drag-handle" title="Drag to reorder" aria-label="Drag to reorder block">
                    <GripVertical size={16} strokeWidth={2} />
                  </div>

                  {/* Icon + name */}
                  <button
                    type="button"
                    className="saas-block-main"
                    onClick={() => onSelectBlock(selectedBlockId === block.id ? null : block.id)}
                  >
                    <div className="saas-block-icon-pill">
                      {(() => {
                        const Icon = resolveBlockIcon(block);
                        return <Icon size={15} strokeWidth={2} />;
                      })()}
                    </div>
                    <div className="saas-block-meta">
                      <span className="saas-block-name">{BLOCK_LABELS[block.type] || block.type}</span>
                      <span className="saas-block-index">{BLOCK_SUBTITLES[block.type] || `Block #${idx + 1}`}</span>
                    </div>
                  </button>

                  {/* Action buttons */}
                  <div className="saas-block-actions" onClick={(e) => e.stopPropagation()}>
                    {compactActions ? (
                      <div className="saas-block-menu-wrap">
                        <button
                          className="saas-icon-btn saas-kebab-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (openActionMenu?.blockId === block.id) {
                              setOpenActionMenu(null);
                              return;
                            }
                            openBlockMenu(block.id, event.currentTarget);
                          }}
                          title="More actions"
                          aria-expanded={openActionMenu?.blockId === block.id}
                          aria-haspopup="menu"
                        >
                          <MoreHorizontal size={13} strokeWidth={1.9} />
                        </button>

                        <span className="saas-block-chevron" aria-hidden="true">
                          {selectedBlockId === block.id ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
                        </span>
                      </div>
                    ) : (
                      <>
                        <button
                          className="saas-icon-btn"
                          onClick={() => handleMoveUp(idx)}
                          title="Move up"
                          disabled={idx === 0}
                        ><ArrowUp size={14} strokeWidth={2} /></button>
                        <button
                          className="saas-icon-btn"
                          onClick={() => handleMoveDown(idx)}
                          title="Move down"
                          disabled={idx === orderedBlocks.length - 1}
                        ><ArrowDown size={14} strokeWidth={2} /></button>
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
                      </>
                    )}
                  </div>
                </div>

                {/* Settings panel (animated expand) */}
                <AnimatePresence>
                  {inlineEditing && selectedBlockId === block.id && (
                    <motion.div
                      layout
                      className="saas-settings-panel"
                      initial={{ maxHeight: 0, opacity: 0, y: -8 }}
                      animate={{ maxHeight: 1600, opacity: 1, y: 0 }}
                      exit={{ maxHeight: 0, opacity: 0, y: -8 }}
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
              </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      {typeof document !== "undefined" && openActionMenu
        ? createPortal(
            <AnimatePresence>
              <motion.div
                className="saas-action-menu"
                role="menu"
                initial={{ opacity: 0, y: openActionMenu.openDirection === "below" ? -4 : 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: openActionMenu.openDirection === "below" ? -4 : 4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                style={{ top: `${openActionMenu.top}px`, left: `${openActionMenu.left}px` }}
              >
                <button role="menuitem" onClick={() => { const id = openActionMenu.blockId; const index = orderedBlocks.findIndex((b) => b.id === id); if (index >= 0) handleMoveUp(index); setOpenActionMenu(null); }} disabled={(() => { const index = orderedBlocks.findIndex((b) => b.id === openActionMenu.blockId); return index <= 0; })()}>
                  Move up
                </button>
                <button role="menuitem" onClick={() => { const id = openActionMenu.blockId; const index = orderedBlocks.findIndex((b) => b.id === id); if (index >= 0) handleMoveDown(index); setOpenActionMenu(null); }} disabled={(() => { const index = orderedBlocks.findIndex((b) => b.id === openActionMenu.blockId); return index < 0 || index === orderedBlocks.length - 1; })()}>
                  Move down
                </button>
                <button role="menuitem" onClick={() => { const id = openActionMenu.blockId; const block = orderedBlocks.find((b) => b.id === id); if (block) handleDuplicate(block); setOpenActionMenu(null); }}>
                  Duplicate
                </button>
                <button role="menuitem" onClick={() => { handleToggleVisibility(openActionMenu.blockId); setOpenActionMenu(null); }}>
                  {orderedBlocks.find((b) => b.id === openActionMenu.blockId)?.visible ? "Hide" : "Show"}
                </button>
                <button role="menuitem" className="danger" onClick={() => { handleDeleteBlock(openActionMenu.blockId); setOpenActionMenu(null); }}>
                  Delete
                </button>
              </motion.div>
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}

interface BlockSettingsPanelProps {
  block: BuilderBlock;
  onUpdate: (settings: Record<string, any>) => void;
}

export function BlockSettingsPanel({ block, onUpdate }: BlockSettingsPanelProps) {
  switch (block.type as string) {
    case "profile-hero":
    case "avatar-block":
      return <AvatarBlockEditor block={block} onUpdate={onUpdate} />;

    case "business-name-block":
      return <BusinessNameBlockEditor block={block} onUpdate={onUpdate} />;

    case "subheader-block":
      return <SubheaderBlockEditor block={block} onUpdate={onUpdate} />;

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
