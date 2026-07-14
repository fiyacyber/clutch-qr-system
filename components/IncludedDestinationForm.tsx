"use client";

import { FormEvent, useState } from "react";

export default function IncludedDestinationForm({ code }: { code: { id: string; destination_url: string } }) {
  const [destination, setDestination] = useState(code.destination_url);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = new FormData();
    form.set("id", code.id);
    form.set("qr_type", "url");
    form.set("destination_url", destination);
    const response = await fetch("/api/qr/update", { method: "POST", body: form });
    const body = await response.json().catch(() => null);
    setMessage(response.ok ? "Destination updated." : body?.error || "Destination could not be updated.");
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="form-card">
      <label htmlFor="included-destination">Destination URL</label>
      <input
        id="included-destination"
        name="destination_url"
        type="url"
        required
        value={destination}
        onChange={(event) => setDestination(event.currentTarget.value)}
        autoComplete="url"
      />
      <p>Your included access can update this destination. Styling, name, logo, and ownership settings remain unchanged.</p>
      {message && <p role="status">{message}</p>}
      <button className="btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save destination"}</button>
    </form>
  );
}
