import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") || "").trim();

  const complexityChecks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  if (password.length < 12) {
    return NextResponse.json({ error: "Password must be at least 12 characters." }, { status: 400 });
  }

  if (complexityChecks.some((check) => !check)) {
    return NextResponse.json(
      {
        error: "Password must include uppercase, lowercase, a number, and a symbol.",
      },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in again to change your password." }, { status: 401 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    console.error("Password update failed", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error: customerError } = await admin
    .from("customers")
    .update({ must_change_password: false })
    .eq("auth_user_id", user.id);

  if (customerError) {
    console.error("Failed to update must_change_password", customerError.message);
    return NextResponse.json({ error: "Unable to complete password change." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, redirectTo: "/portal" });
  response.cookies.delete("clutch-must-change-password");
  return response;
}
