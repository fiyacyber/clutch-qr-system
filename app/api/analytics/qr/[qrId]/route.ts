import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";
import { hasActiveClutchCodesSubscription, loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { analyticsScopeForCode, buildBasicCodeAnalytics } from "@/lib/order-linked-analytics";

const defaultDependencies = { requireCustomer, createSupabaseAdminClient, loadAccountAccess, loadOrderLinkedQrAccess };

export function createQrCodeAnalyticsHandler(dependencies: Partial<typeof defaultDependencies> = {}) {
  const deps = { ...defaultDependencies, ...dependencies };
  return async function handler(
  req: NextRequest,
  context: { params: Promise<{ qrId: string }> }
) {
  try {
    const { qrId } = await context.params;
    const { user, customer } = await deps.requireCustomer();

    if (!user || !customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = deps.createSupabaseAdminClient();
    const access = await deps.loadAccountAccess(admin, customer);
    if (!access.canUseCampaignAnalytics) return NextResponse.json({ error: "Campaign analytics access is locked." }, { status: 403 });

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
    const codeAccess = await deps.loadOrderLinkedQrAccess(admin, customer, code.id);
    const scope = analyticsScopeForCode({
      isAdmin: customer.is_admin,
      hasPaidAnalytics: hasActiveClutchCodesSubscription(customer),
      codeAccess,
    });
    if (scope === "none") {
      return NextResponse.json({ error: "Your Included Access Has Ended", accessState: codeAccess.state }, { status: 403 });
    }

    if (scope === "basic_code") {
      const { data: scans, error: scansError } = await admin.from("qr_scans")
        .select("qr_code_id, created_at").eq("qr_code_id", qrId).order("created_at", { ascending: true });
      if (scansError) throw scansError;
      return NextResponse.json(buildBasicCodeAnalytics(code, scans || []));
    }

    // Get all scans for this QR code
    const { data: scans, error: scansError } = await admin
      .from("qr_scans")
      .select("*")
      .eq("qr_code_id", qrId)
      .order("created_at", { ascending: false });

    if (scansError) throw scansError;

    return NextResponse.json({
      scope,
      code,
      scans: scans || [],
      linkedProfileId: code.connect_profile_id || code.profile_id || null,
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
}

export const GET = createQrCodeAnalyticsHandler();
