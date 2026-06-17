import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase-server";
import { nanoid } from "nanoid";
import { normalizeUrl } from "@/lib/qr";

const QR_LOGO_BUCKET = "qr-logos";
const MAX_LOGO_SIZE = 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

function redirectToPortal(req: NextRequest, error?: string) {
  const url = new URL("/portal", req.url);

  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url);
}

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

  const remove_logo =
    String(form.get("remove_logo") || "false") === "true";

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
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const admin = createSupabaseAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!customer) {
    return NextResponse.redirect(
      new URL("/portal?error=no_customer", req.url)
    );
  }

  const { data: qrCode, error: qrError } = await admin
    .from("qr_codes")
    .select("id, logo_path, logo_url")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .single();

  if (qrError || !qrCode) {
    console.error("QR LOOKUP ERROR:", qrError);
    return redirectToPortal(req, "qr_not_found");
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
      return redirectToPortal(req, "logo_type_not_supported");
    }

    if (logoFile.size > MAX_LOGO_SIZE) {
      return redirectToPortal(req, "logo_too_large");
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
      return redirectToPortal(req, "logo_upload_failed");
    }

    oldLogoPath = logo_path;
    logo_enabled = true;
    logo_path = nextLogoPath;
    logo_url = admin.storage
      .from(QR_LOGO_BUCKET)
      .getPublicUrl(nextLogoPath).data.publicUrl;
  }

  const { error } = await admin
    .from("qr_codes")
    .update({
      name,
      destination_url,
      foreground_color,
      background_color,
      dot_style,
      corner_style,
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

    return redirectToPortal(req, "qr_update_failed");
  } else if (oldLogoPath && oldLogoPath !== logo_path) {
    const { error: removeError } = await admin.storage
      .from(QR_LOGO_BUCKET)
      .remove([oldLogoPath]);

    if (removeError) {
      console.error("QR LOGO REMOVE ERROR:", removeError);
    }
  }

  return redirectToPortal(req);
}
