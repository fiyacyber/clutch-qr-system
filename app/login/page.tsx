import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePostLoginRedirect } from "@/lib/onboarding-routing";
import { sanitizeNextPath } from "@/lib/safe-redirect";
import LoginCredentialsFields from "./LoginCredentialsFields";
import styles from "./login.module.css";

async function handlePasswordSignIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const requestedNext = String(formData.get("next") || "").trim();

  if (!email || !password) {
    const safeNext = sanitizeNextPath(requestedNext, "");
    redirect(`/login?error=missing-credentials${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`);
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

  if (data.user?.id) {
    const redirectPath = await resolvePostLoginRedirect({
      authUserId: data.user.id,
      requestedNext,
    });
    redirect(redirectPath);
  }

  redirect("/portal");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    email?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const email = params.email ? decodeURIComponent(params.email) : "";
  const next = sanitizeNextPath(params.next || "", "");

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
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <LoginCredentialsFields defaultEmail={email} />

              <button className={styles.submitButton} type="submit">
                Sign In
                <span className={styles.arrowIcon}>→</span>
              </button>
            </form>

            <div className={styles.divider}>or</div>

            <p className={styles.helpText}>
              Don&apos;t have an account?{" "}
              <a href="https://clutchprintshop.com" className={styles.signupLink}>
                Get started
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
