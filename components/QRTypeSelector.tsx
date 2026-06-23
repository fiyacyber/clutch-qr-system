"use client";

import styles from "./QRTypeSelector.module.css";

export type QRType = "flyers" | "business_cards" | "brochures" | "postcards" | "door_hangers" | "yard_signs";

type QRTypeOption = {
  value: QRType;
  label: string;
  icon: string;
  disabled?: boolean;
  comingSoon?: boolean;
};

const QR_TYPES: QRTypeOption[] = [
  { value: "flyers", label: "Flyers", icon: "📄" },
  { value: "business_cards", label: "Business Cards", icon: "💼" },
  { value: "brochures", label: "Brochures", icon: "📑" },
  { value: "postcards", label: "Postcards", icon: "📮" },
  { value: "door_hangers", label: "Door Hangers", icon: "🚪" },
  { value: "yard_signs", label: "Yard Signs", icon: "🪧" },
];

type QRTypeSelectorProps = {
  value: QRType;
  onChange: (type: QRType) => void;
};

export default function QRTypeSelector({ value, onChange }: QRTypeSelectorProps) {
  return (
    <div className={styles.container}>
      <p className={styles.heading}>Select Mailing Piece</p>
      <div className={styles.grid}>
        {QR_TYPES.map((type) => (
          <button
            key={type.value}
            className={`${styles.card} ${value === type.value ? styles.active : ""} ${
              type.disabled ? styles.disabled : ""
            }`}
            onClick={() => !type.disabled && onChange(type.value)}
            disabled={type.disabled}
            title={type.comingSoon ? "Coming soon" : undefined}
          >
            <div className={styles.icon}>{type.icon}</div>
            <div className={styles.label}>{type.label}</div>
            {type.comingSoon && <div className={styles.badge}>Soon</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
