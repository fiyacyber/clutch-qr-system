"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronRight, ClipboardList, Copy, Eye, EyeOff, GripVertical, Images, Layers, Link2, Mail, MapPin, MessageCircleMore, MoreHorizontal, Pencil, Phone, Plus, QrCode, Share2, SlidersHorizontal, Star, Trash2, User } from "lucide-react";
import { BuilderBlock, BuilderConfig, ProfileSection } from "@/lib/builder-types";
import {
  addSectionToConfig,
  duplicateBlockInConfig,
  duplicateSectionInConfig,
  isRepeatableBlockType,
  MAX_PROFILE_SECTIONS,
  removeBlockFromConfig,
  removeSectionFromConfig,
  reorderBlocksWithinSection,
  reorderSectionsInConfig,
  toggleBlockVisibility,
  updateBlockSettings,
  updateSectionInConfig,
} from "@/lib/builder-config";
import {
  AvatarBlockEditor,
  BookingBlockEditor,
  BusinessHoursEditor,
  BusinessNameBlockEditor,
  ContactButtonsEditor,
  FormBlockEditor,
  ImageBlockEditor,
  PhoneBlockEditor,
  QRCodeBlockEditor,
  ServicesEditor,
  SocialLinksEditor,
  SubheaderBlockEditor,
  TextSectionEditor,
  WalletButtonEditor,
} from "./builder/blockEditors";
import FontFamilyPicker from "./FontFamilyPicker";
import PremiumColorPicker from "./PremiumColorPicker";

interface BuilderCanvasProps {
  config: BuilderConfig;
  onConfigChange: (config: BuilderConfig) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  focusedSectionId?: string | null;
  inlineEditing?: boolean;
  compactActions?: boolean;
  onRequestAddBlock?: (sectionId?: string) => void;
}

const SHARED_SECTION_ICON = Layers;

const BLOCK_LABELS: Record<string, string> = {
  "profile-hero": "Profile Header",
  "avatar-block": "Avatar",
  "business-name-block": "Profile Name",
  "subheader-block": "Title / Subtitle",
  "contact-buttons": "Contact Buttons",
  "phone-button": "Phone",
  "email-button": "Email",
  "website-button": "Website",
  "directions-button": "Directions",
  "request-quote-button": "Request / Booking Button",
  "social-media-links": "Social Links",
  "custom-link-button": "Link Button",
  "image-banner": "Image Block",
  "text-section": "Text Section",
  "business-hours": "Business Hours",
  "services-list": "Services",
  "form-block": "Lead Form",
  "apple-wallet-button": "Apple Wallet",
  "google-wallet-button": "Google Wallet",
  "qr-code-block": "QR Code",
};

const BLOCK_SUBTITLES: Record<string, string> = {
  "profile-hero": "Photo, name, and intro",
  "avatar-block": "Profile photo and badge",
  "business-name-block": "Your name or business name",
  "subheader-block": "Role, tagline, or short intro",
  "contact-buttons": "Pinned contact actions",
  "phone-button": "Let visitors call or text",
  "email-button": "Let visitors email you",
  "website-button": "Send visitors to your site",
  "directions-button": "Send visitors to your map listing",
  "request-quote-button": "Collect requests or bookings",
  "social-media-links": "Instagram, Facebook, LinkedIn, and more",
  "custom-link-button": "Add a custom button",
  "image-banner": "Promo image or visual section",
  "text-section": "A short note or page section",
  "business-hours": "Show when you are open",
  "services-list": "List what you offer",
  "form-block": "Collect inquiries from your profile",
  "apple-wallet-button": "Let customers save your card",
  "google-wallet-button": "Let customers save your card",
  "qr-code-block": "Show a scannable QR code",
};

