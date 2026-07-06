import {
  FaCalendarAlt,
  FaEnvelope,
  FaGlobe,
  FaLink,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export type ProfileLinkIconKey =
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "linkedin"
  | "x"
  | "website"
  | "booking"
  | "quote"
  | "link";

export type ProfileLinkIconColorMode = "mono" | "brand";

function hasStandaloneX(value: string) {
  return /(^|\s)x(\s|$)/.test(value);
}

export function resolveProfileLinkIconKey(type?: string | null, label?: string | null): ProfileLinkIconKey {
  const combined = `${String(type || "")} ${String(label || "")}`.toLowerCase();

  if (combined.includes("instagram")) return "instagram";
  if (combined.includes("facebook")) return "facebook";
  if (combined.includes("youtube")) return "youtube";
  if (combined.includes("tiktok")) return "tiktok";
  if (combined.includes("linkedin")) return "linkedin";
  if (combined.includes("twitter") || hasStandaloneX(combined)) return "x";
  if (combined.includes("website") || combined.includes("web site") || combined.includes("www") || combined.includes("http")) return "website";
  if (combined.includes("book") || combined.includes("calendar") || combined.includes("appointment")) return "booking";
  if (
    combined.includes("quote") ||
    combined.includes("request") ||
    combined.includes("inquiry") ||
    combined.includes("message") ||
    combined.includes("form") ||
    combined.includes("contact")
  ) {
    return "quote";
  }

  return "link";
}

export function getProfileLinkIconColor(
  key: ProfileLinkIconKey,
  colorMode: ProfileLinkIconColorMode = "mono"
) {
  if (colorMode !== "brand") return undefined;

  if (key === "instagram") return "#E4405F";
  if (key === "facebook") return "#1877F2";
  if (key === "youtube") return "#FF0000";
  if (key === "tiktok") return "#111111";
  if (key === "linkedin") return "#0A66C2";
  if (key === "x") return "#111827";
  if (key === "website") return "#2563EB";
  if (key === "booking") return "#0EA5E9";
  if (key === "quote") return "#475569";
  return "#6B7280";
}

type ProfileLinkIconProps = {
  type?: string | null;
  label?: string | null;
  size?: number;
  colorMode?: ProfileLinkIconColorMode;
  className?: string;
};

export default function ProfileLinkIcon({
  type,
  label,
  size = 16,
  colorMode = "mono",
  className,
}: ProfileLinkIconProps) {
  const key = resolveProfileLinkIconKey(type, label);
  const color = getProfileLinkIconColor(key, colorMode);
  const iconProps = {
    size,
    className,
    color,
    "aria-hidden": true as const,
  };

  if (key === "instagram") return <FaInstagram {...iconProps} />;
  if (key === "facebook") return <FaFacebook {...iconProps} />;
  if (key === "youtube") return <FaYoutube {...iconProps} />;
  if (key === "tiktok") return <FaTiktok {...iconProps} />;
  if (key === "linkedin") return <FaLinkedin {...iconProps} />;
  if (key === "x") return <FaXTwitter {...iconProps} />;
  if (key === "website") return <FaGlobe {...iconProps} />;
  if (key === "booking") return <FaCalendarAlt {...iconProps} />;
  if (key === "quote") return <FaEnvelope {...iconProps} />;
  return <FaLink {...iconProps} />;
}
