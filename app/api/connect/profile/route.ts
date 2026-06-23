import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { requireCustomer } from "@/lib/auth";
import { buildDefaultProfileSlug, normalizeSlug, asPublicWebsite } from "@/lib/connect";

export async function POST(req: NextRequest) {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();

  const profileId = String(form.get("profile_id") || "").trim();
  const business_name = String(form.get("business_name") || "").trim();
  const contact_name = String(form.get("contact_name") || "").trim();
  const title = String(form.get("title") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const email = String(form.get("email") || "").trim();
  const website = asPublicWebsite(String(form.get("website") || ""));
  const bio = String(form.get("bio") || "").trim();
  const avatar_url = String(form.get("avatar_url") || "").trim() || null;
  const cover_url = String(form.get("cover_url") || "").trim() || null;
  const theme_color = String(form.get("theme_color") || "#FFA665").trim();
  const slugInput = String(form.get("slug") || "").trim();
  const is_active = String(form.get("is_active") || "true") !== "false";
  const layout = String(form.get("layout") || "grid") as "grid" | "stack" | "buttons";
  const show_card_showcase = false;
  const show_lead_form = String(form.get("show_lead_form") || "true") !== "false";

  const rawSlugSource = slugInput || business_name || contact_name || customer.company_name || customer.email;
  const slug = normalizeSlug(rawSlugSource) || buildDefaultProfileSlug(rawSlugSource);

  if (!slug) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: duplicateSlug } = await admin
    .from("profiles")
    .select("id")
    .eq("slug", slug)
    .neq("customer_id", customer.id)
    .maybeSingle();

  if (duplicateSlug) {
    return NextResponse.json({ error: "This profile slug is already in use." }, { status: 409 });
  }

  const payload = {
    customer_id: customer.id,
    business_name,
    contact_name,
    title,
    phone,
    email,
    website,
    bio,
    avatar_url,
    cover_url,
    theme_color: theme_color || "#FFA665",
    slug,
    is_active,
    layout,
    show_card_showcase,
    show_lead_form,
  };

  if (profileId) {
    const { error } = await admin
      .from("profiles")
      .update(payload)
      .eq("id", profileId)
      .eq("customer_id", customer.id);

    if (error) {
      console.error("CONNECT PROFILE UPDATE ERROR", error);
      return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
    }
  } else {
    const { error } = await admin.from("profiles").insert(payload);

    if (error) {
      console.error("CONNECT PROFILE CREATE ERROR", error);
      return NextResponse.json({ error: "Failed to create profile." }, { status: 500 });
    }
  }

  return NextResponse.redirect(new URL("/portal/connect?saved=1", req.url));
}
