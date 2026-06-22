import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { CONNECT_EVENT_TYPES, extractIpHash } from "@/lib/connect";

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdminClient();

  const body = await req.json().catch(() => null);
  const profile_id = String(body?.profile_id || "").trim();
  const profile_link_id = String(body?.profile_link_id || "").trim() || null;
  const event_type = String(body?.event_type || "").trim();
  const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : null;

  if (!profile_id || !CONNECT_EVENT_TYPES.has(event_type)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("id", profile_id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Profile unavailable" }, { status: 404 });
  }

  const ip_hash = extractIpHash(req.headers);
  const user_agent = req.headers.get("user-agent") || null;

  const { error } = await admin.from("profile_click_events").insert({
    profile_id,
    profile_link_id,
    event_type,
    ip_hash,
    user_agent,
    metadata,
  });

  if (error) {
    console.error("CONNECT EVENT INSERT ERROR", error);
    return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
