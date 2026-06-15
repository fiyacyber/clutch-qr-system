import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("customers").select("is_admin").eq("auth_user_id", user.id).single();
  return Boolean(data?.is_admin);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.redirect(new URL("/portal", req.url));
  const form = await req.formData();
  const admin = createSupabaseAdminClient();
  const id = String(form.get("id") || "");
  const email = String(form.get("email") || "").trim().toLowerCase();
  const company_name = String(form.get("company_name") || "").trim();
  const qr_limit = Number(form.get("qr_limit") || 10);
  const is_admin = form.get("is_admin") === "on";

  if (id) {
    await admin.from("customers").update({ company_name, qr_limit, is_admin }).eq("id", id);
  } else if (email) {
    const { data: authUser } = await admin.auth.admin.createUser({ email, email_confirm: true });
    await admin.from("customers").insert({ auth_user_id: authUser.user?.id, email, company_name, qr_limit });
  }
  return NextResponse.redirect(new URL("/admin", req.url));
}
