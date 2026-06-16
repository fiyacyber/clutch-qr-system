import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function sendMagicLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email) {
    redirect("/login?error=missing-email");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.CLUTCH_QR_BASE_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?sent=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-wrap">
      <section className="login-card">
        <Image src="/clutch-banner.png" alt="Clutch" width={480} height={180} priority />

        <h1>Clutch QR Dashboard</h1>

        <p className="muted">
          Enter the same email used at checkout. We’ll send a secure sign-in link.
        </p>

        {params.sent ? (
          <p className="alert">Check your email for your sign-in link.</p>
        ) : null}

        {params.error ? (
          <p className="alert">Error: {params.error}</p>
        ) : null}

        <form className="form" action={sendMagicLink}>
          <label className="label">
            Email
            <input
              className="input"
              name="email"
              type="email"
              required
              placeholder="you@company.com"
            />
          </label>

          <button className="btn primary" type="submit">
            Send Login Link
          </button>
        </form>
      </section>
    </main>
  );
}
