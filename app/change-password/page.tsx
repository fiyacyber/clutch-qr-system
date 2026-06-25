"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PASSWORD_POLICY_HELPER_TEXT, validatePasswordPolicy } from "@/lib/password-policy";

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

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      setError(policyError);
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

    const body = await response.json();

    if (response.ok) {
      router.push(body.redirectTo || "/portal");
    } else {
      setError(body.error || "Unable to change password.");
      setIsSaving(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <h1>Change Password</h1>
        <p className="muted">Enter a new password to continue to your dashboard. {PASSWORD_POLICY_HELPER_TEXT}</p>

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
