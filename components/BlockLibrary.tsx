"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ClipboardList, GalleryVerticalEnd, ImageIcon, Link2, Mail, MapPin, MessageSquarePlus, Phone, PlusCircle, Share2, Star, User, Video } from "lucide-react";
import { BlockType } from "@/lib/builder-types";

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
  { id: "profile", type: "profile-hero", label: "Profile", description: "Photo, name, role, and bio", icon: User, category: "core", available: true },
  { id: "email", type: "email-button", label: "Email", description: "Single email call-to-action", icon: Mail, category: "contact", available: true },
  { id: "phone", type: "phone-button", label: "Phone", description: "Single phone or text action", icon: Phone, category: "contact", available: true },
  { id: "social", type: "social-media-links", label: "Social links", description: "Display your social network grid", icon: Share2, category: "contact", available: true },
  { id: "button", type: "custom-link-button", label: "Button", description: "Add a custom link button", icon: Link2, category: "contact", available: true },
  { id: "location", type: "directions-button", label: "Location", description: "Send visitors to your map listing", icon: MapPin, category: "contact", available: true },
  { id: "lead-form", type: "form-block", label: "Lead form", description: "Capture inquiries directly in-page", icon: ClipboardList, category: "growth", available: true },
  { id: "calendar", label: "Calendar", description: "Embed booking and availability", icon: CalendarDays, category: "growth", available: false },
  { id: "video", label: "Video", description: "Feature a product or intro video", icon: Video, category: "growth", available: false },
  { id: "reviews", label: "Reviews", description: "Showcase testimonials and ratings", icon: Star, category: "growth", available: false },
  { id: "gallery", label: "Gallery", description: "Create an image gallery section", icon: GalleryVerticalEnd, category: "growth", available: false },
  { id: "contact-buttons", type: "contact-buttons", label: "Contact group", description: "Call, email, website, and more", icon: MessageSquarePlus, category: "core", available: true },
  { id: "image", type: "image-banner", label: "Image", description: "Banner or promo image block", icon: ImageIcon, category: "core", available: true },
];

const CATEGORIES = ["core", "contact", "growth"] as const;
const CATEGORY_LABELS: Record<typeof CATEGORIES[number], string> = {
  core: "Core blocks",
  contact: "Contact actions",
  growth: "Growth + media",
};

interface BlockLibraryProps {
  onAddBlock: (type: BlockType) => void;
}

export default function BlockLibrary({ onAddBlock }: BlockLibraryProps) {
  const [search, setSearch] = useState("");

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
        {filtered ? (
          filtered.length === 0 ? (
            <p className="saas-library-empty">No blocks match "{search}"</p>
          ) : (
            <div className="saas-lib-group">
              {filtered.map((block, idx) => (
                <LibraryItem key={`${block.id}-${idx}`} block={block} onAdd={onAddBlock} />
              ))}
            </div>
          )
        ) : (
          CATEGORIES.map((cat) => {
            const items = BLOCK_LIBRARY.filter((b) => b.category === cat);
            return (
              <div key={cat} className="saas-lib-section">
                <span className="saas-lib-section-label">{CATEGORY_LABELS[cat]}</span>
                <div className="saas-lib-group">
                  {items.map((block, idx) => (
                    <LibraryItem key={`${block.id}-${block.label}-${idx}`} block={block} onAdd={onAddBlock} />
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

function LibraryItem({ block, onAdd }: { block: BlockLibraryItem; onAdd: (t: BlockType) => void }) {
  const Icon = block.icon;
  return (
    <motion.div className={`saas-lib-item${block.available ? "" : " coming-soon"}`} whileHover={block.available ? { y: -2 } : undefined} transition={{ duration: 0.15 }}>
      <div className="saas-lib-icon"><Icon size={18} strokeWidth={2} /></div>
      <div className="saas-lib-meta">
        <span className="saas-lib-name">{block.label}</span>
        <span className="saas-lib-desc">{block.description}</span>
      </div>
      <button
        type="button"
        className={`saas-lib-add-btn${block.available ? "" : " disabled"}`}
        onClick={() => block.available && block.type && onAdd(block.type)}
        disabled={!block.available}
      >
        {block.available ? (
          <>
            <PlusCircle size={14} strokeWidth={2} />
            <span>Add</span>
          </>
        ) : (
          <span>Coming soon</span>
        )}
      </button>
    </motion.div>
  );
}

