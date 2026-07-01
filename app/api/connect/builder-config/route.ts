import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireCustomer } from "@/lib/auth";
import { createDefaultBuilderConfig, sanitizeBuilderConfig, validateBuilderConfig } from "@/lib/builder-config";

function keepClearedSections(rawConfig: unknown, cleanConfig: ReturnType<typeof sanitizeBuilderConfig>) {
  const rawSections = (rawConfig as { sections?: unknown } | null)?.sections;

  if (!Array.isArray(rawSections) || rawSections.length !== 0) {
    return cleanConfig;
  }

  return {
    ...cleanConfig,
    sections: [],
    blocks: cleanConfig.blocks.map((block) => ({
      ...block,
      sectionId: undefined,
    })),
  };
}

function safeSanitizeConfig(rawConfig: unknown, themeColor?: string) {
  try {
    if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
      return createDefaultBuilderConfig(themeColor);
    }

    return keepClearedSections(rawConfig, sanitizeBuilderConfig(rawConfig));
  } catch {
    return createDefaultBuilderConfig(themeColor);
  }
}

/**
 * GET /api/connect/builder-config
 * Retrieve or initialize the builder configuration for a profile
 */
export async function GET(req: NextRequest) {
  try {
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

    // If profile already has builder_config, return a safely normalized version.
    if (profile.builder_config) {
      const cleanConfig = safeSanitizeConfig(profile.builder_config, profile.theme_color);

      // Self-heal malformed legacy configs to stop repeated failures.
      if (JSON.stringify(cleanConfig) !== JSON.stringify(profile.builder_config)) {
        await admin
          .from("profiles")
          .update({ builder_config: cleanConfig })
          .eq("id", profile.id);
      }

      return NextResponse.json({
        config: cleanConfig,
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
  } catch (error) {
    console.error("BUILDER CONFIG GET ERROR", error);
    return NextResponse.json({ error: "Failed to load builder configuration" }, { status: 500 });
  }
}

/**
 * PUT /api/connect/builder-config
 * Update the builder configuration for a profile
 */
export async function PUT(req: NextRequest) {
  try {
    const { user, customer } = await requireCustomer();

    if (!user || !customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { config } = payload || {};

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

    const cleanConfig = safeSanitizeConfig(config);
    if (!validateBuilderConfig(cleanConfig)) {
      return NextResponse.json({ error: "Builder config is invalid. Please refresh and try again." }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ builder_config: cleanConfig })
      .eq("id", profile.id);

    if (updateError) {
      console.error("BUILDER CONFIG UPDATE ERROR", updateError);
      return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: cleanConfig,
    });
  } catch (error) {
    console.error("BUILDER CONFIG PUT ERROR", error);
    return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 });
  }
}
