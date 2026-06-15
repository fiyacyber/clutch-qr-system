import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { normalizeUrl } from "@/lib/qr";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = String(form.get("name") || "Clutch QR Code").trim();
  const destination_url = normalizeUrl(String(form.get("destination_url") || ""));
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin.from("customers").select("*").eq("auth_user_id", user.id).single();
  if (!customer) return NextResponse.redirect(new URL("/portal?error=no_customer", req.url));

  const { error } = await admin.from("qr_codes").insert({
    customer_id: customer.id,
    name,
    destination_url,
    slug: `clutch-${nanoid(8).toLowerCase()}`
  });
  const url = error ? `/portal?error=${encodeURIComponent(error.message)}` : "/portal";
  return NextResponse.redirect(new URL(url, req.url));
}
