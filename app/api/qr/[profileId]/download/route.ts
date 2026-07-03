import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { buildConnectPublicProfileUrl } from "@/lib/qr";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, is_active")
    .eq("id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const profileUrl = buildConnectPublicProfileUrl(profile.slug);

  try {
    const png = await QRCode.toBuffer(profileUrl, {
      type: "png",
      width: 1200,
      margin: 1,
      color: {
        dark: "#384862",
        light: "#FFFFFF",
      },
    });

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename=clutch-connect-${profile.slug}.png`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("QR DOWNLOAD ERROR", error);
    return NextResponse.json({ error: "Failed to generate QR image." }, { status: 500 });
  }
}
