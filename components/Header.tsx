import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return (
    <header className="header">
      <Link href="/portal" className="header-brand"><Image src="/clutch-banner.png" alt="Clutch" width={300} height={60} priority /></Link>
      <nav className="header-nav">
        <Link href="/portal">Portal</Link>
        <Link href="/portal/connect">Clutch Connect</Link>
        <Link href="/portal/create">Create QR</Link>
        <Link href="/portal/analytics">Analytics</Link>
        {isAdmin ? <Link href="/admin">Admin</Link> : null}
        {data.user ? (
          <form action="/auth/signout" method="post"><button type="submit">Logout</button></form>
        ) : <Link href="/login">Login</Link>}
      </nav>
    </header>
  );
}
