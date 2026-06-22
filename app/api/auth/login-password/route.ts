import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "").trim();

  if (!email || !password) {
    return NextResponse.redirect(new URL("/login?error=missing-credentials", req.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("PASSWORD SIGNIN ERROR:", error);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url));
  }

  const response = NextResponse.redirect(new URL("/portal", req.url));
  const userId = data?.user?.id;

  if (!userId) {
    return response;
  }

  const admin = createSupabaseAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("must_change_password")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!customerError && customer?.must_change_password) {
    response.cookies.set("clutch-must-change-password", "true", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.headers.set("location", "/change-password");
    return response;
  }

  response.cookies.delete("clutch-must-change-password");
  return response;
}
