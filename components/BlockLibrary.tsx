"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ClipboardList, GalleryVerticalEnd, ImageIcon, Link2, Mail, MapPin, Phone, PlusCircle, Share2, Star, Type, UserCircle2, Video } from "lucide-react";
import { BlockType } from "@/lib/builder-types";
import { isSingletonBlockType } from "@/lib/builder-config";

interface BlockLibraryItem {
  id: string;
  type?: BlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  category: "core" | "contact" | "growth";
  available: boolean;
}

const BLOCK_LIBRARY: BlockLibraryItem[] = [
  { id: "avatar", type: "avatar-block", label: "Avatar", description: "Profile photo and badge", icon: UserCircle2, category: "core", available: true },
  { id: "business-name", type: "business-name-block", label: "Profile Name", description: "Your name or business name", icon: Type, category: "core", available: true },
  { id: "subheader", type: "subheader-block", label: "Title / Subtitle", description: "Role, tagline, or short intro", icon: Type, category: "core", available: true },
  { id: "email", type: "email-button", label: "Email", description: "Let visitors email you", icon: Mail, category: "contact", available: true },
  { id: "phone", type: "phone-button", label: "Phone", description: "Let visitors call or text", icon: Phone, category: "contact", available: true },
  { id: "social", type: "social-media-links", label: "Social Links", description: "Add Instagram, Facebook, LinkedIn, and more", icon: Share2, category: "contact", available: true },
  { id: "button", type: "custom-link-button", label: "Link Button", description: "Add a custom button", icon: Link2, category: "contact", available: true },
  { id: "location", type: "directions-button", label: "Location", description: "Send visitors to your map listing", icon: MapPin, category: "contact", available: true },
  { id: "lead-form", type: "form-block", label: "Lead Form", description: "Collect inquiries from your profile", icon: ClipboardList, category: "growth", available: true },
  { id: "calendar", label: "Calendar", description: "Embed booking and availability", icon: CalendarDays, category: "growth", available: false },
  { id: "video", label: "Video", description: "Feature a product or intro video", icon: Video, category: "growth", available: false },
  { id: "reviews", label: "Reviews", description: "Showcase testimonials and ratings", icon: Star, category: "growth", available: false },
  { id: "gallery", label: "Gallery", description: "Create an image gallery section", icon: GalleryVerticalEnd, category: "growth", available: false },
  { id: "image", type: "image-banner", label: "Image Block", description: "Add a promo image or visual section", icon: ImageIcon, category: "core", available: true },
];

const CATEGORIES = ["core", "contact", "growth"] as const;
const CATEGORY_LABELS: Record<typeof CATEGORIES[number], string> = {
  core: "Profile basics",
  contact: "Contact + links",
  growth: "Growth tools",
};

const CATEGORY_HELP: Record<typeof CATEGORIES[number], string> = {
  core: "Name, photo, title, and visual content.",
  contact: "Ways visitors can call, email, follow, or visit you.",
  growth: "Lead capture, booking, wallet, and advanced tools.",
};

interface BlockLibraryProps {
  onAddBlock: (type: BlockType) => void;
  existingBlockTypes?: string[];
  isAtBlockLimit?: boolean;
}

export default function BlockLibrary({ onAddBlock, existingBlockTypes = [], isAtBlockLimit = false }: BlockLibraryProps) {
  const [search, setSearch] = useState("");
  const existingTypes = new Set(existingBlockTypes);

  const isBlockedByConflict = (type?: BlockType) => {
    if (!type) return false;
    return isSingletonBlockType(type) && existingTypes.has(type);
  };

  const filtered = search
    ? BLOCK_LIBRARY.filter(
        (b) =>
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="saas-library">
      <div className="saas-library-search">
        <svg className="saas-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search blocks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="saas-search-input"
        />
        {search && (
          <button className="saas-search-clear" onClick={() => setSearch("")}>×</button>
        )}
      </div>

      <div className="saas-library-list">
        {isAtBlockLimit ? <p className="saas-library-empty">Maximum of 12 blocks reached.</p> : null}
        {filtered ? (
          filtered.length === 0 ? (
            <p className="saas-library-empty">No blocks match "{search}"</p>
          ) : (
            <div className="saas-lib-group">
              {filtered.map((block, idx) => (
                <LibraryItem key={`${block.id}-${idx}`} block={block} onAdd={onAddBlock} disabledByConflict={isBlockedByConflict(block.type)} isAtBlockLimit={isAtBlockLimit} />
              ))}
            </div>
          )
        ) : (
          CATEGORIES.map((cat) => {
            const items = BLOCK_LIBRARY.filter((b) => b.category === cat);
            return (
              <div key={cat} className="saas-lib-section">
                <span className="saas-lib-section-label">{CATEGORY_LABELS[cat]}</span>
                <p className="saas-lib-section-help">{CATEGORY_HELP[cat]}</p>
                <div className="saas-lib-group">
                  {items.map((block, idx) => (
                    <LibraryItem key={`${block.id}-${block.label}-${idx}`} block={block} onAdd={onAddBlock} disabledByConflict={isBlockedByConflict(block.type)} isAtBlockLimit={isAtBlockLimit} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LibraryItem({ block, onAdd, disabledByConflict, isAtBlockLimit }: { block: BlockLibraryItem; onAdd: (t: BlockType) => void; disabledByConflict?: boolean; isAtBlockLimit?: boolean }) {
  const Icon = block.icon;
  const disabled = !block.available || Boolean(disabledByConflict) || Boolean(isAtBlockLimit);
  return (
    <motion.div className={`saas-lib-item${block.available ? "" : " coming-soon"}`} whileHover={block.available ? { y: -2 } : undefined} transition={{ duration: 0.15 }}>
      <div className="saas-lib-icon"><Icon size={18} strokeWidth={2} /></div>
      <div className="saas-lib-meta">
        <span className="saas-lib-name">{block.label}</span>
        <span className="saas-lib-desc">{block.description}</span>
      </div>
      <button
        type="button"
        className={`saas-lib-add-btn${disabled ? " disabled" : ""}`}
        onClick={() => !disabled && block.type && onAdd(block.type)}
        disabled={disabled}
      >
        {!disabled ? (
          <>
            <PlusCircle size={14} strokeWidth={2} />
            <span>Add</span>
          </>
        ) : (
          <span>{isAtBlockLimit ? "Limit reached" : block.available ? "Added" : "Coming soon"}</span>
        )}
      </button>
    </motion.div>
  );
}
