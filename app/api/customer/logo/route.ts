import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase-server";
import { nanoid } from "nanoid";

const CUSTOMER_LOGO_BUCKET = "customer-logos";
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
  const logoFile = form.get("logo");

  // Validate file is present
  if (!logoFile || typeof logoFile === "string" || logoFile.size === 0) {
    return redirectToPortal(req, "no_logo_selected");
  }

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

  // Validate file type
  const extension = ALLOWED_LOGO_TYPES.get(logoFile.type);

  if (!extension) {
    return redirectToPortal(req, "logo_type_not_supported");
  }

  // Validate file size
  if (logoFile.size > MAX_LOGO_SIZE) {
    return redirectToPortal(req, "logo_too_large");
  }

  // Generate safe filename
  const nextLogoPath = `${customer.id}/${nanoid(12)}.${extension}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await admin.storage
    .from(CUSTOMER_LOGO_BUCKET)
    .upload(nextLogoPath, logoFile, {
      cacheControl: "3600",
      contentType: logoFile.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("CUSTOMER LOGO UPLOAD ERROR:", uploadError);
    return redirectToPortal(req, "logo_upload_failed");
  }

  // Get public URL
  const logo_url = admin.storage
    .from(CUSTOMER_LOGO_BUCKET)
    .getPublicUrl(nextLogoPath).data.publicUrl;

  // Delete old logo if it exists
  if (customer.logo_path) {
    await admin.storage.from(CUSTOMER_LOGO_BUCKET).remove([customer.logo_path]);
  }

  // Update customer record
  const { error: updateError } = await admin
    .from("customers")
    .update({
      logo_url,
      logo_path: nextLogoPath,
    })
    .eq("id", customer.id);

  if (updateError) {
    console.error("CUSTOMER UPDATE ERROR:", updateError);

    // Clean up uploaded file if update fails
    if (nextLogoPath) {
      await admin.storage.from(CUSTOMER_LOGO_BUCKET).remove([nextLogoPath]);
    }

    return redirectToPortal(req, "logo_update_failed");
  }

  return redirectToPortal(req);
}

export async function DELETE(req: NextRequest) {
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

  // Delete logo file from storage
  if (customer.logo_path) {
    await admin.storage.from(CUSTOMER_LOGO_BUCKET).remove([customer.logo_path]);
  }

  // Update customer record
  const { error: updateError } = await admin
    .from("customers")
    .update({
      logo_url: null,
      logo_path: null,
    })
    .eq("id", customer.id);

  if (updateError) {
    console.error("CUSTOMER LOGO DELETE ERROR:", updateError);
    return redirectToPortal(req, "logo_delete_failed");
  }

  return redirectToPortal(req);
}
