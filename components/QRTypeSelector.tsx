"use client";

import styles from "./QRTypeSelector.module.css";

export type QRType = "url" | "text" | "wifi" | "email" | "sms" | "image" | "pdf" | "vcard" | "connect_profile";

type QRTypeOption = {
  value: QRType;
  label: string;
  icon: string;
  disabled?: boolean;
  comingSoon?: boolean;
};

const QR_TYPES: QRTypeOption[] = [
  { value: "url", label: "URL", icon: "🔗" },
  { value: "text", label: "Text", icon: "📝", disabled: true, comingSoon: true },
  { value: "wifi", label: "Wi-Fi", icon: "📶", disabled: true, comingSoon: true },
  { value: "email", label: "Email", icon: "✉️", disabled: true, comingSoon: true },
  { value: "sms", label: "SMS", icon: "💬", disabled: true, comingSoon: true },
  { value: "image", label: "Image", icon: "🖼️", disabled: true, comingSoon: true },
  { value: "pdf", label: "PDF", icon: "📄", disabled: true, comingSoon: true },
  { value: "vcard", label: "vCard", icon: "👤", disabled: true, comingSoon: true },
  { value: "connect_profile", label: "Connect", icon: "🌐" },
];

type QRTypeSelectorProps = {
  value: QRType;
  onChange: (type: QRType) => void;
};

export default function QRTypeSelector({ value, onChange }: QRTypeSelectorProps) {
  return (
    <div className={styles.container}>
      <p className={styles.heading}>Select QR Type</p>
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
