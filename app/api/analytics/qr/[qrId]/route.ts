import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ qrId: string }> }
) {
  try {
    const { qrId } = await context.params;
    const { user, customer } = await requireCustomer();

    if (!user || !customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    // Get the QR code - verify it belongs to this customer
    const { data: code, error: codeError } = await admin
      .from("qr_codes")
      .select("*")
      .eq("id", qrId)
      .eq("customer_id", customer.id)
      .single();

    if (codeError || !code) {
      return NextResponse.json({ error: "QR code not found" }, { status: 404 });
    }

    // Get all scans for this QR code
    const { data: scans, error: scansError } = await admin
      .from("qr_scans")
      .select("*")
      .eq("qr_code_id", qrId)
      .order("created_at", { ascending: false });

    if (scansError) throw scansError;

    return NextResponse.json({
      code,
      scans: scans || [],
      customer: { id: customer.id, email: customer.email },
    });
  } catch (error) {
    console.error("QR analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch QR analytics" },
      { status: 500 }
    );
  }
}
