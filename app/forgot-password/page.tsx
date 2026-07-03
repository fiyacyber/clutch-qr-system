import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import styles from "../login/login.module.css";
import { buildPasswordResetRedirectUrl } from "@/lib/onboarding-routing";
import { sanitizeNextPath } from "@/lib/safe-redirect";

function buildForgotPasswordRedirect({
  sent,
  error,
  email,
  next,
  context,
}: {
  sent?: boolean;
  error?: string;
  email?: string;
  next?: string;
  context?: string;
}) {
  const params = new URLSearchParams();
  if (sent) params.set("sent", "1");
  if (error) params.set("error", error);
  if (email) params.set("email", email);
  if (next) params.set("next", next);
  if (context) params.set("context", context);
  const query = params.toString();
  return query ? `/forgot-password?${query}` : "/forgot-password";
}

async function sendPasswordReset(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const context = String(formData.get("context") || "").trim().toLowerCase();
  const requestedNext = String(formData.get("next") || "").trim();
  const safeNext = sanitizeNextPath(requestedNext, "/portal");

  if (!email) {
    redirect(
      buildForgotPasswordRedirect({
        error: "missing-email",
        next: safeNext,
        context,
      })
    );
  }

  const supabase = await createSupabaseServerClient();
  const redirectUrl = buildPasswordResetRedirectUrl(safeNext);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error("PASSWORD RESET ERROR:", error);
    redirect(
      buildForgotPasswordRedirect({
        error: error.message || "Unable to send reset link",
        email,
        next: safeNext,
        context,
      })
    );
  }

  redirect(
    buildForgotPasswordRedirect({
      sent: true,
      email,
      next: safeNext,
      context,
    })
  );
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
  const heading = isSetupFlow ? "Set Up Your Profile" : "Forgot Password?";
  const intro = isSetupFlow
    ? "Enter the email used at checkout and we'll send a secure link to start Guided Setup."
    : "We'll help you get back into your account";
  const successHeading = isSetupFlow ? "Check your email" : "Check your email";
  const successBody = isSetupFlow
    ? "We've sent a secure setup link to your email address."
    : "We've sent a password reset link to your email address.";
  const buttonLabel = isSetupFlow ? "Send Setup Link" : "Send Reset Link";

  return (
    <div className={styles.container}>
      <div className={styles.background} />

      <div className={styles.contentSingle}>

        <div className={styles.formSide}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2>{heading}</h2>
              <p>{intro}</p>
            </div>

            {params.sent ? (
              <div className={styles.successAlert}>
                <div className={styles.successIcon}>✓</div>
                <h3>{successHeading}</h3>
                <p>{successBody}</p>
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
                {isSetupFlow ? <input type="hidden" name="context" value="setup" /> : null}
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
                  {buttonLabel}
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
