import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sanitizeNextPath } from "@/lib/sanitize-next-path";

const SUPPORTED_TYPES: ReadonlySet<EmailOtpType> = new Set(["recovery", "email"]);

function loginErrorRedirect(requestUrl: string, message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, requestUrl)
  );
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"), "/portal");

  if (!tokenHash || !type || !SUPPORTED_TYPES.has(type as EmailOtpType)) {
    return loginErrorRedirect(request.url, "invalid_or_expired_link");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    console.error("AUTH CONFIRM ERROR:", error);
    return loginErrorRedirect(request.url, "invalid_or_expired_link");
  }

  return NextResponse.redirect(new URL(next, request.url));
}