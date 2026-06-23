import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireCustomer } from "@/lib/auth";
import { createDefaultBuilderConfig } from "@/lib/builder-config";

/**
 * GET /api/connect/builder-config
 * Retrieve or initialize the builder configuration for a profile
 */
export async function GET(req: NextRequest) {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // If profile already has builder_config, return it
  if (profile.builder_config) {
    return NextResponse.json({
      config: profile.builder_config,
      profile,
    });
  }

  // Otherwise, create a default configuration
  const defaultConfig = createDefaultBuilderConfig(profile.theme_color);

  // Optionally save it to the database for future use
  // (comment out if you prefer lazy initialization)
  await admin
    .from("profiles")
    .update({ builder_config: defaultConfig })
    .eq("id", profile.id);

  return NextResponse.json({
    config: defaultConfig,
    profile,
    isDefault: true,
  });
}

/**
 * PUT /api/connect/builder-config
 * Update the builder configuration for a profile
 */
export async function PUT(req: NextRequest) {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { config } = await req.json();

  if (!config) {
    return NextResponse.json({ error: "Config is required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ builder_config: config })
    .eq("id", profile.id);

  if (updateError) {
    console.error("BUILDER CONFIG UPDATE ERROR", updateError);
    return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    config,
  });
}
