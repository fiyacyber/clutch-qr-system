"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BadgeCheck, Building2, Camera, LoaderCircle, Mail } from "lucide-react";
import styles from "./AccountDetailsPanel.module.css";

const ACCOUNT_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_ACCOUNT_AVATAR_SIZE = 2 * 1024 * 1024;
const ACCOUNT_AVATAR_EVENT = "clutch-account-avatar-updated";

type AccountDetailsPanelProps = {
  accountOwner: string;
  accountEmail: string | null;
  businessName: string;
  memberSince: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  guidedSetupHref: string;
};

function getInitials(name: string) {
  if (!name || name === "Add your name") return "CC";

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CC";

  return `${parts[0]?.[0] || ""}${parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""}`.toUpperCase() || "CC";
}

export default function AccountDetailsPanel({
  accountOwner,
  accountEmail,
  businessName,
  memberSince,
  emailVerified,
  avatarUrl,
  guidedSetupHref,
}: AccountDetailsPanelProps) {
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleAvatarUpdate = (event: Event) => {
      const avatarEvent = event as CustomEvent<{ avatarUrl?: string | null }>;
      if (avatarEvent.detail && "avatarUrl" in avatarEvent.detail) {
        setCurrentAvatarUrl(avatarEvent.detail.avatarUrl || null);
      }
    };

    window.addEventListener(ACCOUNT_AVATAR_EVENT, handleAvatarUpdate);
    return () => window.removeEventListener(ACCOUNT_AVATAR_EVENT, handleAvatarUpdate);
  }, []);

  const openFilePicker = () => {
    if (uploading) return;
    setMessage(null);
    setHasError(false);
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!ACCOUNT_AVATAR_TYPES.has(file.type)) {
      setHasError(true);
      setMessage("Use a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > MAX_ACCOUNT_AVATAR_SIZE) {
      setHasError(true);
      setMessage("Profile photo must be 2MB or smaller.");
      return;
    }

    setUploading(true);
    setHasError(false);
    setMessage("Uploading profile photo...");

    try {
      const form = new FormData();
      form.append("avatar", file);

      const response = await fetch("/api/customer/avatar", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: form,
      });
      const payload = await response.json().catch(() => ({})) as { avatar_url?: string; error?: string };

      if (!response.ok || !payload.avatar_url) {
        throw new Error(payload.error || "Profile photo upload failed.");
      }

      setCurrentAvatarUrl(payload.avatar_url);
      setMessage("Profile photo updated.");
      window.dispatchEvent(new CustomEvent(ACCOUNT_AVATAR_EVENT, { detail: { avatarUrl: payload.avatar_url } }));
    } catch (error) {
      setHasError(true);
      setMessage(error instanceof Error ? error.message : "Profile photo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.panel}>
      <section className={styles.identityCard}>
        <button
          type="button"
          className={styles.avatarButton}
          onClick={openFilePicker}
          disabled={uploading}
          aria-label={currentAvatarUrl ? "Change account profile photo" : "Upload account profile photo"}
          title={currentAvatarUrl ? "Change profile photo" : "Upload profile photo"}
        >
          <span className={styles.avatarCircle}>
            {currentAvatarUrl ? (
              <img src={currentAvatarUrl} alt="" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatarInitials}>{getInitials(accountOwner)}</span>
            )}
          </span>
          <span className={styles.avatarAction} aria-hidden="true">
            {uploading ? <LoaderCircle size={15} className={styles.avatarSpinner} /> : <Camera size={15} />}
          </span>
        </button>

        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleAvatarChange}
          tabIndex={-1}
        />

        <div className={styles.identityCopy}>
          <span className={styles.eyebrow}>Account owner</span>
          <h3>{accountOwner}</h3>
          <p>The primary person associated with this Clutch account.</p>
        </div>

        <button type="button" className={styles.changePhotoButton} onClick={openFilePicker} disabled={uploading}>
          {uploading ? "Uploading..." : currentAvatarUrl ? "Change photo" : "Add photo"}
        </button>
      </section>

      {message ? (
        <p className={`${styles.statusMessage} ${hasError ? styles.statusMessageError : ""}`} role={hasError ? "alert" : "status"}>
          {message}
        </p>
      ) : null}

      <div className={styles.detailsGrid}>
        <article className={styles.detailCard}>
          <span className={styles.detailLabel}><Mail size={14} aria-hidden="true" /> Login email</span>
          <div className={styles.detailValueRow}>
            <strong>{accountEmail || "No email available"}</strong>
            {emailVerified ? (
              <span className={styles.verifiedBadge}><BadgeCheck size={12} aria-hidden="true" /> Verified</span>
            ) : null}
          </div>
        </article>

        <article className={styles.detailCard}>
          <span className={styles.detailLabel}>Member since</span>
          <div className={styles.detailValueRow}>
            <strong>{memberSince}</strong>
          </div>
        </article>
      </div>

      <article className={styles.businessCard}>
        <span className={styles.businessIcon}><Building2 size={19} aria-hidden="true" /></span>
        <div className={styles.businessCopy}>
          <span className={styles.businessLabel}>Business or brand name</span>
          <strong>{businessName}</strong>
          <p>This comes from Guided Setup and is used by your Clutch Connect profile.</p>
        </div>
        <Link href={guidedSetupHref} className={styles.editBusinessLink}>Edit in Guided Setup</Link>
      </article>
    </div>
  );
}
