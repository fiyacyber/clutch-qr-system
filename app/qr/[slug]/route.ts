import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function hashIp(ip: string | null) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const admin = createSupabaseAdminClient();
  const { data: code } = await admin.from("qr_codes").select("*").eq("slug", params.slug).eq("is_active", true).maybeSingle();
  if (!code) return NextResponse.redirect("https://clutchprintshop.com");

  await admin.from("qr_scans").insert({
    qr_code_id: code.id,
    slug: code.slug,
    ip_hash: hashIp(req.headers.get("x-forwarded-for")),
    user_agent: req.headers.get("user-agent"),
    referrer: req.headers.get("referer")
  });
  await admin.from("qr_codes").update({ scan_count: (code.scan_count || 0) + 1 }).eq("id", code.id);
  return NextResponse.redirect(code.destination_url);
}
