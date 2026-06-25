import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const CONNECT_AVATAR_BUCKET = "customer-logos";
const MAX_AVATAR_SIZE = 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(req: NextRequest) {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const avatarEntry = form.get("avatar");

  if (!avatarEntry || typeof avatarEntry === "string" || avatarEntry.size === 0) {
    return NextResponse.json({ error: "Choose an avatar image to upload." }, { status: 400 });
  }

  if (!ALLOWED_AVATAR_TYPES.has(avatarEntry.type)) {
    return NextResponse.json({ error: "Profile photo type not supported." }, { status: 400 });
  }

  if (avatarEntry.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: "Profile photo must be 1MB or smaller." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const avatarPath = `${customer.id}/connect-avatar`;

  const { error: uploadError } = await admin.storage
    .from(CONNECT_AVATAR_BUCKET)
    .upload(avatarPath, avatarEntry, {
      cacheControl: "0",
      contentType: avatarEntry.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("CONNECT BUILDER AVATAR UPLOAD ERROR", uploadError);
    return NextResponse.json({ error: "Failed to upload profile photo." }, { status: 500 });
  }

  const publicUrl = admin.storage.from(CONNECT_AVATAR_BUCKET).getPublicUrl(avatarPath).data.publicUrl;
  const avatar_url = `${publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ avatar_url })
    .eq("customer_id", customer.id);

  if (profileError) {
    console.error("CONNECT BUILDER AVATAR PROFILE UPDATE ERROR", profileError);
    return NextResponse.json({ error: "Failed to update profile photo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatar_url });
}