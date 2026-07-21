import { NextRequest, NextResponse } from "next/server";
import { MAX_BRAND_COLORS, normalizeBrandColors } from "@/lib/brand-colors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";

async function getAuthenticatedCustomer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, customer: null };

  const admin = createSupabaseAdminClient();
  const { data: customer, error } = await admin
    .from("customers")
    .select("id, brand_colors")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[customer-brand-colors] customer lookup failed", {
      code: error.code ?? null,
      message: error.message,
    });
  }

  return { user, customer, admin };
}

export async function GET() {
  const { user, customer } = await getAuthenticatedCustomer();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  if (!customer) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  return NextResponse.json({ colors: normalizeBrandColors(customer.brand_colors) });
}

export async function PUT(request: NextRequest) {
  const { user, customer, admin } = await getAuthenticatedCustomer();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  if (!customer || !admin) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  const body = await request.json().catch(() => null) as { colors?: unknown } | null;
  if (!body || !Array.isArray(body.colors)) {
    return NextResponse.json({ error: "colors_must_be_an_array" }, { status: 400 });
  }

  if (body.colors.length > MAX_BRAND_COLORS) {
    return NextResponse.json({ error: `A maximum of ${MAX_BRAND_COLORS} brand colors is allowed.` }, { status: 400 });
  }

  const colors = normalizeBrandColors(body.colors);
  if (colors.length !== body.colors.length) {
    return NextResponse.json({ error: "Use unique 3- or 6-digit hex colors only." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("customers")
    .update({ brand_colors: colors })
    .eq("id", customer.id)
    .select("brand_colors")
    .single();

  if (error) {
    console.error("[customer-brand-colors] update failed", {
      customerId: customer.id,
      code: error.code ?? null,
      message: error.message,
    });
    return NextResponse.json({ error: "Unable to save brand colors right now." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, colors: normalizeBrandColors(data.brand_colors) });
}
