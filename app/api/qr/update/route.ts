import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase-server";
import { nanoid } from "nanoid";
import { clutchConnectProfileUrl, normalizeUrl } from "@/lib/qr";
import { getSubscriptionLockMessage, isCustomerSubscriptionLocked } from "@/lib/plans";
import { loadAccountAccess } from "@/lib/account-access-server";

const QR_LOGO_BUCKET = "qr-logos";
const MAX_LOGO_SIZE = 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);
const QR_TYPES = new Set(["url", "connect_profile"]);

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const id = String(form.get("id") || "");

  const name = String(
    form.get("name") || "Clutch QR Code"
  ).trim();

  const destination_url = normalizeUrl(
    String(form.get("destination_url") || "")
  );

  const foreground_color = String(
    form.get("foreground_color") || "#384862"
  );

  const background_color = String(
    form.get("background_color") || "#ffffff"
  );

  const dot_style = String(
    form.get("dot_style") || "square"
  );

  const corner_style = String(
    form.get("corner_style") || "square"
  );

  const requestedQrType = String(form.get("qr_type") || "url").trim();
  const qr_type = QR_TYPES.has(requestedQrType) ? requestedQrType : "url";
  const profile_id_raw = String(form.get("profile_id") || "").trim();

  const remove_logo =
    String(form.get("remove_logo") || "false") === "true";

  const theme = String(form.get("theme") || "default");

  const logoEntry = form.get("logo");
  const logoFile =
    logoEntry && typeof logoEntry !== "string" && logoEntry.size > 0
      ? logoEntry
      : null;

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
  if (!access.canEditOwnedQr) {
    return NextResponse.json({ error: "This account cannot edit QR codes." }, { status: 403 });
  }
  if (!access.canUploadQrLogo && (logoFile || remove_logo)) {
    return NextResponse.json({ error: "Logo customization requires an active Clutch Codes subscription." }, { status: 403 });
  }

  if (isCustomerSubscriptionLocked(customer)) {
    return NextResponse.json(
      { error: getSubscriptionLockMessage(customer) },
      { status: 402 }
    );
  }

  const { data: qrCode, error: qrError } = await admin
    .from("qr_codes")
    .select("id, logo_path, logo_url, foreground_color, background_color, dot_style, corner_style")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .single();

  if (qrError || !qrCode) {
    console.error("QR LOOKUP ERROR:", qrError);
    return NextResponse.json({ error: "QR code not found" }, { status: 404 });
  }

  let logo_enabled = Boolean(qrCode.logo_url);
  let logo_url = qrCode.logo_url as string | null;
  let logo_path = qrCode.logo_path as string | null;
  let oldLogoPath: string | null = null;

  if (remove_logo) {
    oldLogoPath = logo_path;
    logo_enabled = false;
    logo_url = null;
    logo_path = null;
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
      return NextResponse.json(
        { error: "File is too large. Maximum size is 1 MB." },
        { status: 400 }
      );
    }

    const nextLogoPath = `${customer.id}/${id}/${nanoid(12)}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from(QR_LOGO_BUCKET)
      .upload(nextLogoPath, logoFile, {
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

    oldLogoPath = logo_path;
    logo_enabled = true;
    logo_path = nextLogoPath;
    logo_url = admin.storage
      .from(QR_LOGO_BUCKET)
      .getPublicUrl(nextLogoPath).data.publicUrl;
  }

  let resolvedDestination = destination_url;
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
    resolvedDestination = clutchConnectProfileUrl(profile.slug);
  }

  const { error } = await admin
    .from("qr_codes")
    .update({
      name,
      destination_url: resolvedDestination,
      foreground_color: access.canCustomizeQr ? foreground_color : qrCode.foreground_color,
      background_color: access.canCustomizeQr ? background_color : qrCode.background_color,
      dot_style: access.canCustomizeQr ? dot_style : qrCode.dot_style,
      corner_style: access.canCustomizeQr ? corner_style : qrCode.corner_style,
      qr_type,
      profile_id,
      theme,
      logo_enabled,
      logo_url,
      logo_path,
    })
    .eq("id", id)
    .eq("customer_id", customer.id);

  if (error) {
    console.error("QR UPDATE ERROR:", error);

    if (logo_path && logo_path !== qrCode.logo_path) {
      await admin.storage.from(QR_LOGO_BUCKET).remove([logo_path]);
    }

    return NextResponse.json(
      { error: "Failed to save QR code. Please try again." },
      { status: 500 }
    );
  } else if (oldLogoPath && oldLogoPath !== logo_path) {
    const { error: removeError } = await admin.storage
      .from(QR_LOGO_BUCKET)
      .remove([oldLogoPath]);

    if (removeError) {
      console.error("QR LOGO REMOVE ERROR:", removeError);
    }
  }

  return NextResponse.json({ success: true });
}
