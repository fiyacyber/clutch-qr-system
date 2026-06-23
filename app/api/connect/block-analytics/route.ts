import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { extractIpHash } from "@/lib/connect";
import { headers } from "next/headers";

/**
 * POST /api/connect/block-analytics
 * Track block interactions (button clicks, form submissions, etc.)
 */
export async function POST(req: NextRequest) {
  const { profileId, blockId, eventType, metadata } = await req.json();

  if (!profileId || !blockId || !eventType) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const requestHeaders = await headers();
  const ipHash = extractIpHash(requestHeaders);

  try {
    const { error } = await admin
      .from("profile_click_events")
      .insert({
        profile_id: profileId,
        event_type: `block_${eventType}`, // e.g., block_phone, block_email, block_custom_link
        ip_hash: ipHash,
        user_agent: null,
        metadata: {
          blockId,
          ...metadata,
        },
      });

    if (error) {
      console.error("BLOCK ANALYTICS ERROR", error);
      return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BLOCK ANALYTICS ERROR", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * GET /api/connect/block-analytics
 * Get analytics for a profile's blocks
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Get all block events for this profile
  const { data: events, error } = await admin
    .from("profile_click_events")
    .select("*")
    .eq("profile_id", profileId)
    .like("event_type", "block_%")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("BLOCK ANALYTICS FETCH ERROR", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }

  // Group by block and event type
  const analytics: Record<string, any> = {};
  for (const event of events || []) {
    const blockId = event.metadata?.blockId;
    if (!blockId) continue;

    if (!analytics[blockId]) {
      analytics[blockId] = {
        blockId,
        totalClicks: 0,
        byEventType: {},
      };
    }

    analytics[blockId].totalClicks++;
    const eventType = event.event_type.replace("block_", "");
    analytics[blockId].byEventType[eventType] = (analytics[blockId].byEventType[eventType] || 0) + 1;
  }

  return NextResponse.json({
    analytics: Object.values(analytics),
    totalEvents: events?.length || 0,
  });
}
