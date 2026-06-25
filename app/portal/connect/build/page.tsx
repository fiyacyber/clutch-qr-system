import { redirect } from "next/navigation";
import BuilderEditor from "@/components/BuilderEditor";
import { createDefaultBuilderConfig } from "@/lib/builder-config";
import { buildDefaultProfileSlug, normalizeSlug } from "@/lib/connect";
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

  let builderProfile = profile;

  if (!builderProfile) {
    const fallbackName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.company_name || user.email?.split("@")[0] || "Clutch Connect";
    const slugSource = `${customer.company_name || fallbackName || customer.email}-${customer.id}`;
    const fallbackSlug = normalizeSlug(slugSource) || buildDefaultProfileSlug(slugSource);
    const themeColor = "#FFA665";

    const { data: createdProfile, error } = await admin
      .from("profiles")
      .insert({
        customer_id: customer.id,
        business_name: customer.company_name || fallbackName,
        contact_name: fallbackName,
        title: "",
        phone: "",
        email: user.email || customer.email || "",
        website: "",
        avatar_url: customer.logo_url || null,
        bio: "",
        slug: fallbackSlug,
        is_active: true,
        theme_color: themeColor,
        layout: "grid",
        show_card_showcase: false,
        show_lead_form: true,
        builder_config: createDefaultBuilderConfig(themeColor),
      })
      .select("*")
      .single();

    if (error || !createdProfile) {
      console.error("CONNECT BUILDER PROFILE CREATE ERROR", error);
      redirect("/portal/connect?error=profile-create-failed");
    }

    builderProfile = createdProfile;
  }

  return (
    <div className="page-shell page-shell-builder">
      <main className="builder-editor-main">
        <BuilderEditor profile={builderProfile} />
      </main>
    </div>
  );
}
