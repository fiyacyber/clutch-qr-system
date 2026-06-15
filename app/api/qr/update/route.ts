import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { normalizeUrl } from "@/lib/qr";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const name = String(form.get("name") || "Clutch QR Code").trim();
  const destination_url = normalizeUrl(String(form.get("destination_url") || ""));
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin.from("customers").select("*").eq("auth_user_id", user.id).single();
  if (!customer) return NextResponse.redirect(new URL("/portal?error=no_customer", req.url));

  await admin.from("qr_codes").update({ name, destination_url }).eq("id", id).eq("customer_id", customer.id);
  return NextResponse.redirect(new URL("/portal", req.url));
}
