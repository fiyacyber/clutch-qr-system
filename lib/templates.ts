/**
 * Template system for pre-configured block layouts
 */

import { BuilderConfig, BuilderBlock } from "./builder-types";
import { createBlock } from "./builder-config";

export type TemplateType =
  | "contractor"
  | "realtor"
  | "salon"
  | "fitness"
  | "restaurant"
  | "photographer"
  | "general";

export interface Template {
  id: TemplateType;
  name: string;
  description: string;
  icon: string;
  config: BuilderConfig;
}

/**
 * Generate template configurations
 */
function generateTemplate(
  id: TemplateType,
  name: string,
  description: string,
  icon: string,
  blocks: Array<{ type: any; settings?: any }>
): Template {
  const builtBlocks: BuilderBlock[] = blocks.map((b, idx) =>
    createBlock(b.type, idx, b.settings)
  );

  return {
    id,
    name,
    description,
    icon,
    config: {
      version: 1,
      theme: {
        accentColor: "#FFA665",
        layout: "default",
        showProfilePicture: true,
        showBio: true,
        showFooter: true,
      },
      blocks: builtBlocks,
      forms: [],
    },
  };
}

export const TEMPLATES: Record<TemplateType, Template> = {
  contractor: generateTemplate(
    "contractor",
    "Contractor",
    "Perfect for contractors, builders, and tradespeople",
    "🔨",
    [
      { type: "profile-hero" },
      { type: "contact-buttons" },
      { type: "phone-button" },
      { type: "request-quote-button" },
      { type: "services-list", settings: { title: "Services" } },
      { type: "text-section", settings: { heading: "About Me" } },
    ]
  ),

  realtor: generateTemplate(
    "realtor",
    "Real Estate Agent",
    "For real estate professionals and agents",
    "🏠",
    [
      { type: "profile-hero" },
      { type: "contact-buttons" },
      { type: "phone-button" },
      { type: "email-button" },
      { type: "website-button" },
      { type: "request-quote-button", settings: { label: "Schedule Showing" } },
      { type: "custom-link-button", settings: { label: "View Listings", url: "#" } },
    ]
  ),

  salon: generateTemplate(
    "salon",
    "Salon & Spa",
    "For beauty professionals and salons",
    "💅",
    [
      { type: "profile-hero" },
      { type: "contact-buttons" },
      { type: "phone-button" },
      { type: "request-quote-button", settings: { label: "Book Appointment" } },
      { type: "social-media-links" },
      { type: "services-list", settings: { title: "Services" } },
      { type: "business-hours" },
    ]
  ),

  fitness: generateTemplate(
    "fitness",
    "Fitness Coach",
    "For personal trainers and fitness coaches",
    "💪",
    [
      { type: "profile-hero" },
      { type: "contact-buttons" },
      { type: "phone-button" },
      { type: "request-quote-button", settings: { label: "Book Session" } },
      { type: "social-media-links" },
      { type: "services-list", settings: { title: "Services" } },
      { type: "text-section", settings: { heading: "About Me" } },
    ]
  ),

  restaurant: generateTemplate(
    "restaurant",
    "Restaurant",
    "For restaurants and food businesses",
    "🍽️",
    [
      { type: "profile-hero" },
      { type: "phone-button" },
      { type: "website-button" },
      { type: "custom-link-button", settings: { label: "Order Online", url: "#" } },
      { type: "custom-link-button", settings: { label: "Reservations", url: "#" } },
      { type: "business-hours" },
      { type: "text-section", settings: { heading: "Featured Items" } },
    ]
  ),

  photographer: generateTemplate(
    "photographer",
    "Photographer",
    "For photographers and creatives",
    "📸",
    [
      { type: "profile-hero" },
      { type: "image-banner" },
      { type: "contact-buttons" },
      { type: "email-button" },
      { type: "request-quote-button", settings: { label: "Book Session" } },
      { type: "social-media-links" },
      { type: "text-section", settings: { heading: "Services" } },
    ]
  ),

  general: generateTemplate(
    "general",
    "General Business",
    "For any business or professional",
    "💼",
    [
      { type: "profile-hero" },
      { type: "contact-buttons" },
      { type: "phone-button" },
      { type: "email-button" },
      { type: "website-button" },
      { type: "social-media-links" },
      { type: "text-section", settings: { heading: "About Us" } },
    ]
  ),
};

/**
 * Get all available templates
 */
export function getTemplates(): Template[] {
  return Object.values(TEMPLATES);
}

/**
 * Get a specific template by ID
 */
export function getTemplate(id: TemplateType): Template | undefined {
  return TEMPLATES[id];
}
