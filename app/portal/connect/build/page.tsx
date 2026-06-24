import { redirect } from "next/navigation";
import Header from "@/components/Header";
import BuilderEditor from "@/components/BuilderEditor";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function BuilderPage() {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!profile) {
    redirect("/portal/connect");
  }

  return (
    <div className="page-shell page-shell-builder">
      <Header isAdmin={Boolean(customer.is_admin)} />
      <main className="builder-editor-main">
        <BuilderEditor profile={profile} />
      </main>
    </div>
  );
}
