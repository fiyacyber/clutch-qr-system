import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { user, customer } = await requireCustomer();

    if (!user || !customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // Get all QR codes for this customer
    const { data: codes, error: codesError } = await admin
      .from("qr_codes")
      .select("id, name, slug, scan_count, created_at, updated_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (codesError) throw codesError;

    const qrIds = (codes || []).map((code) => code.id);

    let scans: any[] = [];
    if (qrIds.length > 0) {
      const { data: scansData, error: scansError } = await admin
        .from("qr_scans")
        .select("*")
        .in("qr_code_id", qrIds)
        .order("created_at", { ascending: false });

      if (scansError) throw scansError;
      scans = scansData || [];
    }

    return NextResponse.json({
      codes: codes || [],
      scans,
      customer: { id: customer.id, email: customer.email },
    });
  } catch (error) {
    console.error("Analytics summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
