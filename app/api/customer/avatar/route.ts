import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const ACCOUNT_AVATAR_BUCKET = "customer-logos";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
]);

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) return unauthorized();

  return NextResponse.json(
    {
      avatar_url: typeof user.user_metadata?.account_avatar_url === "string"
        ? user.user_metadata.account_avatar_url
        : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) return unauthorized();

  const form = await req.formData();
  const avatarEntry = form.get("avatar");

  if (!avatarEntry || typeof avatarEntry === "string" || avatarEntry.size === 0) {
    return NextResponse.json({ error: "Choose a profile photo to upload." }, { status: 400 });
  }

  const extension = AVATAR_EXTENSIONS.get(avatarEntry.type);
  if (!extension) {
    return NextResponse.json({ error: "Profile photo must be PNG, JPG, or WebP." }, { status: 400 });
  }

  if (avatarEntry.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: "Profile photo must be 2MB or smaller." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const avatarPath = `${customer.id}/account-avatar-${nanoid(12)}.${extension}`;
  const contentType = avatarEntry.type === "image/jpg" ? "image/jpeg" : avatarEntry.type;

  const { error: uploadError } = await admin.storage
    .from(ACCOUNT_AVATAR_BUCKET)
    .upload(avatarPath, avatarEntry, {
      cacheControl: "31536000",
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("ACCOUNT AVATAR UPLOAD ERROR", {
      message: uploadError.message,
      customerId: customer.id,
      avatarPath,
    });
    return NextResponse.json({ error: "Profile photo upload failed." }, { status: 500 });
  }

  const publicUrl = admin.storage.from(ACCOUNT_AVATAR_BUCKET).getPublicUrl(avatarPath).data.publicUrl;
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;
  const previousAvatarPath = typeof user.user_metadata?.account_avatar_path === "string"
    ? user.user_metadata.account_avatar_path
    : null;

  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      account_avatar_url: avatarUrl,
      account_avatar_path: avatarPath,
    },
  });

  if (metadataError) {
    await admin.storage.from(ACCOUNT_AVATAR_BUCKET).remove([avatarPath]);
    console.error("ACCOUNT AVATAR METADATA ERROR", {
      message: metadataError.message,
      customerId: customer.id,
      avatarPath,
    });
    return NextResponse.json({ error: "Profile photo uploaded, but the account could not be updated." }, { status: 500 });
  }

  if (previousAvatarPath && previousAvatarPath !== avatarPath) {
    const { error: cleanupError } = await admin.storage
      .from(ACCOUNT_AVATAR_BUCKET)
      .remove([previousAvatarPath]);

    if (cleanupError) {
      console.warn("ACCOUNT AVATAR CLEANUP ERROR", {
        message: cleanupError.message,
        customerId: customer.id,
        previousAvatarPath,
      });
    }
  }

  return NextResponse.json({ ok: true, avatar_url: avatarUrl });
}

export async function DELETE() {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) return unauthorized();

  const admin = createSupabaseAdminClient();
  const avatarPath = typeof user.user_metadata?.account_avatar_path === "string"
    ? user.user_metadata.account_avatar_path
    : null;

  const nextMetadata = { ...(user.user_metadata || {}) } as Record<string, unknown>;
  delete nextMetadata.account_avatar_url;
  delete nextMetadata.account_avatar_path;

  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: nextMetadata,
  });

  if (metadataError) {
    return NextResponse.json({ error: "Profile photo could not be removed." }, { status: 500 });
  }

  if (avatarPath) {
    const { error: removeError } = await admin.storage.from(ACCOUNT_AVATAR_BUCKET).remove([avatarPath]);
    if (removeError) {
      console.warn("ACCOUNT AVATAR DELETE ERROR", {
        message: removeError.message,
        customerId: customer.id,
        avatarPath,
      });
    }
  }

  return NextResponse.json({ ok: true, avatar_url: null });
}
