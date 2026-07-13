import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";

const QR_LOGO_BUCKET = "qr-logos";
const MAX_LOGO_SIZE = 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const FORBIDDEN_FIELDS = new Set([
  "slug",
  "destination_url",
  "customer_id",
  "profile_id",
  "connect_profile_id",
  "card_order_id",
  "is_system",
  "qr_type",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeStyleConfig(value: unknown) {
  if (!isObject(value)) return {};

  const style = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  if (typeof style.preset === "string") sanitized.preset = style.preset;
  if (typeof style.dotStyle === "string") sanitized.dotStyle = style.dotStyle;
  if (typeof style.cornerStyle === "string") sanitized.cornerStyle = style.cornerStyle;
  if (typeof style.finderEyes === "string") sanitized.finderEyes = style.finderEyes;
  if (typeof style.frameStyle === "string") sanitized.frameStyle = style.frameStyle;
  if (typeof style.frameColor === "string" && HEX_COLOR.test(style.frameColor)) sanitized.frameColor = style.frameColor;
  if (typeof style.accentColor === "string" && HEX_COLOR.test(style.accentColor)) sanitized.accentColor = style.accentColor;
  if (typeof style.logoUrl === "string" || style.logoUrl === null) sanitized.logoUrl = style.logoUrl;
  if (typeof style.logoPath === "string" || style.logoPath === null) sanitized.logoPath = style.logoPath;
  if (typeof style.logoSize === "number") sanitized.logoSize = Math.max(12, Math.min(44, Math.round(style.logoSize)));

  return sanitized;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const access = await loadAccountAccess(admin, customer);
  if (!access.canCustomizeQr) {
    return NextResponse.json({ error: "QR customization requires an active Clutch Codes subscription." }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";
  let foregroundColor = "";
  let backgroundColor = "";
  let styleConfigRaw: unknown = {};
  let removeLogo = false;
  let logoFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    for (const key of formData.keys()) {
      if (FORBIDDEN_FIELDS.has(key)) {
        return NextResponse.json({ error: `Field ${key} is not editable.` }, { status: 400 });
      }
    }

    foregroundColor = String(formData.get("foreground_color") || "").trim();
    backgroundColor = String(formData.get("background_color") || "").trim();
    const styleConfigText = String(formData.get("style_config") || "{}");
    try {
      styleConfigRaw = JSON.parse(styleConfigText);
    } catch {
      return NextResponse.json({ error: "Invalid style_config payload." }, { status: 400 });
    }

    removeLogo = String(formData.get("remove_logo") || "false") === "true";
    const logoEntry = formData.get("logo");
    logoFile = logoEntry && typeof logoEntry !== "string" && logoEntry.size > 0 ? logoEntry : null;
  } else {
    const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || !isObject(payload)) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    for (const key of Object.keys(payload)) {
      if (FORBIDDEN_FIELDS.has(key)) {
        return NextResponse.json({ error: `Field ${key} is not editable.` }, { status: 400 });
      }
    }

    foregroundColor = String(payload.foreground_color || "").trim();
    backgroundColor = String(payload.background_color || "").trim();
    styleConfigRaw = payload.style_config || {};
    removeLogo = Boolean(payload.remove_logo);
  }

  if (!HEX_COLOR.test(foregroundColor) || !HEX_COLOR.test(backgroundColor)) {
    return NextResponse.json({ error: "Invalid QR color values." }, { status: 400 });
  }

  if (logoFile) {
    const extension = ALLOWED_LOGO_TYPES.get(logoFile.type);
    if (!extension) {
      return NextResponse.json(
        { error: "File type not supported. Please use PNG, JPG, SVG, or WEBP." },
        { status: 400 }
      );
    }

    if (logoFile.size > MAX_LOGO_SIZE) {
      return NextResponse.json({ error: "File is too large. Maximum size is 1 MB." }, { status: 400 });
    }
  }

  const { data: qrCode } = await admin
    .from("qr_codes")
    .select("id, customer_id, is_system, qr_type, style_config")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!qrCode) {
    return NextResponse.json({ error: "QR code not found." }, { status: 404 });
  }

  if (!qrCode.is_system || qrCode.qr_type !== "smart_card") {
    return NextResponse.json({ error: "Only the included Smart Card QR can be customized." }, { status: 403 });
  }

  const existingStyle = sanitizeStyleConfig(qrCode.style_config || {});
  const incomingStyle = sanitizeStyleConfig(styleConfigRaw);
  const nextStyle: Record<string, unknown> = {
    ...existingStyle,
    ...incomingStyle,
  };

  const existingLogoPath = typeof existingStyle.logoPath === "string" ? existingStyle.logoPath : null;
  let nextLogoPath = existingLogoPath;

  if (removeLogo) {
    if (existingLogoPath) {
      await admin.storage.from(QR_LOGO_BUCKET).remove([existingLogoPath]);
    }
    nextStyle.logoUrl = null;
    nextStyle.logoPath = null;
    nextLogoPath = null;
  }

  if (logoFile) {
    const extension = ALLOWED_LOGO_TYPES.get(logoFile.type)!;
    const newLogoPath = `${customer.id}/${id}/smart-card-${nanoid(12)}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(QR_LOGO_BUCKET)
      .upload(newLogoPath, logoFile, {
        cacheControl: "3600",
        contentType: logoFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("SMART CARD LOGO UPLOAD ERROR", uploadError);
      return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 });
    }

    if (nextLogoPath && nextLogoPath !== newLogoPath) {
      await admin.storage.from(QR_LOGO_BUCKET).remove([nextLogoPath]);
    }

    nextLogoPath = newLogoPath;
    nextStyle.logoPath = newLogoPath;
    nextStyle.logoUrl = admin.storage.from(QR_LOGO_BUCKET).getPublicUrl(newLogoPath).data.publicUrl;
  }

  const { data: updated, error: updateError } = await admin
    .from("qr_codes")
    .update({
      foreground_color: foregroundColor,
      background_color: backgroundColor,
      style_config: nextStyle,
    })
    .eq("id", id)
    .eq("customer_id", customer.id)
    .eq("is_system", true)
    .eq("qr_type", "smart_card")
    .select("id, foreground_color, background_color, style_config")
    .single();

  if (updateError) {
    console.error("SMART CARD STYLE UPDATE ERROR", updateError);
    return NextResponse.json({ error: "Failed to save QR style." }, { status: 500 });
  }

  return NextResponse.json({ success: true, qr: updated });
}
