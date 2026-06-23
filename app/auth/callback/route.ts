import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("AUTH CALLBACK ERROR:", error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  const userId = data?.user?.id;
  const safeNext = next && next.startsWith("/") ? next : "/portal";
  const destination = new URL(safeNext, request.url);
  const response = NextResponse.redirect(destination);

  if (!userId) {
    return response;
  }

  const admin = createSupabaseAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("must_change_password")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (customerError) {
    console.error("AUTH CALLBACK customer lookup error", customerError.message || customerError);
    return response;
  }

  if (customer?.must_change_password) {
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
