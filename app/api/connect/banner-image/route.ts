import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const CONNECT_BANNER_BUCKET = "customer-logos";
const MAX_BANNER_SIZE = 2 * 1024 * 1024;
const ALLOWED_BANNER_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

function wantsJson(req: NextRequest) {
  return req.headers.get("accept")?.includes("application/json") || req.headers.get("x-clutch-fetch") === "true";
}

function bannerErrorResponse(req: NextRequest, error: string, status = 400) {
  return wantsJson(req) ? NextResponse.json({ error }, { status }) : NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const bannerEntry = form.get("banner");

  if (!bannerEntry || typeof bannerEntry === "string" || bannerEntry.size === 0) {
    return bannerErrorResponse(req, "Choose an image to upload.");
  }

  const extension = ALLOWED_BANNER_TYPES.get(bannerEntry.type);
  if (!extension) {
    return bannerErrorResponse(req, "File type not supported. Please use PNG, JPG, SVG, or WEBP.");
  }

  if (bannerEntry.size > MAX_BANNER_SIZE) {
    return bannerErrorResponse(req, "Image is too large. Maximum size is 2 MB.");
  }

  const admin = createSupabaseAdminClient();
  const bannerPath = `${customer.id}/${nanoid(12)}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(CONNECT_BANNER_BUCKET)
    .upload(bannerPath, bannerEntry, {
      cacheControl: "3600",
      contentType: bannerEntry.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("CONNECT BANNER UPLOAD ERROR", uploadError);
    return bannerErrorResponse(req, "Failed to upload image.", 500);
  }

  const imageUrl = admin.storage.from(CONNECT_BANNER_BUCKET).getPublicUrl(bannerPath).data.publicUrl;

  return NextResponse.json({ ok: true, imageUrl, imagePath: bannerPath });
}