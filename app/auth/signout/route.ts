import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function performSignout(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("clutch-must-change-password");
  return response;
}

export async function POST(request: Request) {
  return performSignout(request);
}

export async function GET(request: Request) {
  return performSignout(request);
}
