"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./login.module.css";

const REMEMBERED_USERNAME_KEY = "clutch-remembered-username";

type LoginCredentialsFieldsProps = {
  defaultEmail?: string;
};

export default function LoginCredentialsFields({
  defaultEmail = "",
}: LoginCredentialsFieldsProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [rememberUsername, setRememberUsername] = useState(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    try {
      const rememberedUsername = window.localStorage.getItem(
        REMEMBERED_USERNAME_KEY,
      );

      if (rememberedUsername) {
        setRememberUsername(true);

        if (!defaultEmail) {
          setEmail(rememberedUsername);
        }
      }
    } catch {
      // The sign-in form still works when browser storage is unavailable.
    } finally {
      setPreferenceLoaded(true);
    }
  }, [defaultEmail]);

  useEffect(() => {
    if (!preferenceLoaded) return;

    try {
      if (rememberUsername && email.trim()) {
        window.localStorage.setItem(
          REMEMBERED_USERNAME_KEY,
          email.trim(),
        );
      } else if (!rememberUsername) {
        window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
      }
    } catch {
      // Remembering the username is optional and must never block sign-in.
    }
  }, [email, preferenceLoaded, rememberUsername]);

  return (
    <>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="login-email">
          Email Address
        </label>
        <input
          id="login-email"
          className={styles.input}
          name="email"
          type="email"
          required
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className={styles.formGroup}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor="login-password">
            Password
          </label>
          <Link href="/forgot-password" className={styles.forgotLink}>
            Forgot password?
          </Link>
        </div>
        <input
          id="login-password"
          className={styles.input}
          name="password"
          type="password"
          required
          placeholder="Enter your password"
          autoComplete="current-password"
        />
      </div>

      <label className={styles.rememberOption}>
        <input
          className={styles.rememberCheckbox}
          type="checkbox"
          checked={rememberUsername}
          onChange={(event) => setRememberUsername(event.target.checked)}
        />
        <span className={styles.rememberSwitch} aria-hidden="true">
          <span className={styles.rememberThumb} />
        </span>
        <span className={styles.rememberText}>Remember username</span>
      </label>
    </>
  );
}
