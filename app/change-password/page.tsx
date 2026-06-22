"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "").trim();
    const confirmPassword = String(form.get("confirm_password") || "").trim();

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      setIsSaving(false);
      return;
    }

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      setError("Password must include uppercase, lowercase, a number, and a symbol.");
      setIsSaving(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSaving(false);
      return;
    }

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });

    if (response.ok) {
      router.push("/portal");
    } else {
      const body = await response.json();
      setError(body.error || "Unable to change password.");
      setIsSaving(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <h1>Change Password</h1>
        <p className="muted">Enter a new password to continue to your dashboard. Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>

        {error ? <p className="alert">Error: {error}</p> : null}

        <form className="form" onSubmit={handleSubmit}>
          <label className="label">
            New Password
            <input className="input" type="password" name="password" required minLength={12} />
          </label>
          <label className="label">
            Confirm New Password
            <input className="input" type="password" name="confirm_password" required minLength={12} />
          </label>
          <button className="btn primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Change Password"}
          </button>
        </form>
      </section>
    </main>
  );
}
