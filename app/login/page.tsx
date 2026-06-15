import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.CLUTCH_QR_BASE_URL}/auth/callback` }
  });
}

export default function LoginPage({ searchParams }: { searchParams: { sent?: string } }) {
  return (
    <main className="login-wrap">
      <section className="login-card">
        <Image src="/clutch-banner.png" alt="Clutch" width={480} height={180} priority />
        <h1>Clutch QR Dashboard</h1>
        <p className="muted">Enter the same email used at checkout. We’ll send a secure sign-in link.</p>
        {searchParams.sent ? <p className="alert">Check your email for your sign-in link.</p> : null}
        <form className="form" action={sendMagicLink}>
          <label className="label">Email<input className="input" name="email" type="email" required placeholder="you@company.com" /></label>
          <button className="btn primary" type="submit">Send Login Link</button>
        </form>
      </section>
    </main>
  );
}
