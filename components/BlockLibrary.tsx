"use client";

import { BlockType } from "@/lib/builder-types";

interface BlockLibraryItem {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  category: "layout" | "contact" | "content" | "premium";
}

const BLOCK_LIBRARY: BlockLibraryItem[] = [
  // Layout
  {
    type: "profile-hero",
    label: "Profile Hero",
    description: "Your name, photo, and bio",
    icon: "👤",
    category: "layout",
  },

  // Contact Buttons
  {
    type: "contact-buttons",
    label: "Contact Buttons",
    description: "Call, email, text buttons",
    icon: "📱",
    category: "contact",
  },
  {
    type: "phone-button",
    label: "Phone Button",
    description: "Single phone action",
    icon: "☎️",
    category: "contact",
  },
  {
    type: "email-button",
    label: "Email Button",
    description: "Single email action",
    icon: "✉️",
    category: "contact",
  },
  {
    type: "website-button",
    label: "Website Button",
    description: "Link to your website",
    icon: "🌐",
    category: "contact",
  },
  {
    type: "directions-button",
    label: "Directions Button",
    description: "Google Maps link",
    icon: "📍",
    category: "contact",
  },
  {
    type: "request-quote-button",
    label: "Request Quote",
    description: "Lead capture form button",
    icon: "💬",
    category: "contact",
  },
  {
    type: "custom-link-button",
    label: "Custom Link Button",
    description: "Any custom URL or action",
    icon: "🎯",
    category: "contact",
  },

  // Social Media (custom buttons)
  {
    type: "custom-link-button",
    label: "Facebook Link",
    description: "Link to Facebook page",
    icon: "f",
    category: "contact",
  },
  {
    type: "custom-link-button",
    label: "Instagram Link",
    description: "Link to Instagram profile",
    icon: "📷",
    category: "contact",
  },
  {
    type: "custom-link-button",
    label: "TikTok Link",
    description: "Link to TikTok profile",
    icon: "🎵",
    category: "contact",
  },
  {
    type: "custom-link-button",
    label: "LinkedIn Link",
    description: "Link to LinkedIn profile",
    icon: "in",
    category: "contact",
  },
  {
    type: "custom-link-button",
    label: "YouTube Channel",
    description: "Link to YouTube channel",
    icon: "▶️",
    category: "contact",
  },
  {
    type: "custom-link-button",
    label: "Google Reviews",
    description: "Link to Google Reviews",
    icon: "⭐",
    category: "contact",
  },

  // Content
  {
    type: "social-media-links",
    label: "Social Media Grid",
    description: "All social links in one block",
    icon: "🔗",
    category: "content",
  },
  {
    type: "text-section",
    label: "Text Section",
    description: "Heading and text content",
    icon: "📝",
    category: "content",
  },
  {
    type: "image-banner",
    label: "Image/Banner",
    description: "Upload an image",
    icon: "🖼️",
    category: "content",
  },
  {
    type: "business-hours",
    label: "Business Hours",
    description: "Show your operating hours",
    icon: "🕐",
    category: "content",
  },
  {
    type: "services-list",
    label: "Services List",
    description: "List your services or offerings",
    icon: "✓",
    category: "content",
  },
  {
    type: "form-block",
    label: "Form Block",
    description: "Custom contact form",
    icon: "📋",
    category: "content",
  },

  // Premium
  {
    type: "apple-wallet-button",
    label: "Apple Wallet",
    description: "Add to Apple Wallet",
    icon: "🍎",
    category: "premium",
  },
  {
    type: "google-wallet-button",
    label: "Google Wallet",
    description: "Save to Google Wallet",
    icon: "🔵",
    category: "premium",
  },
  {
    type: "qr-code-block",
    label: "QR Code",
    description: "Your profile QR code",
    icon: "📲",
    category: "premium",
  },
];

interface BlockLibraryProps {
  onAddBlock: (type: BlockType) => void;
}

export default function BlockLibrary({ onAddBlock }: BlockLibraryProps) {
  const categories = ["layout", "contact", "content", "premium"] as const;

  const categoryLabels: Record<typeof categories[number], string> = {
    layout: "Layout",
    contact: "Contact",
    content: "Content",
    premium: "Premium",
  };

  return (
    <div className="builder-block-library">
      <div className="library-header">
        <h3>Block Library</h3>
        <p>Add blocks to build your profile</p>
      </div>

      <div className="library-content">
        {categories.map((category) => {
          const blocks = BLOCK_LIBRARY.filter((b) => b.category === category);
          if (blocks.length === 0) return null;

          return (
            <div key={category} className="library-category">
              <h4 className="category-title">{categoryLabels[category]}</h4>
              <div className="category-blocks">
                {blocks.map((block, idx) => (
                  <button
                    key={`${block.type}-${block.label}-${idx}`}
                    className="library-block-item"
                    onClick={() => onAddBlock(block.type)}
                    title={block.description}
                  >
                    <span className="block-icon">{block.icon}</span>
                    <div className="block-info">
                      <span className="block-label">{block.label}</span>
                      <span className="block-desc">{block.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
