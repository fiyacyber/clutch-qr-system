import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { clutchConnectProfileUrl, normalizeUrl } from "@/lib/qr";
import {
  getCustomerPlan,
  getSubscriptionLockMessage,
  isCustomerSubscriptionLocked,
} from "@/lib/plans";
import { loadAccountAccess } from "@/lib/account-access-server";
import { canPerformAccountAction } from "@/lib/account-access";
import {
  DEFAULT_QR_DESIGN,
  QR_BODY_PATTERNS,
  QR_CANVAS_SHAPES,
  QR_COLOR_MODES,
  QR_EYE_CENTER_SHAPES,
  QR_EYE_FRAME_SHAPES,
  getQrDesignScanIssues,
  isHexColor,
  type AdvancedQrDesign,
  type QrBodyPattern,
  type QrCanvasShape,
  type QrColorMode,
  type QrEyeCenterShape,
  type QrEyeFrameShape,
} from "@/lib/qr-design";

const QR_LOGO_BUCKET = "qr-logos";
const MAX_LOGO_SIZE = 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);
const DOT_STYLES = new Set(["square", "rounded", "dots"]);
const CORNER_STYLES = new Set(["square", "dot", "extra-rounded"]);
const QR_TYPES = new Set(["url", "connect_profile"]);
const DOWNLOAD_SIZES = new Set(["social", "card", "print"]);

