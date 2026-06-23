"use client";

import { SOCIAL_ICONS } from "@/lib/icon-system";

interface SocialIconProps {
  platform: string;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  showLabel?: boolean;
}

export default function SocialIcon({
  platform,
  size = "lg",
  label,
  showLabel = false,
}: SocialIconProps) {
  const social = SOCIAL_ICONS[platform as keyof typeof SOCIAL_ICONS];

  if (!social) {
    return <span className={`icon-${size}`}>🔗</span>;
  }

  const sizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  };

  const currentSize = sizeMap[size];

  return (
    <div className="social-icon-wrapper" title={social.name}>
      <div
        className={`social-icon social-icon-${platform} icon-${size}`}
        style={{
          backgroundColor: social.color,
          width: currentSize,
          height: currentSize,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          fontSize: currentSize * 0.6,
          transition: "all 0.2s ease",
        }}
      >
        {platform.charAt(0).toUpperCase()}
      </div>
      {showLabel && (
        <span className="social-icon-label">{label || social.name}</span>
      )}
    </div>
  );
}