const BLOCK_GROUP_LABELS: Record<string, string> = {
  "profile-hero": "Header",
  "avatar-block": "Header",
  "business-name-block": "Header",
  "subheader-block": "Header",
  "contact-buttons": "Contact",
  "phone-button": "Contact",
  "email-button": "Contact",
  "website-button": "Contact",
  "directions-button": "Contact",
  "social-media-links": "Socials",
  "custom-link-button": "Links",
  "request-quote-button": "More",
  "image-banner": "More",
  "text-section": "More",
  "business-hours": "More",
  "services-list": "More",
  "form-block": "More",
  "apple-wallet-button": "More",
  "google-wallet-button": "More",
  "qr-code-block": "More",
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

const SECTION_TITLE_MAX_CHARS = 40;

function resolveBlockIcon(block: BuilderBlock): React.ComponentType<{ size?: number; strokeWidth?: number }> {
  if (block.type === "phone-button") {
    const data = (block.data || block.settings || {}) as Record<string, any>;
    return data.behavior === "sms" || data.behavior === "text" ? MessageCircleMore : Phone;
  }
  return BLOCK_ICONS[block.type] || Link2;
}

function canAssignSection(block: BuilderBlock): boolean {
  return !["profile-hero", "avatar-block", "business-name-block", "subheader-block"].includes(String(block.type));
}

function canDeleteBlock(block: BuilderBlock): boolean {
  return block.type !== "avatar-block";
}

function getBlockGroupLabel(block: BuilderBlock): string {
  return BLOCK_GROUP_LABELS[block.type] || "More";
}

export default function BuilderCanvas({
  config,
  onConfigChange,
  selectedBlockId,
  onSelectBlock,
  focusedSectionId,
  inlineEditing = true,
  compactActions = false,
  onRequestAddBlock,
}: BuilderCanvasProps) {
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    () => {
      const sorted = [...(config.sections || [])].sort((a, b) => a.order - b.order);
      return sorted[0]?.id ?? null;
    }
  );
  const [openMenuSectionId, setOpenMenuSectionId] = useState<string | null>(null);
  const [openMenuBlockId, setOpenMenuBlockId] = useState<string | null>(null);
  const [designOpenId, setDesignOpenId] = useState<string | null>(null);
  const [headerBlocksOpen, setHeaderBlocksOpen] = useState(true);
  const [sectionBlocksOpen, setSectionBlocksOpen] = useState(true);
  const [sectionTitleError, setSectionTitleError] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropSectionId, setDropSectionId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<{ sectionId: string; index: number } | null>(null);

  const orderedBlocks = [...config.blocks].sort((a, b) => a.order - b.order);
  const sections = [...(config.sections || [])].sort((a, b) => a.order - b.order);
  const reachedSectionLimit = sections.length >= MAX_PROFILE_SECTIONS;
  const heroOrder: Record<string, number> = {
    "profile-hero": 0,
    "avatar-block": 1,
    "business-name-block": 2,
    "subheader-block": 3,
  };
  const heroBlocks = orderedBlocks
    .filter((block) => !canAssignSection(block))
    .sort((a, b) => (heroOrder[a.type] ?? 99) - (heroOrder[b.type] ?? 99));

  // Close more-menu on outside click
  useEffect(() => {
    if (!openMenuSectionId && !openMenuBlockId) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".saas-block-menu-wrap")) return;
      setOpenMenuSectionId(null);
      setOpenMenuBlockId(null);
    };

    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [openMenuSectionId, openMenuBlockId]);

  useEffect(() => {
    if (!selectedBlockId || !selectedCardRef.current || !inlineEditing) return;
    selectedCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedBlockId, inlineEditing]);

  useEffect(() => {
    if (!focusedSectionId) return;
    if (sections.some((section) => section.id === focusedSectionId)) {
      setExpandedSectionId(focusedSectionId);
      setSectionBlocksOpen(true);
    }
  }, [focusedSectionId, sections]);

  const handleDeleteBlock = (blockId: string) => {
    const targetBlock = config.blocks.find((block) => block.id === blockId);
    if (targetBlock?.type === "avatar-block") return;

    const next = removeBlockFromConfig(config, blockId);
    onConfigChange(next);
    if (selectedBlockId === blockId) onSelectBlock(null);
  };

  const handleDuplicateBlock = (blockId: string) => {
    const next = duplicateBlockInConfig(config, blockId);
    if (next === config) return;
    const beforeIds = new Set(config.blocks.map((block) => block.id));
    const duplicatedBlock = next.blocks.find((block) => !beforeIds.has(block.id));
    onConfigChange(next);
    if (duplicatedBlock) {
      onSelectBlock(duplicatedBlock.id);
    }
  };

  const handleMoveWithinSection = (sectionId: string, sourceIdx: number, direction: -1 | 1) => {
    const sectionBlocks = orderedBlocks.filter((block) => block.sectionId === sectionId);
    const targetIdx = sourceIdx + direction;
    if (targetIdx < 0 || targetIdx >= sectionBlocks.length) return;
    const reordered = [...sectionBlocks];
    [reordered[sourceIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[sourceIdx]];
    onConfigChange(reorderBlocksWithinSection(config, sectionId, reordered.map((block) => block.id)));
  };

  const handleMoveHeaderBlock = (sourceIdx: number, direction: -1 | 1) => {
    const targetIdx = sourceIdx + direction;
    if (targetIdx < 0 || targetIdx >= heroBlocks.length) return;
    const reordered = [...heroBlocks];
    [reordered[sourceIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[sourceIdx]];
    const orderMap = new Map(reordered.map((block, index) => [block.id, index]));
    const nextBlocks = [...orderedBlocks]
      .sort((a, b) =>
        orderMap.has(a.id) && orderMap.has(b.id)
          ? (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
          : a.order - b.order
      )
      .map((block, index) => ({ ...block, order: index }));
    onConfigChange({ ...config, blocks: nextBlocks });
  };

  const handleReorderSection = (sectionId: string, values: BuilderBlock[]) => {
    onConfigChange(reorderBlocksWithinSection(config, sectionId, values.map((block) => block.id)));
  };

  const handleReorderSections = (values: ProfileSection[]) => {
    onConfigChange(reorderSectionsInConfig(config, values.map((section) => section.id)));
  };

  const resolveDraggedBlockId = (event: React.DragEvent): string | null => {
    const fromTransfer = event.dataTransfer.getData("application/x-clutch-block-id") || event.dataTransfer.getData("text/plain");
    return fromTransfer || draggedBlockId;
  };

  const moveBlockToSectionAtIndex = (blockId: string, targetSectionId: string, insertIndex: number) => {
    const targetBlock = config.blocks.find((block) => block.id === blockId);
    if (!targetBlock || !canAssignSection(targetBlock)) return;

    const sectionIdSet = new Set(sections.map((section) => section.id));
    const orderById = new Map(orderedBlocks.map((block, index) => [block.id, index]));
    const movedBlocks = orderedBlocks.map((block) =>
      block.id === blockId ? { ...block, sectionId: targetSectionId } : block
    );

    const hero = movedBlocks
      .filter((block) => !canAssignSection(block))
      .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0));

    const sectionAssigned: BuilderBlock[] = [];
    sections.forEach((section) => {
      let bucket = movedBlocks
        .filter((block) => canAssignSection(block) && block.sectionId === section.id)
        .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0));

      if (section.id === targetSectionId) {
        const currentIndex = bucket.findIndex((block) => block.id === blockId);
        bucket = bucket.filter((block) => block.id !== blockId);
        let adjustedIndex = insertIndex;
        if (currentIndex >= 0 && currentIndex < adjustedIndex) {
          adjustedIndex -= 1;
        }
        const clampedIndex = Math.max(0, Math.min(bucket.length, adjustedIndex));
        bucket.splice(clampedIndex, 0, { ...targetBlock, sectionId: targetSectionId });
      }

      sectionAssigned.push(...bucket);
    });

    const unassigned = movedBlocks
      .filter((block) => canAssignSection(block) && (!block.sectionId || !sectionIdSet.has(block.sectionId)))
      .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0));

    const nextBlocks = [...hero, ...sectionAssigned, ...unassigned].map((block, index) => ({ ...block, order: index }));
    onConfigChange({ ...config, blocks: nextBlocks });
  };

  const handleSectionDragOver = (event: React.DragEvent, sectionId: string) => {
    const blockId = resolveDraggedBlockId(event);
    if (!blockId) return;
    const block = config.blocks.find((item) => item.id === blockId);
    if (!block || !canAssignSection(block)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropSectionId !== sectionId) {
      setDropSectionId(sectionId);
    }
    const sectionBlocks = orderedBlocks.filter((item) => item.sectionId === sectionId);
    setDropPosition({ sectionId, index: sectionBlocks.length });
  };

  const handleSectionDragLeave = (event: React.DragEvent, sectionId: string) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    if (dropSectionId === sectionId) {
      setDropSectionId(null);
    }
    if (dropPosition?.sectionId === sectionId) {
      setDropPosition(null);
    }
  };

  const handleSectionDrop = (event: React.DragEvent, sectionId: string) => {
    const blockId = resolveDraggedBlockId(event);
    event.preventDefault();
    setDropSectionId(null);
    setDraggedBlockId(null);
    setDropPosition(null);
    if (!blockId) return;
    const sectionBlocks = orderedBlocks.filter((item) => item.sectionId === sectionId);
    moveBlockToSectionAtIndex(blockId, sectionId, sectionBlocks.length);
    setExpandedSectionId(sectionId);
    setSectionBlocksOpen(true);
  };

  const computeDropIndexForBlock = (event: React.DragEvent, sectionId: string, targetBlockId: string): number | null => {
    const sectionBlocks = orderedBlocks.filter((item) => item.sectionId === sectionId);
    const targetIndex = sectionBlocks.findIndex((item) => item.id === targetBlockId);
    if (targetIndex < 0) return null;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    return targetIndex + (insertAfter ? 1 : 0);
  };

  const handleBlockDragOver = (event: React.DragEvent, sectionId: string, targetBlockId: string) => {
    const blockId = resolveDraggedBlockId(event);
    if (!blockId) return;
    const block = config.blocks.find((item) => item.id === blockId);
    if (!block || !canAssignSection(block)) return;

    const insertIndex = computeDropIndexForBlock(event, sectionId, targetBlockId);
    if (insertIndex == null) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropSectionId !== sectionId) {
      setDropSectionId(sectionId);
    }
    if (!dropPosition || dropPosition.sectionId !== sectionId || dropPosition.index !== insertIndex) {
      setDropPosition({ sectionId, index: insertIndex });
    }
  };

  const handleBlockDrop = (event: React.DragEvent, sectionId: string, targetBlockId: string) => {
    const blockId = resolveDraggedBlockId(event);
    if (!blockId) return;

    const insertIndex = computeDropIndexForBlock(event, sectionId, targetBlockId);
    if (insertIndex == null) return;

    event.preventDefault();
    setDropSectionId(null);
    setDropPosition(null);
    setDraggedBlockId(null);
    moveBlockToSectionAtIndex(blockId, sectionId, insertIndex);
    setExpandedSectionId(sectionId);
    setSectionBlocksOpen(true);
  };

  const renderBlockCard = (
    block: BuilderBlock,
    idx: number,
    sectionId?: string,
    sectionLength?: number,
    isDropBefore?: boolean,
    isDropAfter?: boolean
  ) => (
    <Reorder.Item
      key={block.id}
      value={block}
      as="div"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: block.visible ? 1 : 0.45, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`saas-block-card${selectedBlockId === block.id ? " selected" : ""}${!block.visible ? " hidden" : ""}${openMenuBlockId === block.id ? " menu-open" : ""}${isDropBefore ? " is-drop-before" : ""}${isDropAfter ? " is-drop-after" : ""}`}
      ref={selectedBlockId === block.id ? selectedCardRef : null}
      whileDrag={{ scale: 1.01, zIndex: 20 }}
      onDragOver={sectionId ? (event) => handleBlockDragOver(event, sectionId, block.id) : undefined}
      onDrop={sectionId ? (event) => handleBlockDrop(event, sectionId, block.id) : undefined}
    >
      <div className="saas-block-row">
        <div className="saas-drag-handle" title="Drag to reorder" aria-label="Drag to reorder block">
          <div
            draggable={canAssignSection(block)}
            onDragStart={(event) => {
              if (!canAssignSection(block)) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-clutch-block-id", block.id);
              event.dataTransfer.setData("text/plain", block.id);
              setDraggedBlockId(block.id);
              setOpenMenuBlockId(null);
              setOpenMenuSectionId(null);
            }}
            onDragEnd={() => {
              setDraggedBlockId(null);
              setDropSectionId(null);
              setDropPosition(null);
            }}
          >
          <GripVertical size={16} strokeWidth={2} />
          </div>
        </div>
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
            <span className="saas-block-index">
              <span className="saas-block-group-label">{getBlockGroupLabel(block)}</span>
              <span>{BLOCK_SUBTITLES[block.type] || `Block #${idx + 1}`}</span>
            </span>
          </div>
        </button>
        <div className="saas-block-actions" onClick={(event) => event.stopPropagation()}>
          {!compactActions ? (
            <>
              <button className="saas-icon-btn" onClick={() => sectionId && handleMoveWithinSection(sectionId, idx, -1)} title="Move up" disabled={!sectionId || idx === 0}><ArrowUp size={14} strokeWidth={2} /></button>
              <button className="saas-icon-btn" onClick={() => sectionId && handleMoveWithinSection(sectionId, idx, 1)} title="Move down" disabled={!sectionId || !sectionLength || idx === sectionLength - 1}><ArrowDown size={14} strokeWidth={2} /></button>
              {isRepeatableBlockType(block.type) ? <button className="saas-icon-btn" onClick={() => handleDuplicateBlock(block.id)} title="Duplicate"><Copy size={14} strokeWidth={2} /></button> : null}
              <button className="saas-icon-btn" onClick={() => onConfigChange(toggleBlockVisibility(config, block.id))} title={block.visible ? "Hide" : "Show"}>
                {block.visible ? <Eye size={14} strokeWidth={2} /> : <EyeOff size={14} strokeWidth={2} />}
              </button>
              {canDeleteBlock(block) ? <button className="saas-icon-btn danger" onClick={() => handleDeleteBlock(block.id)} title="Delete"><Trash2 size={14} strokeWidth={2} /></button> : null}
            </>
          ) : (
            <div className={`saas-block-menu-wrap${openMenuBlockId === block.id ? " is-open" : ""}`}>
              <button
                type="button"
                className="saas-icon-btn saas-kebab-btn"
                aria-label="Block options"
                aria-haspopup="true"
                aria-expanded={openMenuBlockId === block.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuBlockId((prev) => (prev === block.id ? null : block.id));
                }}
              >
                <MoreHorizontal size={15} strokeWidth={2} />
              </button>
              {openMenuBlockId === block.id ? (
                <div className="saas-action-menu">
                  {sectionId ? (
                    <>
                      <button type="button" disabled={idx === 0} onClick={(e) => {
                        e.stopPropagation();
                        handleMoveWithinSection(sectionId, idx, -1);
                        setOpenMenuBlockId(null);
                      }}><ArrowUp size={13} />&nbsp; Move Up</button>
                      <button type="button" disabled={!sectionLength || idx === sectionLength - 1} onClick={(e) => {
                        e.stopPropagation();
                        handleMoveWithinSection(sectionId, idx, 1);
                        setOpenMenuBlockId(null);
                      }}><ArrowDown size={13} />&nbsp; Move Down</button>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled={idx === 0} onClick={(e) => {
                        e.stopPropagation();
                        handleMoveHeaderBlock(idx, -1);
                        setOpenMenuBlockId(null);
                      }}><ArrowUp size={13} />&nbsp; Move Up</button>
                      <button type="button" disabled={idx === heroBlocks.length - 1} onClick={(e) => {
                        e.stopPropagation();
                        handleMoveHeaderBlock(idx, 1);
                        setOpenMenuBlockId(null);
                      }}><ArrowDown size={13} />&nbsp; Move Down</button>
                    </>
                  )}
                  <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    onConfigChange(toggleBlockVisibility(config, block.id));
                    setOpenMenuBlockId(null);
                  }}>
                    {block.visible ? <><EyeOff size={13} />&nbsp; Hide</> : <><Eye size={13} />&nbsp; Show</>}
                  </button>
                  {isRepeatableBlockType(block.type) ? <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateBlock(block.id);
                    setOpenMenuBlockId(null);
                  }}><Copy size={13} />&nbsp; Duplicate</button> : null}
                  {canDeleteBlock(block) ? <button type="button" className="danger" onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBlock(block.id);
                    setOpenMenuBlockId(null);
                  }}><Trash2 size={13} />&nbsp; Delete</button> : null}
                </div>
              ) : null}
            </div>
          )}
          <span className="saas-block-chevron" aria-hidden="true">
            {selectedBlockId === block.id ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
          </span>
        </div>
      </div>
      <AnimatePresence>
        {inlineEditing && selectedBlockId === block.id ? (
          <motion.div
            layout
            className="saas-settings-panel"
            initial={{ maxHeight: 0, opacity: 0, y: -8 }}
            animate={{ maxHeight: 1600, opacity: 1, y: 0 }}
            exit={{ maxHeight: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="saas-settings-inner">
              <BlockSettingsPanel
                block={block}
                onUpdate={(settings) => {
                  if (Object.prototype.hasOwnProperty.call(settings, "__toggleVisibility")) {
                    if (Boolean(settings.__toggleVisibility) !== block.visible) {
                      onConfigChange(toggleBlockVisibility(config, block.id));
                    }
                    return;
                  }
                  onConfigChange(updateBlockSettings(config, block.id, settings));
                }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Reorder.Item>
  );

  const renderSectionDesignFields = (section: ProfileSection) => (
    <div className="saas-fields">
      <label className="saas-field">
        <span className="saas-field-label">Alignment</span>
        <select value={section.style.alignment} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { alignment: e.target.value as any } }))}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Font size ({section.style.fontSize}px)</span>
        <input type="range" min="10" max="24" step="1" value={section.style.fontSize} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { fontSize: Number(e.target.value) } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Font weight</span>
        <select value={String(section.style.fontWeight)} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { fontWeight: Number(e.target.value) } }))}>
          <option value="500">Medium</option>
          <option value="600">Semibold</option>
          <option value="700">Bold</option>
          <option value="800">Extra Bold</option>
          <option value="900">Black</option>
        </select>
      </label>
      <div className="saas-field">
        <span className="saas-field-label">Font family</span>
        <FontFamilyPicker
          value={section.style.fontFamily || "inherit"}
          allowInherit
          onChange={(value) => onConfigChange(updateSectionInConfig(config, section.id, { style: { fontFamily: value } }))}
        />
      </div>
      <label className="saas-field">
        <span className="saas-field-label">Letter spacing ({section.style.letterSpacing}px)</span>
        <input type="range" min="0" max="6" step="0.5" value={section.style.letterSpacing} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { letterSpacing: Number(e.target.value) } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Text transform</span>
        <select value={section.style.textTransform} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { textTransform: e.target.value as any } }))}>
          <option value="uppercase">Uppercase</option>
          <option value="none">None</option>
        </select>
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Text color</span>
        <input type="text" value={section.style.textColor} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { textColor: e.target.value } }))} placeholder="#FFFFFF" />
        <PremiumColorPicker
          value={section.style.textColor || "#FFFFFF"}
          onChange={(color) => onConfigChange(updateSectionInConfig(config, section.id, { style: { textColor: color } }))}
          ariaLabel="Section title color"
          buttonText="Choose Color"
          presets={[]}
        />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Background color</span>
        <input type="text" value={section.style.backgroundColor} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { backgroundColor: e.target.value } }))} placeholder="#FFFFFF" />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Border color</span>
        <input type="text" value={section.style.borderColor} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { borderColor: e.target.value } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Border width ({section.style.borderWidth}px)</span>
        <input type="range" min="0" max="8" step="1" value={section.style.borderWidth} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { borderWidth: Number(e.target.value) } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Border radius ({section.style.borderRadius}px)</span>
        <input type="range" min="0" max="999" step="1" value={section.style.borderRadius} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { borderRadius: Number(e.target.value) } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Padding X ({section.style.paddingX}px)</span>
        <input type="range" min="0" max="36" step="1" value={section.style.paddingX} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { paddingX: Number(e.target.value) } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Padding Y ({section.style.paddingY}px)</span>
        <input type="range" min="0" max="28" step="1" value={section.style.paddingY} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { paddingY: Number(e.target.value) } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Margin top ({section.style.marginTop}px)</span>
        <input type="range" min="0" max="40" step="1" value={section.style.marginTop} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { marginTop: Number(e.target.value) } }))} />
      </label>
      <label className="saas-field">
        <span className="saas-field-label">Margin bottom ({section.style.marginBottom}px)</span>
        <input type="range" min="0" max="40" step="1" value={section.style.marginBottom} onChange={(e) => onConfigChange(updateSectionInConfig(config, section.id, { style: { marginBottom: Number(e.target.value) } }))} />
      </label>
    </div>
  );

  return (
    <div className="saas-canvas">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="saas-canvas-header">
        <div className="saas-canvas-header-left">
          <span className="saas-canvas-title">Sections</span>
          <span className="saas-block-badge">{sections.length}</span>
        </div>
        <button
          type="button"
          className="saas-mini-btn"
          disabled={reachedSectionLimit}
          title={reachedSectionLimit ? `Maximum of ${MAX_PROFILE_SECTIONS} sections reached` : undefined}
          onClick={() => {
            if (reachedSectionLimit) return;
            const next = addSectionToConfig(config, "New Section");
            onConfigChange(next);
            const sorted = [...(next.sections || [])].sort((a, b) => a.order - b.order);
            setExpandedSectionId(sorted[sorted.length - 1]?.id ?? null);
          }}
        >
          <Plus size={13} /> Add section
        </button>
      </div>

      <div className="saas-canvas-list">
        {sections.length ? (
          /* ── Section cards ──────────────────────────────────── */
          <Reorder.Group axis="y" values={sections} onReorder={handleReorderSections} className="builder-sections-list" as="div">
            {sections.map((section) => {
              const sectionBlocks = orderedBlocks.filter((b) => b.sectionId === section.id);
              const isExpanded = expandedSectionId === section.id;
              const isMenuOpen = openMenuSectionId === section.id;
              const isDropTarget = dropSectionId === section.id;
              const SectionIcon = SHARED_SECTION_ICON;
              return (
                <Reorder.Item
                  key={section.id}
                  value={section}
                  as="div"
                  layout
                  className={`builder-section-card${isExpanded ? " is-expanded" : ""}${!section.visible ? " is-hidden" : ""}${isMenuOpen ? " is-menu-open" : ""}${isDropTarget ? " is-drop-target" : ""}`}
                  whileDrag={{ scale: 1.015, zIndex: 30, boxShadow: "0 18px 42px rgba(0,0,0,0.45)" }}
                  onDragOver={(event) => handleSectionDragOver(event, section.id)}
                  onDragLeave={(event) => handleSectionDragLeave(event, section.id)}
                  onDrop={(event) => handleSectionDrop(event, section.id)}
                >
                <div
                  className="builder-section-header"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => {
                    if (!section.visible) {
                      onConfigChange(updateSectionInConfig(config, section.id, { visible: true }));
                    }
                    setExpandedSectionId(isExpanded ? null : section.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!section.visible) {
                        onConfigChange(updateSectionInConfig(config, section.id, { visible: true }));
                      }
                      setExpandedSectionId(isExpanded ? null : section.id);
                    }
                  }}
                >
                  <div className="saas-drag-handle" aria-label="Drag to reorder section" onClick={(e) => e.stopPropagation()}>
                    <GripVertical size={15} strokeWidth={2} />
                  </div>
                  <div className="builder-section-icon">
                    <SectionIcon size={15} strokeWidth={2} />
                  </div>
                  <div className="builder-section-info">
                    <span className="builder-section-title">{section.label || "Untitled"}</span>
                    <span className="builder-section-meta">
                      {sectionBlocks.length} {sectionBlocks.length === 1 ? "item" : "items"}
                      {!section.visible && <span className="builder-section-hidden-tag"> · Hidden</span>}
                    </span>
                  </div>
                  <div className="builder-section-actions" onClick={(e) => e.stopPropagation()}>
                    <div className={`saas-block-menu-wrap${isMenuOpen ? " is-open" : ""}`}>
                      <button
                        type="button"
                        className="saas-icon-btn saas-kebab-btn"
                        aria-label="Section options"
                        aria-haspopup="true"
                        aria-expanded={isMenuOpen}
                        onClick={(e) => { e.stopPropagation(); setOpenMenuSectionId(isMenuOpen ? null : section.id); }}
                      >
                        <MoreHorizontal size={15} strokeWidth={2} />
                      </button>
                      {isMenuOpen && (
                        <div className="saas-action-menu builder-section-menu">
                          <button type="button" onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSectionId(section.id);
                            setOpenMenuSectionId(null);
                            requestAnimationFrame(() => (document.getElementById(`sec-label-${section.id}`) as HTMLInputElement | null)?.focus());
                          }}><Pencil size={13} />&nbsp; Rename</button>
                          <button type="button" onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSectionId(section.id);
                            setDesignOpenId((prev) => (prev === section.id ? null : section.id));
                            setOpenMenuSectionId(null);
                          }}><SlidersHorizontal size={13} />&nbsp; Section Design</button>
                          <button
                            type="button"
                            disabled={reachedSectionLimit}
                            title={reachedSectionLimit ? `Maximum of ${MAX_PROFILE_SECTIONS} sections reached` : undefined}
                            onClick={(e) => {
                            e.stopPropagation();
                            if (reachedSectionLimit) return;
                            onConfigChange(duplicateSectionInConfig(config, section.id));
                            setOpenMenuSectionId(null);
                          }}><Copy size={13} />&nbsp; Duplicate</button>
                          <button type="button" onClick={(e) => {
                            e.stopPropagation();
                            onConfigChange(updateSectionInConfig(config, section.id, { visible: !section.visible }));
                            setOpenMenuSectionId(null);
                          }}>
                            {section.visible ? <><EyeOff size={13} />&nbsp; Hide</> : <><Eye size={13} />&nbsp; Show</>}
                          </button>
                          <button type="button" className="danger" onClick={(e) => {
                            e.stopPropagation();
                            onConfigChange(removeSectionFromConfig(config, section.id));
                            if (expandedSectionId === section.id) setExpandedSectionId(null);
                            setOpenMenuSectionId(null);
                          }}><Trash2 size={13} />&nbsp; Delete</button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="saas-icon-btn"
                      aria-label={isExpanded ? "Collapse section" : "Expand section"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!section.visible) {
                          onConfigChange(updateSectionInConfig(config, section.id, { visible: true }));
                        }
                        setExpandedSectionId(isExpanded ? null : section.id);
                      }}
                    >
                      <ChevronDown size={15} strokeWidth={2} className={`builder-section-chevron${isExpanded ? " is-rotated" : ""}`} />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded ? (
                    <motion.div
                      key={`section-body-${section.id}`}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      className="builder-section-expanded-body"
                    >
                      <div className="builder-selected-section-panel">
                        <div className="builder-selected-section-inner">
                          <div className="builder-selected-section-head">
                            <span className="saas-canvas-title">Selected Section</span>
                            <button type="button" className="saas-icon-btn" aria-label="Close" onClick={() => setExpandedSectionId(null)}>
                              <ChevronDown size={14} style={{ transform: "rotate(180deg)" }} />
                            </button>
                          </div>
                          <div className="saas-field">
                            <span className="saas-field-label">Section Title</span>
                            <input
                              id={`sec-label-${section.id}`}
                              className="builder-section-input"
                              value={section.label}
                              onChange={(e) => {
                                const nextLabel = e.target.value;
                                if (nextLabel.length > SECTION_TITLE_MAX_CHARS) {
                                  setSectionTitleError(`Maximum ${SECTION_TITLE_MAX_CHARS} characters.`);
                                  return;
                                }
                                if (sectionTitleError) {
                                  setSectionTitleError(null);
                                }
                                onConfigChange(updateSectionInConfig(config, section.id, { label: nextLabel }));
                              }}
                              placeholder="Section label"
                            />
                            <p className="saas-field-hint">{section.label.length}/{SECTION_TITLE_MAX_CHARS} characters</p>
                            {sectionTitleError ? <p className="saas-field-error">{sectionTitleError}</p> : null}
                          </div>
                          <div className="saas-switch-row">
                            <span className="saas-field-label">Show Section</span>
                            <button
                              type="button"
                              className={`saas-toggle${section.visible ? " on" : ""}`}
                              role="switch"
                              aria-checked={section.visible}
                              onClick={() => onConfigChange(updateSectionInConfig(config, section.id, { visible: !section.visible }))}
                            >
                              <span className="saas-toggle-thumb" />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="builder-section-design-button"
                            aria-expanded={designOpenId === section.id}
                            onClick={() => setDesignOpenId((prev) => (prev === section.id ? null : section.id))}
                          >
                            <SlidersHorizontal size={14} />
                            <span>Section Design</span>
                            <ChevronDown size={13} className={`builder-section-chevron${designOpenId === section.id ? " is-rotated" : ""}`} style={{ marginLeft: "auto" }} />
                          </button>
                          <AnimatePresence initial={false}>
                            {designOpenId === section.id ? (
                              <motion.div
                                key={`design-panel-${section.id}`}
                                className="builder-section-design-panel"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                style={{ overflow: "hidden" }}
                              >
                                <div className="saas-advanced-content">
                                  {renderSectionDesignFields(section)}
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="builder-section-blocks-area">
                        <div className="builder-section-blocks-head">
                          <div className="saas-canvas-header-left">
                            <span className="saas-canvas-title">Items in {section.label || "Section"}</span>
                            <span className="saas-block-badge">{sectionBlocks.length}</span>
                          </div>
                          <div className="builder-collapsible-actions">
                            <button
                              type="button"
                              className="saas-mini-btn"
                              aria-expanded={sectionBlocksOpen}
                              onClick={() => setSectionBlocksOpen((current) => !current)}
                            >
                              {sectionBlocksOpen ? "Collapse" : "Expand"}
                            </button>
                            {onRequestAddBlock ? (
                              <button type="button" className="saas-mini-btn" onClick={() => onRequestAddBlock(section.id)}>
                                <Plus size={12} /> Add
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {sectionBlocksOpen && sectionBlocks.length ? (
                          <Reorder.Group axis="y" values={sectionBlocks} onReorder={(values) => handleReorderSection(section.id, values)} className="saas-reorder-list" as="div">
                            {sectionBlocks.map((block, idx) => {
                              const isDropBefore = dropPosition?.sectionId === section.id && dropPosition.index === idx;
                              const isDropAfter = dropPosition?.sectionId === section.id && dropPosition.index === idx + 1;
                              return renderBlockCard(block, idx, section.id, sectionBlocks.length, isDropBefore, isDropAfter);
                            })}
                            {draggedBlockId && dropPosition?.sectionId === section.id && dropPosition.index === sectionBlocks.length ? (
                              <div className="saas-block-drop-end" aria-hidden="true" />
                            ) : null}
                          </Reorder.Group>
                        ) : sectionBlocksOpen ? (
                          <div className="saas-canvas-empty saas-canvas-empty-inline saas-canvas-empty-empty-state">
                            <p className="saas-empty-sub">No blocks yet. Use the <strong>Sections</strong> tab to add contact buttons, links, forms, and more.</p>
                          </div>
                        ) : (
                          <div className="saas-canvas-collapsed-row" aria-hidden="true">
                            <span className="saas-canvas-collapsed-label">Section blocks collapsed</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        ) : (
          <div className="saas-canvas-empty saas-canvas-empty-inline">
            <p>No sections yet.</p>
            <p className="saas-empty-sub">Click <strong>Add section</strong> to start building your page layout.</p>
          </div>
        )}

        {/* ── Header blocks ──────────────────────────────────── */}
        {heroBlocks.length ? (
          <div className="saas-canvas-section-group builder-header-blocks-group">
            <div className="builder-canvas-group-head">
              <p className="saas-canvas-section-title">Header</p>
              <div className="builder-collapsible-actions">
                <span className="saas-block-badge">{heroBlocks.length}</span>
                <button
                  type="button"
                  className="saas-mini-btn"
                  aria-expanded={headerBlocksOpen}
                  onClick={() => setHeaderBlocksOpen((current) => !current)}
                >
                  {headerBlocksOpen ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>
            {headerBlocksOpen ? (
              <Reorder.Group
                axis="y"
                values={heroBlocks}
                onReorder={(values) => {
                  const orderMap = new Map(values.map((block, i) => [block.id, i]));
                  const nextBlocks = [...orderedBlocks]
                    .sort((a, b) =>
                      orderMap.has(a.id) && orderMap.has(b.id)
                        ? (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
                        : a.order - b.order
                    )
                    .map((block, i) => ({ ...block, order: i }));
                  onConfigChange({ ...config, blocks: nextBlocks });
                }}
                className="saas-reorder-list"
                as="div"
              >
                {heroBlocks.map((block, idx) => renderBlockCard(block, idx))}
              </Reorder.Group>
            ) : (
              <div className="saas-canvas-empty saas-canvas-empty-inline saas-canvas-empty-collapsed">
                <p className="saas-empty-sub">Header blocks are collapsed.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface BlockSettingsPanelProps {
  block: BuilderBlock;
  onUpdate: (settings: Record<string, any>) => void;
}

export function BlockSettingsPanel({ block, onUpdate }: BlockSettingsPanelProps) {
  const editor = (() => {
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
      case "image-block":
        return <ImageBlockEditor block={block} onUpdate={onUpdate} />;
      case "services-list":
        return <ServicesEditor block={block} onUpdate={onUpdate} />;
      case "phone-button":
      case "email-button":
      case "website-button":
      case "directions-button":
        return <PhoneBlockEditor block={block} onUpdate={onUpdate} />;
      case "request-quote-button":
      case "custom-link-button":
        return <BookingBlockEditor block={block} onUpdate={onUpdate} />;
      case "apple-wallet-button":
      case "google-wallet-button":
        return <WalletButtonEditor block={block} onUpdate={onUpdate} />;
      case "contact-buttons":
      case "contact":
        return <ContactButtonsEditor block={block} onUpdate={onUpdate} />;
      case "social-media-links":
      case "social-links":
        return <SocialLinksEditor block={block} onUpdate={onUpdate} />;
      case "business-hours":
        return <BusinessHoursEditor block={block} onUpdate={onUpdate} />;
      case "form-block":
        return <FormBlockEditor block={block} onUpdate={onUpdate} />;
      case "qr-code-block":
        return <QRCodeBlockEditor block={block} onUpdate={onUpdate} />;
      default:
        return <p className="saas-field-hint">No settings available for this block.</p>;
    }
  })();

  return (
    <div className="saas-fields">
      {editor}
    </div>
  );
}
