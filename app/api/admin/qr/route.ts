import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { normalizeUrl } from "@/lib/qr";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const admin = createSupabaseAdminClient();
  const { data: me } = await admin.from("customers").select("is_admin").eq("auth_user_id", user.id).single();
  if (!me?.is_admin) return NextResponse.redirect(new URL("/portal", req.url));
  const form = await req.formData();
  await admin.from("qr_codes").insert({
    customer_id: String(form.get("customer_id")),
    name: String(form.get("name") || "Clutch QR Code"),
    destination_url: normalizeUrl(String(form.get("destination_url") || "")),
    slug: `clutch-${nanoid(8).toLowerCase()}`
  });
  return NextResponse.redirect(new URL("/admin", req.url));
}
