import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return (
    <header className="header">
      <Link href="/portal"><Image src="/clutch-banner.png" alt="Clutch" width={240} height={90} priority /></Link>
      <nav className="header-nav">
        <Link href="/portal">Portal</Link>
        {isAdmin ? <Link href="/admin">Admin</Link> : null}
        {data.user ? (
          <form action="/auth/signout" method="post"><button type="submit">Logout</button></form>
        ) : <Link href="/login">Login</Link>}
      </nav>
    </header>
  );
}
