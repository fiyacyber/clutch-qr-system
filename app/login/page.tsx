import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import styles from "./login.module.css";

async function handlePasswordSignIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    redirect("/login?error=missing-credentials");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("PASSWORD SIGNIN ERROR:", error);
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/portal");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <div className={styles.container}>
      <div className={styles.background} />
      
      <div className={styles.content}>
        {/* Left Side - Branding */}
        <div className={styles.brandingSide}>
          <div className={styles.brandingContent}>
            <Image
              src="/clutch-banner.png"
              alt="Clutch"
              width={300}
              height={112}
              priority
            />
            <h1 className={styles.brandingTitle}>QR Code Dashboard</h1>
            <p className={styles.brandingSubtitle}>
              Create, track, and manage QR codes for all your print marketing campaigns.
            </p>
            
            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>✓</span>
                <span>Unlimited QR codes</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>✓</span>
                <span>Real-time analytics</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>✓</span>
                <span>Custom branding</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>✓</span>
                <span>Linktree profiles</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className={styles.formSide}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2>Sign In</h2>
              <p>Access your QR code dashboard</p>
            </div>

            {params.error ? (
              <div className={styles.alert}>
                {decodeURIComponent(params.error)}
              </div>
            ) : null}

            <form className={styles.form} action={handlePasswordSignIn}>
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

              <div className={styles.formGroup}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>Password</label>
                  <Link href="/forgot-password" className={styles.forgotLink}>
                    Forgot password?
                  </Link>
                </div>
                <input
                  className={styles.input}
                  name="password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              <button className={styles.submitButton} type="submit">
                Sign In
                <span className={styles.arrowIcon}>→</span>
              </button>
            </form>

            <div className={styles.divider}>or</div>

            <p className={styles.helpText}>
              Don't have an account? <a href="https://clutchprintshop.com" className={styles.signupLink}>Get started</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
