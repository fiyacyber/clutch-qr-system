import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireCustomer } from "@/lib/auth";
import { getPlatform } from "@/lib/platforms";

function safeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export async function POST(req: NextRequest) {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const action = String(form.get("action") || "").trim();
  const profileId = String(form.get("profile_id") || "").trim();

  if (!profileId) return NextResponse.json({ error: "Profile is required." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  if (action === "create") {
    const label = String(form.get("label") || "").trim();
    let url = String(form.get("url") || "").trim();
    const platform = String(form.get("platform") || "custom").trim();
    const icon = String(form.get("icon") || "link").trim();
    const customColor = String(form.get("custom_color") || "").trim() || null;
    const iconStyle = String(form.get("icon_style") || "emoji").trim();
    const description = String(form.get("description") || "").trim() || null;

    if (!label || !url) {
      return NextResponse.json({ error: "Label and URL are required." }, { status: 400 });
    }

    // If platform is not custom, try to build the full URL
    if (platform !== "custom") {
      const p = getPlatform(platform);
      if (p) {
        try {
          url = p.buildUrl(url);
        } catch (e) {
          // If building fails, use the URL as-is
          url = safeUrl(url);
        }
      } else {
        url = safeUrl(url);
      }
    } else {
      url = safeUrl(url);
    }

    const { data: maxRow } = await admin
      .from("profile_links")
      .select("sort_order")
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sort_order = Number(maxRow?.sort_order || 0) + 1;

    const { error } = await admin.from("profile_links").insert({
      profile_id: profileId,
      label,
      platform: platform !== "custom" ? platform : null,
      url,
      icon,
      custom_color: customColor,
      icon_style: iconStyle,
      description: description,
      sort_order,
      is_active: true,
    });

    if (error) {
      console.error("CONNECT LINK CREATE ERROR", error);
      return NextResponse.json({ error: "Failed to add link." }, { status: 500 });
    }
  }

  if (action === "update") {
    const linkId = String(form.get("link_id") || "").trim();
    const label = String(form.get("label") || "").trim();
    const url = safeUrl(String(form.get("url") || ""));
    const icon = String(form.get("icon") || "link").trim();
    const customColor = String(form.get("custom_color") || "").trim() || null;
    const iconStyle = String(form.get("icon_style") || "emoji").trim();
    const description = String(form.get("description") || "").trim() || null;
    const sort_order = Number(form.get("sort_order") || 0);
    const is_active = String(form.get("is_active") || "false") === "true";

    const { error } = await admin
      .from("profile_links")
      .update({
        label,
        url,
        icon,
        custom_color: customColor,
        icon_style: iconStyle,
        description: description,
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
        is_active,
      })
      .eq("id", linkId)
      .eq("profile_id", profileId);

    if (error) {
      console.error("CONNECT LINK UPDATE ERROR", error);
      return NextResponse.json({ error: "Failed to update link." }, { status: 500 });
    }
  }

  if (action === "delete") {
    const linkId = String(form.get("link_id") || "").trim();

    const { error } = await admin
      .from("profile_links")
      .delete()
      .eq("id", linkId)
      .eq("profile_id", profileId);

    if (error) {
      console.error("CONNECT LINK DELETE ERROR", error);
      return NextResponse.json({ error: "Failed to delete link." }, { status: 500 });
    }
  }

  return NextResponse.redirect(new URL("/portal/connect/links?saved=1", req.url));
}
