import { redirect } from "next/navigation";
import Header from "@/components/Header";
import ProfileCreatorEditor from "@/components/ProfileCreatorEditor";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function EditConnectProfilePage() {
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

  const publicUrl = `/u/${profile.slug}`;

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />
      <main className="profile-creator-main">
        <ProfileCreatorEditor initialProfile={profile} publicUrl={publicUrl} />
      </main>
    </div>
  );
}
