"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BlockType } from "@/lib/builder-types";

interface BlockLibraryItem {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  category: "layout" | "contact" | "content" | "premium";
}

const BLOCK_LIBRARY: BlockLibraryItem[] = [
  { type: "profile-hero", label: "Profile Hero", description: "Photo, name, title, bio", icon: "👤", category: "layout" },
  { type: "contact-buttons", label: "Contact Buttons", description: "Call, email, text group", icon: "📱", category: "contact" },
  { type: "phone-button", label: "Phone Button", description: "Single phone action", icon: "☎️", category: "contact" },
  { type: "email-button", label: "Email Button", description: "Single email action", icon: "✉️", category: "contact" },
  { type: "website-button", label: "Website Button", description: "Link to your website", icon: "🌐", category: "contact" },
  { type: "directions-button", label: "Directions", description: "Google Maps link", icon: "📍", category: "contact" },
  { type: "request-quote-button", label: "Request Quote", description: "Lead capture button", icon: "💬", category: "contact" },
  { type: "custom-link-button", label: "Custom Link", description: "Any custom URL", icon: "🎯", category: "contact" },
  { type: "social-media-links", label: "Social Media Grid", description: "All social links", icon: "🔗", category: "content" },
  { type: "text-section", label: "Text Section", description: "Heading and body text", icon: "📝", category: "content" },
  { type: "image-banner", label: "Image / Banner", description: "Upload an image", icon: "🖼️", category: "content" },
  { type: "business-hours", label: "Business Hours", description: "Operating hours", icon: "🕐", category: "content" },
  { type: "services-list", label: "Services List", description: "List your offerings", icon: "✓", category: "content" },
  { type: "form-block", label: "Form Block", description: "Custom contact form", icon: "📋", category: "content" },
  { type: "apple-wallet-button", label: "Apple Wallet", description: "Add to Apple Wallet", icon: "🍎", category: "premium" },
  { type: "google-wallet-button", label: "Google Wallet", description: "Save to Google Wallet", icon: "🔵", category: "premium" },
  { type: "qr-code-block", label: "QR Code", description: "Your profile QR code", icon: "📲", category: "premium" },
];

const CATEGORIES = ["layout", "contact", "content", "premium"] as const;
const CATEGORY_LABELS: Record<typeof CATEGORIES[number], string> = {
  layout: "Layout",
  contact: "Contact",
  content: "Content",
  premium: "⚡ Premium",
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
                <LibraryItem key={`${block.type}-${idx}`} block={block} onAdd={onAddBlock} />
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
                    <LibraryItem key={`${block.type}-${block.label}-${idx}`} block={block} onAdd={onAddBlock} />
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
  return (
    <motion.button
      className="saas-lib-item"
      onClick={() => onAdd(block.type)}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      title={block.description}
    >
      <span className="saas-lib-icon">{block.icon}</span>
      <div className="saas-lib-meta">
        <span className="saas-lib-name">{block.label}</span>
        <span className="saas-lib-desc">{block.description}</span>
      </div>
      <span className="saas-lib-add">+</span>
    </motion.button>
  );
}

