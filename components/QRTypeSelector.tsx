"use client";

import styles from "./QRTypeSelector.module.css";

export type QRType =
  | "flyers"
  | "business_cards"
  | "brochures"
  | "postcards"
  | "door_hangers"
  | "yard_signs";

type QRTypeOption = {
  value: QRType;
  label: string;
  icon: string;
  helper: string;
};

const QR_TYPES: QRTypeOption[] = [
  { value: "flyers", label: "Flyers", icon: "📄", helper: "Handouts and one-page promotions" },
  { value: "business_cards", label: "Business cards", icon: "💼", helper: "Compact personal or company cards" },
  { value: "brochures", label: "Brochures", icon: "📑", helper: "Folded product and service guides" },
  { value: "postcards", label: "Direct mail", icon: "📮", helper: "Postcards and mailed campaigns" },
  { value: "door_hangers", label: "Door hangers", icon: "🚪", helper: "Neighborhood and local outreach" },
  { value: "yard_signs", label: "Signs and banners", icon: "🪧", helper: "Longer-distance scanning" },
];

type QRTypeSelectorProps = {
  value: QRType;
  onChange: (type: QRType) => void;
};

export default function QRTypeSelector({ value, onChange }: QRTypeSelectorProps) {
  return (
    <div className={styles.container}>
      <p className={styles.heading}>Where will customers see this code?</p>
      <div className={styles.grid}>
        {QR_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            className={`${styles.card} ${value === type.value ? styles.active : ""}`}
            onClick={() => onChange(type.value)}
            aria-pressed={value === type.value}
          >
            <div className={styles.icon}>{type.icon}</div>
            <div className={styles.label}>{type.label}</div>
            <small>{type.helper}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
