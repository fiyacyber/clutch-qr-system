import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function sendMagicLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/login?error=missing-email");
  }

  const supabase = await createSupabaseServerClient();

  const redirectUrl =
    process.env.CLUTCH_QR_BASE_URL
      ? `${process.env.CLUTCH_QR_BASE_URL}/auth/callback`
      : "https://qr.clutchprintshop.com/auth/callback";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    console.error("OTP ERROR:", error);

    redirect(
      `/login?error=${encodeURIComponent(
        JSON.stringify(error, null, 2)
      )}`
    );
  }

  redirect("/login?sent=1");
}


export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;
  const prefilledEmail = params.email ? decodeURIComponent(params.email) : "";

  return (
    <main className="login-wrap">
      <section className="login-card">
        <Image
          src="/clutch-banner.png"
          alt="Clutch"
          width={480}
          height={180}
          priority
        />

        <h1>Clutch QR Dashboard</h1>

        <p className="muted">
          Enter your email to receive a magic link, or use your password if you
          already have one.
        </p>

        {params.sent ? (
          <p className="alert">Check your email for your sign-in link.</p>
        ) : null}

        {params.error ? (
          <p className="alert">Error: {decodeURIComponent(params.error)}</p>
        ) : null}

        <form className="form" action={sendMagicLink}>
          <label className="label">
            Email
            <input
              className="input"
              name="email"
              type="email"
              defaultValue={prefilledEmail}
              required
              placeholder="you@company.com"
            />
          </label>

          <button className="btn primary" type="submit">
            Send Login Link
          </button>
        </form>

        <div style={{ marginTop: 24 }}>
          <p className="muted">Or sign in with your password:</p>
          <form className="form" action="/api/auth/login-password" method="post">
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
            <label className="label">
              Password
              <input
                className="input"
                name="password"
                type="password"
                required
                placeholder="Enter your password"
              />
            </label>
            <button className="btn secondary" type="submit">
              Sign in with Password
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
