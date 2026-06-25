import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
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

  if (data.user) {
    const admin = createSupabaseAdminClient();
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("must_change_password")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (customerError) {
      console.error("CUSTOMER LOOKUP ERROR:", customerError);
    }

    if (customer?.must_change_password) {
      redirect("/change-password");
    }
  }

  redirect("/portal");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;
  const email = params.email ? decodeURIComponent(params.email) : "";

  return (
    <div className={styles.container}>
      <div className={styles.background} />

      <div className={styles.contentSingle}>
        <div className={styles.formSide}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2>Sign In</h2>
              <p>Access your Clutch portal</p>
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
                  defaultValue={email}
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
