import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  const admin = createSupabaseAdminClient();

  const { data: qrCode, error } = await admin
    .from("qr_codes")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !qrCode) {
    return NextResponse.redirect("https://clutchprintshop.com");
  }

  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

  await admin.from("qr_scans").insert({
    qr_code_id: qrCode.id,
    slug,
    ip_hash: ipHash,
    user_agent: req.headers.get("user-agent"),
    referrer: req.headers.get("referer"),
  });

  await admin
    .from("qr_codes")
    .update({ scan_count: Number(qrCode.scan_count || 0) + 1 })
    .eq("id", qrCode.id);

  return NextResponse.redirect(qrCode.destination_url);
}
