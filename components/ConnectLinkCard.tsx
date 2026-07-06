"use client";

import styles from "./ConnectLinkCard.module.css";
import {
  FaInstagram,
  FaFacebook,
  FaYoutube,
  FaLinkedin,
  FaTiktok,
  FaGoogle,
  FaYelp,
  FaCalendarAlt,
  FaEnvelope,
  FaPhone,
  FaGlobe,
  FaLink,
} from "react-icons/fa";

import { FaXTwitter } from "react-icons/fa6";

type IconStyle = "emoji" | "solid" | "outline" | "none";
type Platform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "twitter"
  | "x"
  | "linkedin"
  | "youtube"
  | "website"
  | "email"
  | "phone"
  | "other";

type ConnectLinkCardProps = {
  id: string;
  label: string;
  url: string;
  description?: string | null;
  icon?: string | null;
  platform?: Platform | null;
  customColor?: string | null;
  iconStyle?: IconStyle;
  onClick?: () => void;
};

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#E4405F",
  facebook: "#1877F2",
  tiktok: "#000000",
  twitter: "#1DA1F2",
  x: "#111827",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  website: "#384862",
  email: "#EA4335",
  phone: "#25D366",
  other: "#FFA665",
};

function getPlatformIcon(platform?: Platform | null, size = 20) {
  const commonProps = { size, "aria-hidden": true as const };
  const value = String(platform || "").toLowerCase();

  switch (value) {
    case "instagram":
      return <FaInstagram {...commonProps} />;
    case "facebook":
      return <FaFacebook {...commonProps} />;
    case "youtube":
      return <FaYoutube {...commonProps} />;
    case "linkedin":
      return <FaLinkedin {...commonProps} />;
    case "tiktok":
      return <FaTiktok {...commonProps} />;
    case "twitter":
    case "x":
      return <FaXTwitter {...commonProps} />;
    case "google":
    case "google_business":
      return <FaGoogle {...commonProps} />;
    case "yelp":
      return <FaYelp {...commonProps} />;
    case "booking":
      return <FaCalendarAlt {...commonProps} />;
    case "email":
      return <FaEnvelope {...commonProps} />;
    case "phone":
      return <FaPhone {...commonProps} />;
    case "website":
      return <FaGlobe {...commonProps} />;
    case "custom":
      return <FaLink {...commonProps} />;
    default:
      return <FaLink {...commonProps} />;
  }
}

const PLATFORM_EMOJIS: Record<Platform, string> = {
  instagram: "📷",
  facebook: "f",
  tiktok: "♪",
  twitter: "𝕏",
  x: "𝕏",
  linkedin: "in",
  youtube: "▶️",
  website: "🌐",
  email: "✉️",
  phone: "☎️",
  other: "🔗",
};

export default function ConnectLinkCard({
  id,
  label,
  url,
  description,
  icon,
  platform,
  customColor,
  iconStyle = "emoji",
  onClick,
}: ConnectLinkCardProps) {
  const bgColor = customColor || (platform ? PLATFORM_COLORS[platform as Platform] : "#FFA665");
  const displayIcon = icon || (platform ? PLATFORM_EMOJIS[platform as Platform] : "🔗");
  const renderedIcon = platform ? getPlatformIcon(platform as Platform) : <span aria-hidden="true">{displayIcon}</span>;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`${styles.card} ${styles[`icon_${iconStyle}`]}`}
      style={{
        ["--card-bg" as string]: bgColor,
        ["--card-fg" as string]: "#ffffff",
      } as React.CSSProperties}
      onClick={handleClick}
    >
      {iconStyle !== "none" && (
        <div className={styles.icon}>
          {iconStyle === "emoji" && (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
              {renderedIcon}
            </span>
          )}
          {iconStyle === "solid" && (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
              {renderedIcon}
            </span>
          )}
          {iconStyle === "outline" && (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
              {renderedIcon}
            </span>
          )}
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.label}>{label}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>

      <div className={styles.arrow}>→</div>
    </a>
  );
}
