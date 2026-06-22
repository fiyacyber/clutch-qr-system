import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("customers")
    .select("is_admin")
    .eq("auth_user_id", user.id)
    .single();

  return Boolean(data?.is_admin);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  const form = await req.formData();
  const id = String(form.get("id") || "");
  const name = String(form.get("name") || "").trim();
  const description = String(form.get("description") || "").trim() || null;

  if (!name) {
    return NextResponse.redirect(new URL("/admin?error=group_name_required", req.url));
  }

  const admin = createSupabaseAdminClient();

  if (id) {
    await admin
      .from("customer_groups")
      .update({ name, description })
      .eq("id", id);
  } else {
    await admin.from("customer_groups").insert({ name, description });
  }

  return NextResponse.redirect(new URL("/admin", req.url));
}
