"use client";

import ConnectLinkCard from "@/components/ConnectLinkCard";
import styles from "./ConnectLinksGrid.module.css";

type LinkLayout = "grid" | "stack" | "buttons";

type Link = {
  id: string;
  label: string;
  url: string;
  icon?: string | null;
  platform?: string | null;
  custom_color?: string | null;
  icon_style?: string;
  description?: string | null;
};

type ConnectLinksGridProps = {
  links: Link[];
  layout?: LinkLayout;
  profileId: string;
  onLinkClick?: (linkId: string) => void;
};

export default function ConnectLinksGrid({
  links,
  layout = "grid",
  profileId,
  onLinkClick,
}: ConnectLinksGridProps) {
  if (!links || links.length === 0) {
    return null;
  }

  return (
    <section className={styles.container}>
      <div className={`${styles.grid} ${styles[`layout_${layout}`]}`}>
        {links.map((link) => (
          <ConnectLinkCard
            key={link.id}
            id={link.id}
            label={link.label}
            url={link.url}
            description={link.description}
            icon={link.icon}
            platform={link.platform as any}
            customColor={link.custom_color}
            iconStyle={(link.icon_style as any) || "emoji"}
            onClick={() => onLinkClick?.(link.id)}
          />
        ))}
      </div>
    </section>
  );
}
