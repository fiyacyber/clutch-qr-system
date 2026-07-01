import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { clutchConnectProfileUrl, normalizeUrl } from "@/lib/qr";
import {
  getCustomerPlan,
  getEffectiveQrLimit,
  getSubscriptionLockMessage,
  isCustomerSubscriptionLocked,
} from "@/lib/plans";

const QR_LOGO_BUCKET = "qr-logos";
const MAX_LOGO_SIZE = 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

const DOT_STYLES = new Set([
  "square",
  "rounded",
  "dots",
  "classy",
  "classy-rounded",
  "extra-rounded",
]);

const CORNER_STYLES = new Set(["square", "dot", "extra-rounded"]);
const QR_TYPES = new Set(["url", "connect_profile"]);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  let destination_url = normalizeUrl(String(form.get("destination_url") || ""));
  const foreground_color = String(form.get("foreground_color") || "#384862");
  const background_color = String(form.get("background_color") || "#ffffff");
  const dot_style = String(form.get("dot_style") || "square");
  const corner_style = String(form.get("corner_style") || "square");
  const requestedQrType = String(form.get("qr_type") || "url").trim();
  const qr_type = QR_TYPES.has(requestedQrType) ? requestedQrType : "url";
  const profile_id_raw = String(form.get("profile_id") || "").trim();
  const theme = String(form.get("theme") || "default");

  const logoEntry = form.get("logo");
  const logoFile =
    logoEntry && typeof logoEntry !== "string" && logoEntry.size > 0
      ? logoEntry
      : null;

  // Validation
  if (!name) {
    return NextResponse.json({ error: "QR name is required." }, { status: 400 });
  }

  if (!destination_url) {
    return NextResponse.json({ error: "Destination URL is required." }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(destination_url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format. Must start with https://" }, { status: 400 });
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

  if (!customer) {
    return NextResponse.json({ error: "Customer record not found." }, { status: 404 });
  }

  if (isCustomerSubscriptionLocked(customer)) {
    return NextResponse.json(
      { error: getSubscriptionLockMessage(customer) },
      { status: 402 }
    );
  }

  // Check limit
  const { data: qrCodes } = await admin
    .from("qr_codes")
    .select("id", { count: "exact" })
    .eq("customer_id", customer.id);

  const used = qrCodes?.length || 0;
  const plan = getCustomerPlan(customer);
  const limit = getEffectiveQrLimit(customer);

  if (used >= limit) {
    return NextResponse.json(
      {
        error:
          plan.code === "qr_pro"
            ? "Account limit reached. Upgrade to Agency for additional QR codes."
            : plan.code === "free_qr"
              ? "Your free Clutch QR plan includes 1 QR code. Upgrade to QR Pro for more."
            : `You've reached your QR code limit (${limit}). Contact Clutch to increase it.`,
      },
      { status: 400 }
    );
  }

  const slug = `clutch-${nanoid(8).toLowerCase()}`;

  if (!DOT_STYLES.has(dot_style)) {
    return NextResponse.json({ error: "Invalid dot style." }, { status: 400 });
  }

  if (!CORNER_STYLES.has(corner_style)) {
    return NextResponse.json({ error: "Invalid corner style." }, { status: 400 });
  }

  let logo_enabled = false;
  let logo_url: string | null = null;
  let logo_path: string | null = null;

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

    logo_path = `${customer.id}/${slug}/${nanoid(12)}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from(QR_LOGO_BUCKET)
      .upload(logo_path, logoFile, {
        cacheControl: "3600",
        contentType: logoFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("QR LOGO UPLOAD ERROR:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload logo. Please try again." },
        { status: 500 }
      );
    }

    logo_enabled = true;
    logo_url = admin.storage.from(QR_LOGO_BUCKET).getPublicUrl(logo_path).data.publicUrl;
  }

  let profile_id: string | null = null;

  if (qr_type === "connect_profile") {
    if (!profile_id_raw) {
      return NextResponse.json({ error: "Select a Clutch Connect profile." }, { status: 400 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, slug")
      .eq("id", profile_id_raw)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Selected profile was not found." }, { status: 404 });
    }

    profile_id = profile.id;
    destination_url = clutchConnectProfileUrl(profile.slug);
  }

  const primaryInsertPayload: Record<string, any> = {
    customer_id: customer.id,
    name,
    destination_url,
    slug,
    foreground_color,
    background_color,
    dot_style,
    corner_style,
    qr_type,
    profile_id,
    theme,
    logo_enabled,
    logo_url,
    logo_path,
    scan_count: 0,
    is_active: true
  };

  let { data: createdQR, error } = await admin
    .from("qr_codes")
    .insert(primaryInsertPayload)
    .select()
    .single();

  if (error) {
    const fallbackInsertPayload: Record<string, any> = {
      customer_id: customer.id,
      name,
      destination_url,
      slug,
      foreground_color,
      background_color,
      dot_style,
      corner_style,
      logo_enabled,
      logo_url,
      logo_path,
      scan_count: 0,
      is_active: true,
    };

    if (qr_type === "connect_profile") {
      fallbackInsertPayload.qr_type = "connect_profile";
      fallbackInsertPayload.profile_id = profile_id;
    }

    const fallbackResult = await admin
      .from("qr_codes")
      .insert(fallbackInsertPayload)
      .select()
      .single();

    if (!fallbackResult.error) {
      createdQR = fallbackResult.data;
      error = null;
    }
  }

  if (error) {
    if (logo_path) {
      await admin.storage.from(QR_LOGO_BUCKET).remove([logo_path]);
    }
    console.error("QR creation error:", error);
    return NextResponse.json({ error: "Failed to create QR code. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    qr: createdQR
  });
}
