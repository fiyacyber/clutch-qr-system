import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase-server";
import { normalizeUrl } from "@/lib/qr";

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

  const { error } = await admin
    .from("qr_codes")
    .update({
      name,
      destination_url,
      foreground_color,
      background_color,
      dot_style,
      corner_style,
      logo_enabled: false,
    })
    .eq("id", id)
    .eq("customer_id", customer.id);

  if (error) {
    console.error("QR UPDATE ERROR:", error);
  }

  return NextResponse.redirect(
    new URL("/portal", req.url)
  );
}
