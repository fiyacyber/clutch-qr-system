import Link from "next/link";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { ArrowLeft, Palette } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ConnectTabs from "@/components/connect/ConnectTabs";
import GuidedSetupSubmitButton from "@/components/connect/GuidedSetupSubmitButton";
import { requireCustomer } from "@/lib/auth";
import {
  createBlock,
  createDefaultBuilderConfig,
  sanitizeBuilderConfig,
} from "@/lib/builder-config";
import type { BuilderBlock, BuilderConfig } from "@/lib/builder-types";
import { normalizeUrl } from "@/lib/qr";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function updateBlock(
  config: BuilderConfig,
  type: BuilderBlock["type"],
  update: (data: Record<string, any>) => Record<string, any>
) {
  return {
    ...config,
    blocks: config.blocks.map((block) => {
      if (block.type !== type) return block;
      const data = update({ ...(block.data || {}) });
      return { ...block, data, settings: data };
    }),
  };
}

function ensureBlock(config: BuilderConfig, type: BuilderBlock["type"], sectionId?: string) {
  if (config.blocks.some((block) => block.type === type)) return config;

  const block = {
    ...createBlock(type, config.blocks.length),
    sectionId,
  };

  return sanitizeBuilderConfig({
    ...config,
    blocks: [...config.blocks, block],
  });
}

function addTextBlock(config: BuilderConfig, heading: string, content: string) {
  const existing = config.blocks.find((block) => block.type === "text-section");
  if (existing) {
    return updateBlock(config, "text-section", (data) => ({ ...data, heading, content }));
  }

  const order = config.blocks.length;
  const block = {
    ...createBlock("text-section", order, { heading, content, alignment: "center" }),
    sectionId: "more",
  };

  return sanitizeBuilderConfig({
    ...config,
    blocks: [...config.blocks, block],
  });
}

async function saveGuidedSetup(formData: FormData) {
  "use server";

  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const businessName = String(formData.get("business_name") || "").trim();
  const contactName = String(formData.get("contact_name") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const websiteRaw = String(formData.get("website") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const website = websiteRaw ? normalizeUrl(websiteRaw) : "";

  const admin = createSupabaseAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  const themeColor = existingProfile?.theme_color || "#FFA665";
  const baseConfig = sanitizeBuilderConfig(
    existingProfile?.builder_config || createDefaultBuilderConfig(themeColor)
  );

  let nextConfig = ensureBlock(baseConfig, "avatar-block");
  nextConfig = ensureBlock(nextConfig, "business-name-block");
  nextConfig = ensureBlock(nextConfig, "subheader-block");
  nextConfig = ensureBlock(nextConfig, "phone-button", "contact");
  nextConfig = ensureBlock(nextConfig, "email-button", "contact");
  nextConfig = ensureBlock(nextConfig, "website-button", "contact");

  nextConfig = updateBlock(nextConfig, "business-name-block", (data) => ({
    ...data,
    text: businessName || data.text || customer.company_name || "",
  }));
  nextConfig = updateBlock(nextConfig, "subheader-block", (data) => ({
    ...data,
    text: title || contactName || data.text || "",
  }));
  nextConfig = updateBlock(nextConfig, "phone-button", (data) => ({
    ...data,
    phone,
    value: phone,
    label: data.label || "Call",
  }));
  nextConfig = updateBlock(nextConfig, "email-button", (data) => ({
    ...data,
    email,
    value: email,
    label: data.label || "Email",
  }));
  nextConfig = updateBlock(nextConfig, "website-button", (data) => ({
    ...data,
    website,
    url: website,
    label: data.label || "Website",
  }));

  if (bio) {
    nextConfig = addTextBlock(nextConfig, "About", bio);
  }

  const slugBase = businessName || contactName || customer.company_name || customer.email || "connect-profile";
  const slug = existingProfile?.slug || `${slugify(slugBase) || "connect-profile"}-${nanoid(5).toLowerCase()}`;
  const profilePayload = {
    customer_id: customer.id,
    business_name: businessName || customer.company_name || existingProfile?.business_name || "",
    contact_name: contactName || existingProfile?.contact_name || "",
    title: title || existingProfile?.title || "",
    phone: phone || existingProfile?.phone || "",
    email: email || existingProfile?.email || customer.email || "",
    website: website || existingProfile?.website || "",
    bio: bio || existingProfile?.bio || "",
    slug,
    theme_color: themeColor,
    is_active: existingProfile?.is_active ?? true,
    builder_config: sanitizeBuilderConfig(nextConfig),
    updated_at: new Date().toISOString(),
  };

  if (existingProfile?.id) {
    const { error } = await admin
      .from("profiles")
      .update(profilePayload)
      .eq("id", existingProfile.id)
      .eq("customer_id", customer.id);

    if (error) {
      console.error("CONNECT GUIDED SETUP UPDATE ERROR", {
        message: error.message,
        customerId: customer.id,
        profileId: existingProfile.id,
      });
      redirect("/portal/connect/setup?error=save");
    }
  } else {
    const { error } = await admin.from("profiles").insert({
      ...profilePayload,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("CONNECT GUIDED SETUP INSERT ERROR", {
        message: error.message,
        customerId: customer.id,
      });
      redirect("/portal/connect/setup?error=save");
    }
  }

  redirect("/portal/connect/build?saved=1");
}

export default async function ConnectGuidedSetupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const params = (await searchParams) || {};
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <main className="container connect-center-shell">
        <DashboardHeader
          title="Guided Setup"
          subtitle="Add the essentials for your Clutch Connect profile, then refine the layout in the advanced builder."
          actions={(
            <div className="connect-center-header-actions">
              <Link className="btn secondary" href="/portal/connect">
                <ArrowLeft size={15} />
                Back
              </Link>
              <Link className="btn primary" href="/portal/connect/build">
                <Palette size={15} />
                Advanced Builder
              </Link>
            </div>
          )}
        />

        <ConnectTabs active="profile" />

        <section className="connect-center-card">
          <p className="connect-center-kicker">Profile Essentials</p>
          <h2>Start with the fields customers need first</h2>
          {params.error === "save" ? (
            <div className="error-message">We could not save setup changes. Please try again.</div>
          ) : null}
          <form className="form" action={saveGuidedSetup}>
            <input className="input" name="business_name" placeholder="Business name" defaultValue={profile?.business_name || customer.company_name || ""} />
            <input className="input" name="contact_name" placeholder="Contact name" defaultValue={profile?.contact_name || ""} />
            <input className="input" name="title" placeholder="Title or headline" defaultValue={profile?.title || ""} />
            <input className="input" name="phone" placeholder="Phone" defaultValue={profile?.phone || ""} />
            <input className="input" name="email" type="email" placeholder="Email" defaultValue={profile?.email || customer.email || ""} />
            <input className="input" name="website" placeholder="Website" defaultValue={profile?.website || ""} />
            <textarea className="input" name="bio" placeholder="Short bio or customer-facing note" defaultValue={profile?.bio || ""} rows={4} />
            <div className="connect-center-inline-actions">
              <GuidedSetupSubmitButton />
              <Link className="btn ghost" href="/portal/connect/build">Skip to Advanced Builder</Link>
            </div>
          </form>
        </section>
      </main>
    </DashboardShell>
  );
}
