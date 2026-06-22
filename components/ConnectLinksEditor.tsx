"use client";

import { useState, useRef } from "react";
import { POPULAR_PLATFORMS, getPlatform, buildUrlForPlatform } from "@/lib/platforms";

interface ConnectLinksEditorProps {
  profileId: string;
  existingLinks?: Array<{
    id: string;
    label: string;
    platform?: string;
    value?: string;
    url: string;
    icon?: string;
    sort_order?: number;
    is_active?: boolean;
  }>;
}

export default function ConnectLinksEditor({ profileId, existingLinks = [] }: ConnectLinksEditorProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("custom");
  const [label, setLabel] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const platform = getPlatform(selectedPlatform);
  const displayLabel = label || (platform?.name || "Link");
  const displayUrl = value ? buildUrlForPlatform(selectedPlatform, value) : "";

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayLabel || !displayUrl) return;

    setIsSubmitting(true);
    const form = new FormData(formRef.current!);
    form.set("label", displayLabel);
    form.set("url", displayUrl);
    form.set("icon", platform?.icon || "link");

    try {
      const res = await fetch("/api/connect/links", { method: "POST", body: form });
      if (res.ok) {
        setSelectedPlatform("custom");
        setLabel("");
        setValue("");
        window.location.reload(); // Refresh to show new link
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="connect-links-editor">
      <section className="card">
        <p className="eyebrow">Add Link</p>
        <h3>Choose a Platform</h3>

        <form ref={formRef} onSubmit={handleAddOrUpdate} className="form">
          <input type="hidden" name="action" value="create" />
          <input type="hidden" name="profile_id" value={profileId} />

          <label className="label">
            Platform
            <select
              className="input"
              value={selectedPlatform}
              onChange={(e) => {
                setSelectedPlatform(e.target.value);
                // Auto-set label to platform name
                const p = getPlatform(e.target.value);
                if (!label) setLabel(p?.name || "");
              }}
            >
              {POPULAR_PLATFORMS.map((pid) => {
                const p = getPlatform(pid);
                return (
                  <option key={pid} value={pid}>
                    {p?.name}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="label">
            Display Label
            <input
              className="input"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={platform?.name || "Link"}
            />
          </label>

          <label className="label">
            {platform?.name === "Email"
              ? "Email Address"
              : platform?.name === "Phone"
                ? "Phone Number"
                : "Handle or Value"}
            <input
              className="input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={platform?.placeholder || ""}
            />
          </label>

          {displayUrl && (
            <div className="link-preview">
              <p className="eyebrow">Preview URL</p>
              <code>{displayUrl}</code>
            </div>
          )}

          <button className="btn primary" type="submit" disabled={!displayLabel || !displayUrl || isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Link"}
          </button>
        </form>
      </section>

      {existingLinks.length > 0 && (
        <section className="card" style={{ marginTop: "24px" }}>
          <p className="eyebrow">Your Links</p>
          <h3>Manage Existing Links</h3>

          <div className="links-list">
            {existingLinks.map((link) => (
              <div key={link.id} className="link-row">
                <div className="link-info">
                  <p className="link-label">{link.label}</p>
                  <p className="link-url">{link.url}</p>
                </div>
                <div className="link-actions">
                  <a href={`#edit-${link.id}`} className="btn ghost">
                    Edit
                  </a>
                  <form
                    action="/api/connect/links"
                    method="post"
                    style={{ display: "inline" }}
                    onSubmit={(e) => {
                      if (!confirm("Delete this link?")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="profile_id" value={profileId} />
                    <input type="hidden" name="link_id" value={link.id} />
                    <button type="submit" className="btn ghost">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
