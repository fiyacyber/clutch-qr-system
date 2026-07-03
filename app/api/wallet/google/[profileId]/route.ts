import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { buildConnectPublicProfileUrl, getClutchConnectPublicBaseUrl } from "@/lib/qr";
import { createGoogleWalletUrl } from "@/lib/google-wallet";
import { trackWalletEvent } from "@/lib/wallet-events";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, contact_name, business_name, title, phone, email, website")
    .eq("id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const appUrl = getClutchConnectPublicBaseUrl();
  const fallbackUrl = new URL(buildConnectPublicProfileUrl(profile.slug));
  fallbackUrl.searchParams.set("wallet", "google_unavailable");

  try {
    const walletUrl = createGoogleWalletUrl(
      {
        id: profile.id,
        slug: profile.slug,
        contactName: profile.contact_name,
        businessName: profile.business_name,
        title: profile.title,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
      },
      appUrl
    );

    await trackWalletEvent(profile.id, "google", req.headers);

    return NextResponse.redirect(walletUrl, { status: 302 });
  } catch (error) {
    console.error("GOOGLE WALLET URL ERROR", error);
    return NextResponse.redirect(fallbackUrl, { status: 302 });
  }
}