function pickColor(value: FormDataEntryValue | null, fallback: string) {
  const color = String(value || fallback).trim();
  return isHexColor(color) ? color.toLowerCase() : fallback;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  let destinationUrl = normalizeUrl(String(form.get("destination_url") || ""));
  const foregroundColor = pickColor(form.get("foreground_color"), DEFAULT_QR_DESIGN.bodyColor);
  const backgroundColor = pickColor(form.get("background_color"), DEFAULT_QR_DESIGN.backgroundColor);
  const gradientEndColor = pickColor(form.get("gradient_end_color"), DEFAULT_QR_DESIGN.gradientEndColor);
  const eyeFrameColor = pickColor(form.get("eye_frame_color"), foregroundColor);
  const eyeCenterColor = pickColor(form.get("eye_center_color"), foregroundColor);
  const outerStrokeColor = pickColor(form.get("outer_stroke_color"), foregroundColor);

  const requestedDotStyle = String(form.get("dot_style") || "square");
  const dotStyle = DOT_STYLES.has(requestedDotStyle) ? requestedDotStyle : "square";
  const requestedCornerStyle = String(form.get("corner_style") || "square");
  const cornerStyle = CORNER_STYLES.has(requestedCornerStyle) ? requestedCornerStyle : "square";
  const requestedQrType = String(form.get("qr_type") || "url").trim();
  const qrType = QR_TYPES.has(requestedQrType) ? requestedQrType : "url";
  const profileIdRaw = String(form.get("profile_id") || "").trim();

  const requestedQrShape = String(form.get("qr_shape") || DEFAULT_QR_DESIGN.qrShape) as QrCanvasShape;
  const qrShape = QR_CANVAS_SHAPES.has(requestedQrShape) ? requestedQrShape : DEFAULT_QR_DESIGN.qrShape;
  const requestedBodyPattern = String(form.get("body_pattern") || DEFAULT_QR_DESIGN.bodyPattern) as QrBodyPattern;
  const bodyPattern = QR_BODY_PATTERNS.has(requestedBodyPattern) ? requestedBodyPattern : DEFAULT_QR_DESIGN.bodyPattern;
  const requestedEyeFrameShape = String(form.get("eye_frame_shape") || DEFAULT_QR_DESIGN.eyeFrameShape) as QrEyeFrameShape;
  const eyeFrameShape = QR_EYE_FRAME_SHAPES.has(requestedEyeFrameShape) ? requestedEyeFrameShape : DEFAULT_QR_DESIGN.eyeFrameShape;
  const requestedEyeCenterShape = String(form.get("eye_center_shape") || DEFAULT_QR_DESIGN.eyeCenterShape) as QrEyeCenterShape;
  const eyeCenterShape = QR_EYE_CENTER_SHAPES.has(requestedEyeCenterShape) ? requestedEyeCenterShape : DEFAULT_QR_DESIGN.eyeCenterShape;
  const requestedColorMode = String(form.get("color_mode") || DEFAULT_QR_DESIGN.colorMode) as QrColorMode;
  const colorMode = QR_COLOR_MODES.has(requestedColorMode) ? requestedColorMode : DEFAULT_QR_DESIGN.colorMode;
  const outerStrokeEnabled = String(form.get("outer_stroke_enabled") || "false") === "true";

  const requestedDownloadSize = String(form.get("download_size") || "print");
  const downloadSize = DOWNLOAD_SIZES.has(requestedDownloadSize) ? requestedDownloadSize : "print";
  const printPiece = String(form.get("print_piece") || "").trim().slice(0, 100);
  const trackingEnabled = String(form.get("tracking_enabled") || "true") !== "false";
  const campaignName = String(form.get("campaign_name") || "").trim().slice(0, 160);
  const campaignOwner = String(form.get("campaign_owner") || "").trim().slice(0, 160);
  const placement = String(form.get("placement") || "").trim().slice(0, 200);
  const notes = String(form.get("notes") || "").trim().slice(0, 500);

  const logoEntry = form.get("logo");
  const logoFile = logoEntry && typeof logoEntry !== "string" && logoEntry.size > 0 ? logoEntry : null;

  if (!name) return NextResponse.json({ error: "QR name is required." }, { status: 400 });
  if (!destinationUrl) return NextResponse.json({ error: "Destination URL is required." }, { status: 400 });
  try {
    new URL(destinationUrl);
  } catch {
    return NextResponse.json({ error: "Enter a complete destination URL, such as https://example.com." }, { status: 400 });
  }

  const design: AdvancedQrDesign = {
    qrShape,
    bodyPattern,
    eyeFrameShape,
    eyeCenterShape,
    colorMode,
    bodyColor: foregroundColor,
    gradientEndColor,
    eyeFrameColor,
    eyeCenterColor,
    backgroundColor,
    outerStrokeEnabled,
    outerStrokeColor,
  };
  const designIssues = getQrDesignScanIssues(design);
  if (designIssues.length) {
    return NextResponse.json({ error: designIssues[0], issues: designIssues }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();
  if (!customer) return NextResponse.json({ error: "Customer record not found." }, { status: 404 });

  const access = await loadAccountAccess(admin, customer);
  if (!canPerformAccountAction(access, "create-qr")) {
    return NextResponse.json({ error: "This account does not have available Clutch Codes creation capacity." }, { status: 403 });
  }
  if (isCustomerSubscriptionLocked(customer)) {
    return NextResponse.json({ error: getSubscriptionLockMessage(customer) }, { status: 402 });
  }

  const { data: qrCodes } = await admin
    .from("qr_codes")
    .select("id", { count: "exact" })
    .eq("customer_id", customer.id)
    .neq("is_system", true);
  const used = qrCodes?.length || 0;
  const plan = getCustomerPlan(customer);
  const limit = access.effectiveQrCapacity ?? Number.MAX_SAFE_INTEGER;
  if (used >= limit) {
    return NextResponse.json({
      error: plan.code === "qr_pro"
        ? "Account limit reached. Upgrade to Agency for additional QR codes."
        : plan.code === "connect_basic" || plan.code === "connect_plus"
          ? "Dynamic QR campaigns are not included on your current plan. Upgrade to QR Pro to create dynamic QR codes."
          : `You've reached your QR code limit (${limit}). Contact Clutch to increase it.`,
    }, { status: 400 });
  }

  const slug = `clutch-${nanoid(8).toLowerCase()}`;
  let logoEnabled = false;
  let logoUrl: string | null = null;
  let logoPath: string | null = null;

  if (logoFile) {
    const extension = ALLOWED_LOGO_TYPES.get(logoFile.type);
    if (!extension) {
      return NextResponse.json({ error: "File type not supported. Please use PNG, JPG, SVG, or WEBP." }, { status: 400 });
    }
    if (logoFile.size > MAX_LOGO_SIZE) {
      return NextResponse.json({ error: "File is too large. Maximum size is 1 MB." }, { status: 400 });
    }

    logoPath = `${customer.id}/${slug}/${nanoid(12)}.${extension}`;
    const { error: uploadError } = await admin.storage.from(QR_LOGO_BUCKET).upload(logoPath, logoFile, {
      cacheControl: "3600",
      contentType: logoFile.type,
      upsert: false,
    });
    if (uploadError) {
      console.error("QR LOGO UPLOAD ERROR:", uploadError);
      return NextResponse.json({ error: "Failed to upload logo. Please try again." }, { status: 500 });
    }
    logoEnabled = true;
    logoUrl = admin.storage.from(QR_LOGO_BUCKET).getPublicUrl(logoPath).data.publicUrl;
  }

  let profileId: string | null = null;
  if (qrType === "connect_profile") {
    if (!profileIdRaw) return NextResponse.json({ error: "Select a Clutch Connect profile." }, { status: 400 });
    const { data: profile } = await admin
      .from("profiles")
      .select("id, slug")
      .eq("id", profileIdRaw)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: "Selected profile was not found." }, { status: 404 });
    profileId = profile.id;
    destinationUrl = clutchConnectProfileUrl(profile.slug);
  }

  const styleConfig = {
    version: 2,
    design: {
      qr_shape: qrShape,
      body_pattern: bodyPattern,
      eye_frame_shape: eyeFrameShape,
      eye_center_shape: eyeCenterShape,
      color_mode: colorMode,
      body_color: foregroundColor,
      gradient_end_color: gradientEndColor,
      eye_frame_color: eyeFrameColor,
      eye_center_color: eyeCenterColor,
      background_color: backgroundColor,
      outer_stroke_enabled: outerStrokeEnabled,
      outer_stroke_color: outerStrokeColor,
    },
    download_size: downloadSize,
    print_piece: printPiece || null,
    tracking: {
      enabled: trackingEnabled,
      campaign_name: campaignName || null,
      owner: campaignOwner || null,
      placement: placement || null,
      notes: notes || null,
    },
  };

  const { data: createdQr, error } = await admin.from("qr_codes").insert({
    customer_id: customer.id,
    name,
    destination_url: destinationUrl,
    slug,
    foreground_color: foregroundColor,
    background_color: backgroundColor,
    dot_style: dotStyle,
    corner_style: cornerStyle,
    qr_type: qrType,
    profile_id: profileId,
    style_config: styleConfig,
    logo_enabled: logoEnabled,
    logo_url: logoUrl,
    logo_path: logoPath,
    scan_count: 0,
    is_active: true,
  }).select().single();

  if (error) {
    if (logoPath) await admin.storage.from(QR_LOGO_BUCKET).remove([logoPath]);
    console.error("QR creation error:", error);
    return NextResponse.json({ error: "Failed to create QR code. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, qr: createdQr });
}
