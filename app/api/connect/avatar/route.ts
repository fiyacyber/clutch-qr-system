import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const CONNECT_AVATAR_BUCKET = "customer-logos";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);
const HEIC_AVATAR_TYPES = new Set(["image/heic", "image/heif"]);
const AVATAR_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
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

  if (HEIC_AVATAR_TYPES.has(avatarEntry.type)) {
    console.warn("CONNECT AVATAR UNSUPPORTED MIME", {
      fileName: avatarEntry.name,
      fileType: avatarEntry.type,
      fileSize: avatarEntry.size,
      customerId: customer.id,
    });
    return NextResponse.json({ error: "HEIC photos are not supported yet. Please upload PNG, JPG, or WebP." }, { status: 400 });
  }

  if (!ALLOWED_AVATAR_TYPES.has(avatarEntry.type)) {
    console.warn("CONNECT AVATAR UNSUPPORTED MIME", {
      fileName: avatarEntry.name,
      fileType: avatarEntry.type,
      fileSize: avatarEntry.size,
      customerId: customer.id,
    });
    return NextResponse.json({ error: "Profile photo must be PNG, JPG, WebP, or SVG." }, { status: 400 });
  }

  if (avatarEntry.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: "Profile photo must be 2MB or smaller." }, { status: 400 });
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    console.error("CONNECT AVATAR CONFIG ERROR", {
      message: error instanceof Error ? error.message : "Unknown Supabase admin client error",
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      customerId: customer.id,
    });
    return NextResponse.json({ error: "Server storage configuration is missing." }, { status: 500 });
  }

  const extension = AVATAR_EXTENSIONS.get(avatarEntry.type) || "jpg";
  const avatarPath = `${customer.id}/connect-avatar.${extension}`;
  const contentType = avatarEntry.type === "image/jpg" ? "image/jpeg" : avatarEntry.type;

  const { error: uploadError } = await admin.storage
    .from(CONNECT_AVATAR_BUCKET)
    .upload(avatarPath, avatarEntry, {
      cacheControl: "31536000",
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("CONNECT AVATAR UPLOAD ERROR", {
      message: uploadError.message,
      statusCode: (uploadError as any).statusCode,
      name: uploadError.name,
      customerId: customer.id,
      bucket: CONNECT_AVATAR_BUCKET,
      avatarPath,
    });
    return NextResponse.json({ error: "Profile photo upload failed. Check the customer-logos storage bucket." }, { status: 500 });
  }

  const publicUrl = admin.storage.from(CONNECT_AVATAR_BUCKET).getPublicUrl(avatarPath).data.publicUrl;
  const avatar_url = `${publicUrl}?v=${Date.now()}`;

  const { data: updatedProfile, error: profileError } = await admin
    .from("profiles")
    .update({ avatar_url })
    .eq("customer_id", customer.id)
    .select("id")
    .maybeSingle();

  if (profileError) {
    console.error("CONNECT AVATAR PROFILE UPDATE ERROR", {
      message: profileError.message,
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
      customerId: customer.id,
      avatarPath,
    });
    return NextResponse.json({ error: "Profile photo uploaded, but the profile record could not be updated." }, { status: 500 });
  }

  if (!updatedProfile) {
    console.error("CONNECT AVATAR PROFILE UPDATE EMPTY", {
      customerId: customer.id,
      avatarPath,
    });
    return NextResponse.json({ error: "Profile photo uploaded, but no profile record was found for this customer." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, avatar_url });
}
