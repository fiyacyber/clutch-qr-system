import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const CONNECT_BANNER_BUCKET = "customer-logos";
const MAX_BANNER_SIZE = 3 * 1024 * 1024;
const ALLOWED_BANNER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(req: NextRequest) {
  const { customer } = await requireCustomer();

  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const bannerEntry = form.get("banner");

  if (!bannerEntry || typeof bannerEntry === "string" || bannerEntry.size === 0) {
    return NextResponse.json({ error: "Choose a banner image to upload." }, { status: 400 });
  }

  if (!ALLOWED_BANNER_TYPES.has(bannerEntry.type)) {
    return NextResponse.json({ error: "Please upload a PNG, JPG, WebP, or SVG banner image." }, { status: 400 });
  }

  if (bannerEntry.size > MAX_BANNER_SIZE) {
    return NextResponse.json({ error: "Banner image must be 3MB or smaller." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const bannerPath = `${customer.id}/connect-banner`;

  const { error: uploadError } = await admin.storage
    .from(CONNECT_BANNER_BUCKET)
    .upload(bannerPath, bannerEntry, {
      cacheControl: "31536000",
      contentType: bannerEntry.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("CONNECT GLOBAL BANNER UPLOAD ERROR", uploadError);
    return NextResponse.json({ error: "We could not upload that banner image. Please try again." }, { status: 500 });
  }

  const publicUrl = admin.storage.from(CONNECT_BANNER_BUCKET).getPublicUrl(bannerPath).data.publicUrl;
  const banner_url = `${publicUrl}?v=${Date.now()}`;

  return NextResponse.json({ ok: true, banner_url });
}
