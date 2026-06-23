import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { extractIpHash } from "@/lib/connect";
import ConnectPublicProfile from "@/components/ConnectPublicProfile";

export default async function PublicConnectProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string>>;
}) {
  const { slug } = await params;
  const query = (await searchParams) || {};

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) notFound();

  const { data: linkRows } = await admin
    .from("profile_links")
    .select("id, label, url, icon, platform, custom_color, icon_style, description")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const requestHeaders = await headers();
  const ip_hash = extractIpHash(requestHeaders);

  await admin.from("profile_click_events").insert({
    profile_id: profile.id,
    event_type: "profile_view",
    ip_hash,
    user_agent: null,
    metadata: { slug },
  });

  return (
    <ConnectPublicProfile
      profileId={profile.id}
      slug={profile.slug}
      businessName={profile.business_name}
      contactName={profile.contact_name}
      title={profile.title}
      phone={profile.phone}
      email={profile.email}
      website={profile.website}
      bio={profile.bio}
      avatarUrl={profile.avatar_url}
      coverUrl={profile.cover_url}
      themeColor={profile.theme_color}
      links={(linkRows || []) as any}
      layout={(profile.layout || "grid") as any}
      showCardShowcase={profile.show_card_showcase !== false}
      showLeadForm={profile.show_lead_form !== false}
      sent={query.sent === "1"}
      rateLimited={query.rate_limited === "1"}
      error={query.error === "1"}
    />
  );
}
