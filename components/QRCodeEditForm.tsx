"use client";

import { FormEvent, useState } from "react";

type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

type CornerStyle = "square" | "dot" | "extra-rounded";

type QRCodeEditFormProps = {
  code: {
    id: string;
    name: string;
    destination_url: string;
    foreground_color?: string | null;
    background_color?: string | null;
    dot_style?: DotStyle | null;
    corner_style?: CornerStyle | null;
    logo_url?: string | null;
  };
};

export default function QRCodeEditForm({ code }: QRCodeEditFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    setIsSaving(true);

    try {
      const response = await fetch("/api/qr/update", {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });

      window.location.assign(response.redirected ? response.url : "/portal");
    } catch (error) {
      console.error("QR SAVE ERROR:", error);
      window.location.assign("/portal?error=qr_save_failed");
    }
  }

  return (
    <form
      className="form"
      action="/api/qr/update"
      method="post"
      encType="multipart/form-data"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="id" value={code.id} />

      <label className="label">
        Name
        <input className="input" name="name" defaultValue={code.name} />
      </label>

      <label className="label">
        Destination URL
        <input
          className="input"
          name="destination_url"
          defaultValue={code.destination_url}
        />
      </label>

      <div className="color-grid">
        <label className="label color-label">
          QR Color
          <input
            type="color"
            name="foreground_color"
            defaultValue={code.foreground_color || "#384862"}
          />
        </label>

        <label className="label color-label">
          Background Color
          <input
            type="color"
            name="background_color"
            defaultValue={code.background_color || "#ffffff"}
          />
        </label>
      </div>

      <label className="label">
        Dot Style
        <select
          className="input"
          name="dot_style"
          defaultValue={code.dot_style || "square"}
        >
          <option value="square">Square</option>
          <option value="rounded">Rounded</option>
          <option value="dots">Dots</option>
          <option value="classy">Classy</option>
          <option value="classy-rounded">Classy Rounded</option>
          <option value="extra-rounded">Extra Rounded</option>
        </select>
      </label>

      <label className="label">
        Corner Style
        <select
          className="input"
          name="corner_style"
          defaultValue={code.corner_style || "square"}
        >
          <option value="square">Square</option>
          <option value="dot">Dot</option>
          <option value="extra-rounded">Extra Rounded</option>
        </select>
      </label>

      <label className="label">
        Logo
        <input
          className="input"
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
        />
      </label>

      {code.logo_url ? (
        <label className="label checkbox-row">
          <input type="checkbox" name="remove_logo" value="true" />
          Remove uploaded logo
        </label>
      ) : null}

      <div className="actions">
        <button className="btn primary" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
