import { headers } from "next/headers";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { extractIpHash } from "@/lib/connect";
import { getBrowser, getDeviceType, getOperatingSystem, getReferrerSource } from "@/lib/analytics";
import { validateBuilderConfig } from "@/lib/builder-config";
import ConnectProfileView from "@/components/connect/ConnectProfileView";

export default async function PublicConnectProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string>>;
}) {
  const { slug } = await params;
  const query = (await searchParams) || {};
  const source = typeof query.source === "string" ? query.source.trim() : "";

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) {
    const { data: draftProfile } = await admin
      .from("profiles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (!draftProfile) {
      return (
        <main className="connect-public-shell connect-public-shell-fallback">
          <section className="connect-public-fallback-card">
            <p className="connect-eyebrow">Clutch Connect</p>
            <h1>That profile is not live yet.</h1>
            <p>
              The card is pointing at <strong>/u/{slug}</strong>, but there is no published public profile at that address yet.
              Open the builder, publish the profile, or update the card destination to the correct slug.
            </p>
            <div className="connect-public-fallback-actions">
              <Link className="btn primary" href="/portal/connect/build">Open Profile Builder</Link>
              <Link className="btn secondary" href="/portal/connect">Go to Connect Dashboard</Link>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="connect-public-shell connect-public-shell-fallback">
        <section className="connect-public-fallback-card">
          <p className="connect-eyebrow">Clutch Connect</p>
          <h1>This profile is saved, but not published.</h1>
          <p>
            The page exists in the dashboard, but it is currently marked inactive. Turn it on in the builder to make this scan link live.
          </p>
          <div className="connect-public-fallback-actions">
            <Link className="btn primary" href="/portal/connect/build">Open Profile Builder</Link>
            <Link className="btn secondary" href="/portal/connect">Go to Connect Dashboard</Link>
          </div>
        </section>
      </main>
    );
  }

  const { data: linkRows } = await admin
    .from("profile_links")
    .select("id, label, url, icon, platform, custom_color, icon_style, description")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const requestHeaders = await headers();
  const ip_hash = extractIpHash(requestHeaders);
  const user_agent = requestHeaders.get("user-agent") || null;
  const referrer = requestHeaders.get("referer") || null;

  await admin.from("profile_click_events").insert({
    profile_id: profile.id,
    event_type: "profile_view",
    ip_hash,
    user_agent,
    metadata: {
      slug,
      source: source || null,
      view_kind: "profile_view",
    },
  });

  await admin.from("connect_events").insert({
    profile_id: profile.id,
    qr_code_id: null,
    event_type: "profile_view",
    visitor_id: ip_hash,
    ip_hash,
    user_agent,
    device_type: getDeviceType(user_agent),
    browser: getBrowser(user_agent),
    os: getOperatingSystem(user_agent),
    country: requestHeaders.get("x-vercel-ip-country"),
    region: requestHeaders.get("x-vercel-ip-country-region"),
    city: requestHeaders.get("x-vercel-ip-city"),
    referrer: getReferrerSource(referrer),
  });

  const builderBlocks = profile.builder_config && validateBuilderConfig(profile.builder_config)
    ? profile.builder_config.blocks
    : [];

  return (
    <ConnectProfileView
      profile={profile}
      blocks={builderBlocks as any}
      socialLinks={(linkRows || []) as any}
      mode="public"
    />
  );
}
