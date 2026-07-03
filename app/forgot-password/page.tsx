import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sanitizeNextPath } from "@/lib/safe-redirect";
import Link from "next/link";
import styles from "../login/login.module.css";

async function sendPasswordReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const requestedNext = String(formData.get("next") || "").trim();
  const safeNext = sanitizeNextPath(requestedNext, "/portal");
  const isSetupFlow =
    safeNext === "/setup/guided" ||
    safeNext.startsWith("/setup/guided?") ||
    safeNext === "/portal/connect/setup" ||
    safeNext.startsWith("/portal/connect/setup?");

  const contextQuery = isSetupFlow ? "&context=setup" : "";
  const nextQuery = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
  const emailQuery = email ? `&email=${encodeURIComponent(email)}` : "";

  if (!email) {
    redirect(`/forgot-password?error=missing-email${contextQuery}${nextQuery}`);
  }

  const supabase = await createSupabaseServerClient();

  const baseUrl =
    process.env.CLUTCH_QR_BASE_URL ||
    process.env.CLUTCH_APP_BASE_URL ||
    "https://qr.clutchprintshop.com";
  const changePasswordPath = `/change-password?next=${encodeURIComponent(safeNext)}`;
  const redirectUrl = `${baseUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(changePasswordPath)}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error("PASSWORD RESET ERROR:", error);
    redirect(
      `/forgot-password?error=${encodeURIComponent(
        error.message || "Unable to send reset link"
      )}${contextQuery}${nextQuery}${emailQuery}`
    );
  }

  redirect(`/forgot-password?sent=1${contextQuery}${nextQuery}${emailQuery}`);
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    email?: string;
    next?: string;
    context?: string;
  }>;
}) {
  const params = await searchParams;
  const email = params.email ? decodeURIComponent(params.email) : "";
  const next = sanitizeNextPath(params.next || "", "");
  const isSetupFlow =
    params.context === "setup" ||
    next === "/setup/guided" ||
    next.startsWith("/setup/guided?") ||
    next === "/portal/connect/setup" ||
    next.startsWith("/portal/connect/setup?");

  return (
    <div className={styles.container}>
      <div className={styles.background} />

      <div className={styles.contentSingle}>

        <div className={styles.formSide}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2>{isSetupFlow ? "Set Up Your Profile" : "Forgot Password?"}</h2>
              <p>
                {isSetupFlow
                  ? "Enter the email used at checkout and we’ll send a secure link to start Guided Setup."
                  : "We'll help you get back into your account"}
              </p>
            </div>

            {params.sent ? (
              <div className={styles.successAlert}>
                <div className={styles.successIcon}>✓</div>
                <h3>Check your email</h3>
                <p>
                  {isSetupFlow
                    ? "We've sent a secure setup link to your email address."
                    : "We've sent a password reset link to your email address."}
                </p>
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
                {next ? <input type="hidden" name="next" value={next} /> : null}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email Address</label>
                  <input
                    className={styles.input}
                    name="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    autoComplete="email"
                    defaultValue={email}
                  />
                </div>

                <button className={styles.submitButton} type="submit">
                  {isSetupFlow ? "Send Setup Link" : "Send Reset Link"}
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
