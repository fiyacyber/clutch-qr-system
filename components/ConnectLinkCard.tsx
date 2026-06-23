"use client";

import styles from "./ConnectLinkCard.module.css";

type IconStyle = "emoji" | "solid" | "outline" | "none";
type Platform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "twitter"
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
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  website: "#384862",
  email: "#EA4335",
  phone: "#25D366",
  other: "#FFA665",
};

const PLATFORM_EMOJIS: Record<Platform, string> = {
  instagram: "📷",
  facebook: "f",
  tiktok: "♪",
  twitter: "𝕏",
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

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
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
          {iconStyle === "emoji" ? displayIcon : null}
          {iconStyle === "solid" && (
            <svg
              className={styles.iconSolid}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              {/* Platform-specific SVG would go here - for now using emoji fallback */}
              <text x="12" y="12" textAnchor="middle" dy=".3em">
                {displayIcon}
              </text>
            </svg>
          )}
          {iconStyle === "outline" && (
            <svg
              className={styles.iconOutline}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              {/* Platform-specific SVG would go here - for now using emoji fallback */}
              <text x="12" y="12" textAnchor="middle" dy=".3em">
                {displayIcon}
              </text>
            </svg>
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
