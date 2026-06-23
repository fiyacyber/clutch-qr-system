import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import styles from "../login/login.module.css";

async function sendPasswordReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=missing-email");
  }

  const supabase = await createSupabaseServerClient();

  const redirectUrl =
    process.env.CLUTCH_QR_BASE_URL
      ? `${process.env.CLUTCH_QR_BASE_URL}/auth/reset-password`
      : "https://qr.clutchprintshop.com/auth/reset-password";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error("PASSWORD RESET ERROR:", error);
    redirect(
      `/forgot-password?error=${encodeURIComponent(
        error.message || "Unable to send reset link"
      )}`
    );
  }

  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <div className={styles.container}>
      <div className={styles.background} />
      
      <div className={styles.content}>
        <div className={styles.brandingSide}>
          <div className={styles.brandingContent}>
            <Image
              src="/clutch-banner.png"
              alt="Clutch"
              width={300}
              height={112}
              priority
            />
            <h1 className={styles.brandingTitle}>Reset Your Password</h1>
            <p className={styles.brandingSubtitle}>
              We'll send you a secure link to reset your password in seconds.
            </p>
          </div>
        </div>

        <div className={styles.formSide}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2>Forgot Password?</h2>
              <p>We'll help you get back into your account</p>
            </div>

            {params.sent ? (
              <div className={styles.successAlert}>
                <div className={styles.successIcon}>✓</div>
                <h3>Check your email</h3>
                <p>We've sent a password reset link to your email address.</p>
                <p className={styles.helpText} style={{ marginTop: "8px" }}>
                  The link expires in 24 hours.
                </p>
              </div>
            ) : null}

            {params.error ? (
              <div className={styles.alert}>
                {decodeURIComponent(params.error)}
              </div>
            ) : null}

            {!params.sent ? (
              <form className={styles.form} action={sendPasswordReset}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email Address</label>
                  <input
                    className={styles.input}
                    name="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>

                <button className={styles.submitButton} type="submit">
                  Send Reset Link
                  <span className={styles.arrowIcon}>→</span>
                </button>
              </form>
            ) : null}

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <Link href="/login" className={styles.signupLink}>
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
