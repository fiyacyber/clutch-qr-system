"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConnectPublicProfile from "./ConnectPublicProfile";
import PremiumColorPicker from "./PremiumColorPicker";

interface Profile {
  id: string;
  customer_id: string;
  business_name: string;
  contact_name: string;
  title: string;
  phone: string;
  email: string;
  website: string;
  avatar_url: string;
  bio: string;
  slug: string;
  is_active: boolean;
  theme_color: string;
  layout: "grid" | "stack" | "buttons";
  show_lead_form: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileCreatorEditorProps {
  initialProfile: Profile | null;
  publicUrl: string;
}

export default function ProfileCreatorEditor({
  initialProfile,
  publicUrl,
}: ProfileCreatorEditorProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleInputChange = (
    field: keyof Profile,
    value: any
  ) => {
    if (profile) {
      setProfile({
        ...profile,
        [field]: value,
      });
      setSaveSuccess(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file || !profile) return;

    const formData = new FormData();
    formData.append("profile_id", profile.id);
    formData.append("avatar", file);

    try {
      const res = await fetch("/api/connect/profile", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated.profile);
        setSaveSuccess(true);
      }
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("profile_id", profile.id);
      formData.append("business_name", profile.business_name);
      formData.append("contact_name", profile.contact_name);
      formData.append("title", profile.title);
      formData.append("phone", profile.phone);
      formData.append("email", profile.email);
      formData.append("website", profile.website);
      formData.append("avatar_url", profile.avatar_url);
      formData.append("bio", profile.bio);
      formData.append("slug", profile.slug);
      formData.append("is_active", String(profile.is_active));
      formData.append("theme_color", profile.theme_color);
      formData.append("layout", profile.layout);
      formData.append("show_lead_form", String(profile.show_lead_form));

      const res = await fetch("/api/connect/profile", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}${publicUrl}`;
    navigator.clipboard.writeText(link);
    setShareOpen(false);
  };

  if (!profile) {
    return (
      <div className="profile-creator">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-creator">
      {/* Header */}
      <div className="creator-header">
        <div className="creator-header-content">
          <h1>Create Your Business Card Profile</h1>
          <p>Edit your profile and see changes instantly in the preview</p>
        </div>
        <div className="creator-header-actions">
          <button
            className="btn ghost"
            onClick={() => router.push(`/u/${profile.slug}`)}
          >
            View Public Profile
          </button>
          <div className="share-button-wrapper">
            <button
              className="btn secondary"
              onClick={() => setShareOpen(!shareOpen)}
            >
              Share Link
            </button>
            {shareOpen && (
              <div className="share-popover">
                <input
                  type="text"
                  value={`${window.location.origin}${publicUrl}`}
                  readOnly
                  className="share-input"
                />
                <button className="btn primary" onClick={copyShareLink}>
                  Copy Link
                </button>
              </div>
            )}
          </div>
          {saveSuccess && <span className="save-indicator">✓ Saved</span>}
        </div>
      </div>

      {/* Main Editor Layout */}
      <div className="creator-layout">
        {/* Editor Panel */}
        <div className="creator-editor-panel">
          <div className="editor-scroll">
            <section className="editor-section">
              <h3>Profile Picture</h3>
              <div className="avatar-upload-preview">
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="avatar-preview"
                  />
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                className="input"
              />
            </section>

            <section className="editor-section">
              <h3>Basic Information</h3>
              <label className="label">
                Business Name
                <input
                  className="input"
                  value={profile.business_name}
                  onChange={(e) =>
                    handleInputChange("business_name", e.target.value)
                  }
                />
              </label>
              <label className="label">
                Contact Name
                <input
                  className="input"
                  value={profile.contact_name}
                  onChange={(e) =>
                    handleInputChange("contact_name", e.target.value)
                  }
                />
              </label>
              <label className="label">
                Title
                <input
                  className="input"
                  value={profile.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                />
              </label>
            </section>

            <section className="editor-section">
              <h3>Contact Details</h3>
              <label className="label">
                Phone
                <input
                  className="input"
                  value={profile.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                />
              </label>
              <label className="label">
                Email
                <input
                  className="input"
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </label>
              <label className="label">
                Website
                <input
                  className="input"
                  value={profile.website}
                  onChange={(e) =>
                    handleInputChange("website", e.target.value)
                  }
                />
              </label>
            </section>

            <section className="editor-section">
              <h3>Bio</h3>
              <textarea
                className="input"
                rows={4}
                value={profile.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
              />
            </section>

            <section className="editor-section">
              <h3>Appearance</h3>
              <label className="label">
                Theme Color
                <PremiumColorPicker
                  value={profile.theme_color}
                  onChange={(color) => handleInputChange("theme_color", color)}
                  ariaLabel="Profile theme color"
                  buttonText="Choose theme color"
                />
              </label>
              <label className="label">
                Link Layout
                <select
                  className="input"
                  value={profile.layout}
                  onChange={(e) =>
                    handleInputChange(
                      "layout",
                      e.target.value as "grid" | "stack" | "buttons"
                    )
                  }
                >
                  <option value="grid">Grid (Linktree-style)</option>
                  <option value="stack">Stack (Vertical list)</option>
                  <option value="buttons">Buttons (Compact)</option>
                </select>
              </label>
              <label className="label">
                <input
                  type="checkbox"
                  checked={profile.show_lead_form}
                  onChange={(e) =>
                    handleInputChange("show_lead_form", e.target.checked)
                  }
                />
                {" "}Show lead capture form
              </label>
            </section>

            <section className="editor-section">
              <h3>Publishing</h3>
              <label className="label">
                Profile Status
                <select
                  className="input"
                  value={String(profile.is_active)}
                  onChange={(e) =>
                    handleInputChange("is_active", e.target.value === "true")
                  }
                >
                  <option value="true">Active (Published)</option>
                  <option value="false">Inactive (Draft)</option>
                </select>
              </label>
            </section>

            <div className="editor-actions">
              <button
                className="btn primary btn-large"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="creator-preview-panel">
          <div className="preview-container">
            <div className="preview-header">Live Preview</div>
            <div className="preview-content">
              <ConnectPublicProfile
                profileId={profile.id}
                slug={profile.slug}
                businessName={profile.business_name}
                contactName={profile.contact_name}
                title={profile.title}
                phone={profile.phone}
                email={profile.email}
                website={profile.website}
                bio={profile.bio}
                avatarUrl={profile.avatar_url}
                themeColor={profile.theme_color}
                links={[]}
                layout={profile.layout}
                showLeadForm={profile.show_lead_form}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
