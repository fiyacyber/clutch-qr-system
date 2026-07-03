import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createDefaultBuilderConfig, sanitizeBuilderConfig, validateBuilderConfig, createBlock } from "@/lib/builder-config";
import {
  BeginnerConnectLinkDraft,
  buildDefaultProfileSlug,
  getBeginnerConnectLinkSpec,
  isConnectProfilePublished,
  isConnectSetupComplete,
  normalizeBeginnerConnectLinkDraft,
  normalizeBeginnerConnectLinkType,
  normalizeSlug,
  validateConnectSlug,
  RESERVED_CONNECT_SLUGS,
} from "@/lib/connect";
import { buildConnectPublicProfileUrl, getAppBaseUrl } from "@/lib/connect-urls";
import { normalizeUrl } from "@/lib/qr";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type SetupPayload = {
  profile?: Record<string, unknown>;
  advanced?: Record<string, unknown>;
  links?: BeginnerConnectLinkDraft[];
  publish?: boolean;
  completeSetup?: boolean;
  nextRoute?: string | null;
  publishRequested?: boolean;
  validateLinks?: boolean;
};

const MAX_BEGINNER_LINKS = 6;
const isDev = process.env.NODE_ENV !== "production";

function isMissingColumnError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

function isCheckConstraintError(error: any) {
  return String(error?.code || "") === "23514";
}

function withDevDetail(body: Record<string, unknown>, detail?: unknown) {
  if (!isDev || detail == null) return body;
  return {
    ...body,
    detail: typeof detail === "string" ? detail : JSON.stringify(detail),
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimText(value: unknown) {
  return String(value || "").trim();
}

function buildSmartCardDestination(slug?: string | null) {
  if (slug) return buildConnectPublicProfileUrl(String(slug));
  const appBase = getAppBaseUrl();
  return `${appBase}/portal/connect/setup`;
}

function joinName(first: string, last: string) {
  return [first, last].filter(Boolean).join(" ").trim();
}

function safeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return "";
  const normalized = normalizeUrl(trimmed);

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

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

function updateBlockData(
  config: ReturnType<typeof sanitizeBuilderConfig>,
  type: string,
  updater: (data: Record<string, any>) => Record<string, any>,
  sectionId?: string
) {
  const hasBlock = config.blocks.some((block) => block.type === type);
  const blocks = hasBlock
    ? config.blocks.map((block) => {
        if (block.type !== type) return block;
        const nextData = updater({ ...(block.data || {}) });
        return {
          ...block,
          data: nextData,
          settings: nextData,
        };
      })
    : [
        ...config.blocks,
        {
          ...createBlock(type as any, config.blocks.length),
          sectionId,
        },
      ];

  return sanitizeBuilderConfig({
    ...config,
    blocks,
  });
}

function updateBlockVisibility(
  config: ReturnType<typeof sanitizeBuilderConfig>,
  type: string,
  visible: boolean
) {
  const hasBlock = config.blocks.some((block) => block.type === type);
  const blocks = hasBlock
    ? config.blocks.map((block) => (block.type === type ? { ...block, visible } : block))
    : [
        ...config.blocks,
        {
          ...createBlock(type as any, config.blocks.length),
          visible,
          sectionId: "contact",
        },
      ];

  return sanitizeBuilderConfig({
    ...config,
    blocks,
  });
}

function buildProfileSlug(profile: Record<string, any> | null, customer: Record<string, any>, requestedSlug: string) {
  const normalized = validateConnectSlug(requestedSlug, { allowEmpty: true }).slug;
  if (normalized) return normalized;

  const fallbackSource = [profile?.business_name, profile?.contact_name, customer.company_name, customer.email]
    .filter(Boolean)
    .join("-");
  const fallbackSlug = normalizeSlug(fallbackSource);
  if (fallbackSlug && !RESERVED_CONNECT_SLUGS.has(fallbackSlug)) {
    return fallbackSlug;
  }

  return buildDefaultProfileSlug(fallbackSource || String(customer.email || customer.id || "clutch-connect"));
}

function sanitizeBuilderConfigForSetup(rawConfig: unknown, themeColor?: string) {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return createDefaultBuilderConfig(themeColor);
  }

  return keepClearedSections(rawConfig, sanitizeBuilderConfig(rawConfig));
}

function normalizeBannerTheme(value: unknown) {
  const raw = trimText(value).toLowerCase();
  if (raw === "clean-studio" || raw === "clutch-navy" || raw === "executive-dark" || raw === "warm-gradient" || raw === "soft-slate" || raw === "orange-edge") {
    return raw;
  }
  if (raw === "clean-light" || raw === "minimal-gray") return "clean-studio";
  if (raw === "modern-dark") return "executive-dark";
  return "clean-studio";
}

function normalizeGlobalAlignment(value: unknown): "left" | "center" | "right" {
  const raw = trimText(value).toLowerCase();
  if (raw === "left" || raw === "right") return raw;
  return "center";
}

function getBannerThemeSettings(theme: string) {
  if (theme === "clean-studio") {
    return { type: "gradient" as const, theme, backgroundColor: "#edf2f8", gradientFrom: "#fffdf8", gradientTo: "#dbe5f0", overlayEnabled: false, overlayOpacity: 0 };
  }
  if (theme === "clutch-navy") {
    return { type: "gradient" as const, theme, backgroundColor: "#314760", gradientFrom: "#314760", gradientTo: "#101b2a", overlayEnabled: false, overlayOpacity: 0 };
  }
  if (theme === "executive-dark") {
    return { type: "gradient" as const, theme, backgroundColor: "#0f1724", gradientFrom: "#0f1724", gradientTo: "#0a111d", overlayEnabled: true, overlayOpacity: 0.1 };
  }
  if (theme === "warm-gradient") {
    return { type: "gradient" as const, theme, backgroundColor: "#3b4e66", gradientFrom: "#2d4159", gradientTo: "#dd8a4d", overlayEnabled: false, overlayOpacity: 0 };
  }
  if (theme === "soft-slate") {
    return { type: "gradient" as const, theme, backgroundColor: "#dce4ee", gradientFrom: "#eef3f8", gradientTo: "#c1cddc", overlayEnabled: false, overlayOpacity: 0 };
  }
  return { type: "gradient" as const, theme, backgroundColor: "#d88645", gradientFrom: "#f2964f", gradientTo: "#2a3d57", overlayEnabled: false, overlayOpacity: 0 };
}

export async function POST(req: NextRequest) {
  try {
    const { user, customer } = await requireCustomer();
    if (!user || !customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: SetupPayload | null = null;
    try {
      payload = (await req.json()) as SetupPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const profileInput = isRecord(payload?.profile) ? payload?.profile : {};
    const advancedInput = isRecord(payload?.advanced) ? payload?.advanced : {};
    const linkDrafts = Array.isArray(payload?.links) ? payload?.links : [];
    const shouldPublish =
      payload?.publish === true ||
      payload?.completeSetup === true ||
      payload?.nextRoute === "complete" ||
      payload?.publishRequested === true;
    const shouldValidateLinks = payload?.validateLinks === true || shouldPublish;
    const nonEmptyLinkDrafts = linkDrafts.filter((link) => {
      if (!link || typeof link !== "object") return false;
      const legacyLink = link as Record<string, any>;
      return link.visible !== false || trimText(link.label) || trimText(legacyLink.value || legacyLink.url);
    });

    if (nonEmptyLinkDrafts.length > MAX_BEGINNER_LINKS) {
      return NextResponse.json(
        { error: `Beginner setup supports up to ${MAX_BEGINNER_LINKS} links.`, fieldErrors: {} },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: existingProfile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(withDevDetail({ error: "Failed to load the current profile." }, profileError.message), { status: 500 });
    }

    const firstName = trimText(profileInput.firstName) || trimText(customer.first_name);
    const lastName = trimText(profileInput.lastName) || trimText(customer.last_name);
    const combinedName = joinName(firstName, lastName);
    const businessName =
      trimText(profileInput.organization) ||
      trimText(profileInput.businessName) ||
      existingProfile?.business_name ||
      customer.company_name ||
      "";
    const contactName =
      trimText(profileInput.displayName) ||
      trimText(profileInput.contactName) ||
      combinedName ||
      existingProfile?.contact_name ||
      joinName(trimText(customer.first_name), trimText(customer.last_name)) ||
      "";
    const title =
      trimText(profileInput.role) ||
      trimText(profileInput.title) ||
      existingProfile?.title ||
      "";
    const requestedAvatarUrl = trimText(profileInput.avatarUrl);
    const avatarUrl = requestedAvatarUrl
      ? safeHttpUrl(requestedAvatarUrl)
      : safeHttpUrl(existingProfile?.avatar_url || customer.logo_url || "");
    if (requestedAvatarUrl && !avatarUrl) {
      return NextResponse.json(
        { error: "Use a valid http or https image URL.", fieldErrors: { avatarUrl: "Use a valid http or https image URL." } },
        { status: 400 }
      );
    }
    const phone = trimText(profileInput.phone) || existingProfile?.phone || "";
    const email = trimText(profileInput.email) || existingProfile?.email || customer.email || "";
    const requestedWebsite = trimText(profileInput.website) || existingProfile?.website || "";
    const website = safeHttpUrl(requestedWebsite);
    if (trimText(profileInput.website) && !website) {
      return NextResponse.json(
        { error: "Use a valid website URL.", fieldErrors: { website: "Use a valid website URL." } },
        { status: 400 }
      );
    }
    const bio = trimText(profileInput.bio) || existingProfile?.bio || "";
    const bannerTheme = normalizeBannerTheme(profileInput.bannerTheme);
    const requestedBannerImageUrl = trimText(profileInput.bannerImageUrl);
    const bannerImageUrl = requestedBannerImageUrl
      ? safeHttpUrl(requestedBannerImageUrl)
      : safeHttpUrl(existingProfile?.cover_url || "");
    if (requestedBannerImageUrl && !bannerImageUrl) {
      return NextResponse.json(
        { error: "Use a valid banner image URL.", fieldErrors: { bannerImageUrl: "Use a valid banner image URL." } },
        { status: 400 }
      );
    }
    const bannerEnabled = profileInput.bannerEnabled !== false;
    const bannerMode = profileInput.bannerMode === "image" && bannerImageUrl ? "image" : "theme";
    const serviceArea = trimText(profileInput.serviceArea);
    const showPhone = profileInput.showPhone !== false;
    const showEmail = profileInput.showEmail !== false;
    const showWebsite = profileInput.showWebsite !== false;
    const requestedSlug = trimText(profileInput.slug) || existingProfile?.slug || "";
    const resolvedSlug = buildProfileSlug(existingProfile || null, customer, requestedSlug);

    const primaryActionType = trimText(profileInput.primaryActionType) || "request_quote";
    const primaryActionLabel = trimText(profileInput.primaryActionLabel) || "Request a Quote";
    const primaryActionLeadCaptureEnabled = profileInput.primaryActionLeadCaptureEnabled !== false;
    const primaryActionFormType = trimText(profileInput.primaryActionFormType) || "quote_request";
    const requestedPrimaryActionUrl = trimText(profileInput.primaryActionUrl);
    const primaryActionUrl = requestedPrimaryActionUrl ? safeHttpUrl(requestedPrimaryActionUrl) : "";
    if (!primaryActionLeadCaptureEnabled && requestedPrimaryActionUrl && !primaryActionUrl) {
      return NextResponse.json(
        { error: "Use a valid action URL.", fieldErrors: { primaryActionUrl: "Use a valid action URL." } },
        { status: 400 }
      );
    }
    if (!primaryActionLeadCaptureEnabled && !requestedPrimaryActionUrl) {
      return NextResponse.json(
        { error: "Add an action URL when lead capture is turned off.", fieldErrors: { primaryActionUrl: "Add an action URL when lead capture is turned off." } },
        { status: 400 }
      );
    }

    const slugCheck = validateConnectSlug(resolvedSlug, { allowEmpty: false });
    if (!slugCheck.valid) {
      return NextResponse.json({ error: slugCheck.message || "Invalid slug.", fieldErrors: { slug: slugCheck.message } }, { status: 400 });
    }

    const { data: slugOwner, error: slugError } = await admin
      .from("profiles")
      .select("id")
      .eq("slug", slugCheck.slug)
      .maybeSingle();

    if (slugError) {
      return NextResponse.json(withDevDetail({ error: "Failed to validate the profile slug." }, slugError.message), { status: 500 });
    }

    if (slugOwner && slugOwner.id !== existingProfile?.id) {
      return NextResponse.json(
        { error: "That slug is already in use.", fieldErrors: { slug: "That slug is already in use." } },
        { status: 409 }
      );
    }

    const themeColor = "#111111";
    const buttonColor = "#FFFFFF";
    const textColor = "#111111";
    const themeMode = "light";
    const profileStyle = "minimal";
    const profileLayout = "grid";
    const builderLayout = "compact";
    const globalAlignment = normalizeGlobalAlignment(
      advancedInput.globalAlignment ||
      (existingProfile?.builder_config as any)?.theme?.globalAlignment ||
      (existingProfile?.builder_config as any)?.theme?.textAlign ||
      (existingProfile?.builder_config as any)?.theme?.alignment
    );
    const showCardShowcase = advancedInput.showCardShowcase === false ? false : existingProfile?.show_card_showcase ?? false;
    const showLeadForm = primaryActionLeadCaptureEnabled;
    const bannerThemeSettings = getBannerThemeSettings(bannerTheme);

    let nextConfig = sanitizeBuilderConfigForSetup(
      existingProfile?.builder_config || createDefaultBuilderConfig(themeColor),
      themeColor
    );

    nextConfig = {
      ...nextConfig,
      theme: {
        ...nextConfig.theme,
        accentColor: themeColor,
        buttonColor,
        ...(textColor ? { textColor } : {}),
        ...(themeMode ? { themeMode } : {}),
        ...(profileStyle ? { profileStyle } : {}),
        layout: builderLayout,
        globalAlignment,
        textAlign: globalAlignment,
        alignment: globalAlignment,
        buttons: {
          ...nextConfig.theme.buttons,
          color: buttonColor,
          textColor,
        },
        avatar: {
          ...nextConfig.theme.avatar,
          glowEnabled: false,
          glowOpacity: 0,
          verifiedBadgeEnabled: false,
          borderEnabled: false,
        },
        banner: {
          ...nextConfig.theme.banner,
          enabled: bannerEnabled,
          type: bannerMode === "image" ? "image" : bannerThemeSettings.type,
          theme: bannerTheme,
          imageUrl: bannerMode === "image" ? bannerImageUrl : null,
          backgroundColor: bannerThemeSettings.backgroundColor,
          gradientFrom: bannerThemeSettings.gradientFrom,
          gradientTo: bannerThemeSettings.gradientTo,
          starterTheme: bannerTheme,
          sourceMode: bannerMode,
          uploadedImageUrl: bannerImageUrl || null,
          textAlign: "center",
          overlayEnabled: bannerMode === "image" ? true : bannerThemeSettings.overlayEnabled,
          overlayOpacity: bannerMode === "image" ? 0.2 : bannerThemeSettings.overlayOpacity,
          height: 176,
          avatarOverlap: true,
        },
      },
    };

    nextConfig = updateBlockData(nextConfig, "avatar-block", (data) => ({
      ...data,
      avatarUrl,
      avatarGlowEnabled: false,
      avatarGlowOpacity: 0,
      verifiedBadgeEnabled: false,
      avatarBorderEnabled: false,
      alignment: globalAlignment,
    }));
    nextConfig = updateBlockData(nextConfig, "business-name-block", (data) => ({
      ...data,
      text: contactName || businessName,
      alignment: globalAlignment,
    }));
    nextConfig = updateBlockData(nextConfig, "subheader-block", (data) => ({
      ...data,
      text: title,
      alignment: globalAlignment,
    }));
    nextConfig = updateBlockData(nextConfig, "request-quote-button", (data) => ({
      ...data,
      label: primaryActionLabel,
      url: primaryActionLeadCaptureEnabled ? "#lead-form" : primaryActionUrl,
      description: primaryActionLeadCaptureEnabled
        ? "Tell us what you need"
        : "Opens your custom action URL.",
      icon: "bolt",
      isPrimaryAction: true,
      primaryActionType,
      primaryActionLabel,
      primaryActionLeadCaptureEnabled,
      primaryActionFormType,
      primaryActionUrl: primaryActionLeadCaptureEnabled ? "" : primaryActionUrl,
    }), "contact");
    nextConfig = updateBlockData(nextConfig, "form-block", (data) => ({
      ...data,
      formLabel: primaryActionLeadCaptureEnabled ? primaryActionLabel : "Contact Form",
      description: primaryActionLeadCaptureEnabled
        ? "Tell us what you need"
        : "Lead capture is currently disabled.",
      submitText: primaryActionLabel,
      leadCaptureEnabled: primaryActionLeadCaptureEnabled,
      formType: primaryActionFormType,
      source: "clutch_connect_profile",
      guidedLeadCapture: true,
      primaryActionType,
      primaryActionLabel,
    }), "contact");
    nextConfig = updateBlockData(nextConfig, "phone-button", (data) => ({
      ...data,
      phone,
      value: phone,
      label: data.label || "Call",
    }), "contact");
    nextConfig = updateBlockData(nextConfig, "email-button", (data) => ({
      ...data,
      email,
      value: email,
      label: data.label || "Email",
    }), "contact");
    nextConfig = updateBlockData(nextConfig, "website-button", (data) => ({
      ...data,
      website,
      url: website,
      label: data.label || "Website",
    }), "contact");
    nextConfig = updateBlockData(nextConfig, "directions-button", (data) => ({
      ...data,
      label: data.label || "Directions",
      address: serviceArea || data.address || "",
      url: serviceArea
        ? `https://maps.google.com/?q=${encodeURIComponent(serviceArea)}`
        : data.url || "",
    }), "contact");
    nextConfig = updateBlockVisibility(nextConfig, "phone-button", showPhone);
    nextConfig = updateBlockVisibility(nextConfig, "email-button", showEmail);
    nextConfig = updateBlockVisibility(nextConfig, "website-button", showWebsite);
    nextConfig = updateBlockVisibility(nextConfig, "form-block", primaryActionLeadCaptureEnabled);

    const normalizedLinks = linkDrafts
      .map((link, index) => {
        const legacyLink = link as Record<string, any> | undefined;
        const visible = link?.visible !== false;
        const type = normalizeBeginnerConnectLinkType(link?.type);
        const label = trimText(link?.label);
        const value = trimText(legacyLink?.value || legacyLink?.url);
        const fallbackLabel = label || getBeginnerConnectLinkSpec(type).label;
        const draftLink = {
          id: String(link?.id || `setup-link-${index}`),
          type,
          label: fallbackLabel,
          value,
          visible,
        };

        if (!visible && !label && !value) {
          return { link: null, draft: null, error: "" };
        }

        const normalized = normalizeBeginnerConnectLinkDraft(
          draftLink,
          { index }
        );

        if (normalized.error) {
          return { link: null, draft: draftLink, error: normalized.error };
        }

        return { link: normalized.link, draft: draftLink, error: "" };
      });

    const linkFieldErrors = normalizedLinks.reduce<Record<string, string>>((errors, item, index) => {
      if (item.error) {
        errors[`link-${index}`] = item.error;
      }
      return errors;
    }, {});

    if (shouldValidateLinks && Object.keys(linkFieldErrors).length) {
      return NextResponse.json({ error: "Please fix the link fields before saving.", fieldErrors: linkFieldErrors }, { status: 400 });
    }

    const beginnerLinks = normalizedLinks.flatMap((item) => (item.link ? [item.link] : []));
    const configLinks = normalizedLinks.flatMap((item) => {
      if (item.link) return [item.link];
      if (!shouldValidateLinks && item.draft) {
        return [
          {
            ...item.draft,
            href: "",
          },
        ];
      }
      return [];
    });

    nextConfig = updateBlockData(nextConfig, "social-media-links", (data) => ({
      ...data,
      links: configLinks.map((link) => ({
        id: link.id,
        label: link.label,
        platform: link.type,
        value: link.value,
        iconTreatment: "mono",
        visible: link.visible,
      })),
      iconColorMode: "mono",
    }), "more");

    const cleanedConfig = sanitizeBuilderConfigForSetup(nextConfig, themeColor);
    if (!validateBuilderConfig(cleanedConfig)) {
      return NextResponse.json({ error: "Builder configuration is invalid.", fieldErrors: {} }, { status: 400 });
    }

    const nextIsActive = shouldPublish ? true : existingProfile?.is_active === true;
    const completionCandidate = {
      ...existingProfile,
      business_name: businessName,
      contact_name: contactName,
      title,
      phone,
      email,
      website,
      bio,
      avatar_url: avatarUrl || null,
      cover_url: bannerImageUrl || null,
      theme_color: themeColor,
      slug: slugCheck.slug,
      is_active: nextIsActive,
      setup_completed: shouldPublish ? true : existingProfile?.setup_completed,
      builder_config: cleanedConfig,
    };
    const setupReady = isConnectSetupComplete(customer, completionCandidate, {
      links: beginnerLinks.map((link) => ({ is_active: link.visible, url: link.href })),
      requirePublished: false,
    });

    if (shouldPublish && !setupReady) {
      return NextResponse.json(
        { error: "Complete the required setup fields before publishing.", fieldErrors: {} },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const profilePayload: Record<string, unknown> = {
      customer_id: customer.id,
      business_name: businessName,
      contact_name: contactName,
      title,
      phone,
      email,
      website,
      bio,
      avatar_url: avatarUrl || null,
      cover_url: bannerImageUrl || null,
      theme_color: themeColor,
      slug: slugCheck.slug,
      is_active: nextIsActive,
      layout: profileLayout,
      show_card_showcase: showCardShowcase,
      show_lead_form: showLeadForm,
      builder_config: cleanedConfig,
      updated_at: nowIso,
    };

    if (shouldPublish) {
      profilePayload.setup_completed = true;
      profilePayload.setup_completed_at = nowIso;
    }

    let savedProfile = existingProfile;

    if (existingProfile?.id) {
      let { data: updatedProfile, error: updateError } = await admin
        .from("profiles")
        .update(profilePayload)
        .eq("id", existingProfile.id)
        .eq("customer_id", customer.id)
        .select("*")
        .maybeSingle();

      if (updateError && shouldPublish && isMissingColumnError(updateError)) {
        const fallbackPayload = { ...profilePayload };
        delete fallbackPayload.setup_completed;
        delete fallbackPayload.setup_completed_at;
        const retry = await admin
          .from("profiles")
          .update(fallbackPayload)
          .eq("id", existingProfile.id)
          .eq("customer_id", customer.id)
          .select("*")
          .maybeSingle();
        updatedProfile = retry.data;
        updateError = retry.error;
      }

      if (updateError) {
        return NextResponse.json(withDevDetail({ error: "Failed to save your setup draft." }, updateError.message), { status: 500 });
      }

      savedProfile = updatedProfile || existingProfile;
    } else {
      let { data: insertedProfile, error: insertError } = await admin
        .from("profiles")
        .insert({
          ...profilePayload,
          created_at: nowIso,
        })
        .select("*")
        .maybeSingle();

      if (insertError && shouldPublish && isMissingColumnError(insertError)) {
        const fallbackPayload = { ...profilePayload };
        delete fallbackPayload.setup_completed;
        delete fallbackPayload.setup_completed_at;
        const retry = await admin
          .from("profiles")
          .insert({
            ...fallbackPayload,
            created_at: nowIso,
          })
          .select("*")
          .maybeSingle();
        insertedProfile = retry.data;
        insertError = retry.error;
      }

      if (insertError || !insertedProfile) {
        return NextResponse.json(
          withDevDetail({ error: "Failed to create your setup draft." }, insertError?.message || "No profile inserted."),
          { status: 500 }
        );
      }

      savedProfile = insertedProfile;
    }

    savedProfile = {
      ...savedProfile,
      is_active: nextIsActive,
      setup_completed: shouldPublish ? true : savedProfile?.setup_completed,
      builder_config: cleanedConfig,
      slug: slugCheck.slug,
    };

    if (savedProfile?.id) {
      const { error: deleteError } = await admin
        .from("profile_links")
        .delete()
        .eq("profile_id", savedProfile.id);

      if (deleteError) {
        return NextResponse.json(withDevDetail({ error: "Failed to replace profile links." }, deleteError.message), { status: 500 });
      }

      if (beginnerLinks.length) {
        const { error: linkInsertError } = await admin.from("profile_links").insert(
          beginnerLinks.map((link, index) => ({
            profile_id: savedProfile.id,
            label: link.label,
            url: link.href,
            platform: link.type,
            icon: link.type,
            custom_color: null,
            icon_style: "emoji",
            description: null,
            sort_order: index,
            is_active: link.visible,
          }))
        );

        if (linkInsertError) {
          return NextResponse.json(withDevDetail({ error: "Failed to save setup links." }, linkInsertError.message), { status: 500 });
        }
      }

      const setupComplete = isConnectSetupComplete(customer, savedProfile, {
        links: beginnerLinks.map((link) => ({ is_active: link.visible, url: link.href })),
        requirePublished: true,
      });

      if (shouldPublish) {
        const completeStatusAttempt = await admin
          .from("customers")
          .update({
            onboarding_status: "complete",
            updated_at: nowIso,
          })
          .eq("id", customer.id);

        if (completeStatusAttempt.error && isCheckConstraintError(completeStatusAttempt.error)) {
          await admin
            .from("customers")
            .update({
              onboarding_status: "active",
              updated_at: nowIso,
            })
            .eq("id", customer.id);
        }

        await admin
          .from("customers")
          .update({ guided_setup_required: false })
          .eq("id", customer.id)
          .then(({ error }) => {
            if (error && !isMissingColumnError(error)) {
              console.warn("CONNECT SETUP guided_setup_required update skipped", error.message);
            }
          });

        await admin
          .from("customers")
          .update({ setup_step: 999 })
          .eq("id", customer.id)
          .then(({ error }) => {
            if (error && !isMissingColumnError(error)) {
              console.warn("CONNECT SETUP setup_step update skipped", error.message);
            }
          });

        if (!("setup_completed" in profilePayload) || !("setup_completed_at" in profilePayload)) {
          await admin
            .from("profiles")
            .update({ setup_completed: true, setup_completed_at: nowIso })
            .eq("id", savedProfile.id)
            .then(({ error }) => {
              if (error && isMissingColumnError(error)) {
                admin
                  .from("profiles")
                  .update({ setup_completed: true })
                  .eq("id", savedProfile.id)
                  .then(({ error: fallbackError }) => {
                    if (fallbackError && !isMissingColumnError(fallbackError)) {
                      console.warn("CONNECT SETUP profile setup_completed update skipped", fallbackError.message);
                    }
                  });
              } else if (error) {
                console.warn("CONNECT SETUP profile setup_completed update skipped", error.message);
              }
            });
        }

        await admin
          .from("card_orders")
          .update({ setup_completed_at: nowIso })
          .eq("customer_id", customer.id)
          .is("setup_completed_at", null)
          .then(({ error }) => {
            if (error && !isMissingColumnError(error)) {
              console.warn("CONNECT SETUP card_orders setup_completed_at update skipped", error.message);
            }
          });

        await admin
          .from("card_orders")
          .update({ status: "needs_review", updated_at: nowIso })
          .eq("customer_id", customer.id)
          .eq("status", "setup_pending")
          .then(({ error }) => {
            if (error && !isMissingColumnError(error)) {
              console.warn("CONNECT SETUP card_orders status update skipped", error.message);
            }
          });
      }

      if (shouldPublish) {
        const { data: refreshedProfile, error: refreshError } = await admin
          .from("profiles")
          .select("*")
          .eq("id", savedProfile.id)
          .maybeSingle();
        if (!refreshError && refreshedProfile) {
          savedProfile = refreshedProfile;
        }
      }

      const smartCardDestination = buildSmartCardDestination(savedProfile.slug);
      const primarySmartCardPatch = await admin
        .from("qr_codes")
        .update({
          destination_url: smartCardDestination,
          profile_id: savedProfile.id,
          connect_profile_id: savedProfile.id,
        })
        .eq("customer_id", customer.id)
        .eq("is_system", true)
        .eq("qr_type", "smart_card");

      if (primarySmartCardPatch.error && isMissingColumnError(primarySmartCardPatch.error)) {
        await admin
          .from("qr_codes")
          .update({
            destination_url: smartCardDestination,
            profile_id: savedProfile.id,
          })
          .eq("customer_id", customer.id)
          .eq("qr_type", "smart_card")
          .then(({ error }) => {
            if (error && !isMissingColumnError(error)) {
              console.warn("CONNECT SETUP smart card link update skipped", error.message);
            }
          });
      } else if (primarySmartCardPatch.error && !isMissingColumnError(primarySmartCardPatch.error)) {
        console.warn("CONNECT SETUP smart card link update skipped", primarySmartCardPatch.error.message);
      }

      revalidatePath("/portal");
      revalidatePath("/portal/connect");
      revalidatePath("/portal/connect/setup");
      if (savedProfile.slug) {
        revalidatePath(`/u/${savedProfile.slug}`);
      }

      return NextResponse.json({
        ok: true,
        profile: savedProfile,
        config: cleanedConfig,
        links: normalizedLinks,
        setupComplete,
        redirectTo: shouldPublish ? "/portal/connect?setup=complete" : null,
        published: isConnectProfilePublished(savedProfile),
      });
    }

    return NextResponse.json({
      ok: true,
      profile: savedProfile,
      config: cleanedConfig,
      links: normalizedLinks,
      setupComplete: false,
    });
  } catch (error) {
    console.error("CONNECT SETUP SAVE ERROR", error);
    return NextResponse.json(
      withDevDetail(
        { error: "Failed to save setup draft." },
        error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      ),
      { status: 500 }
    );
  }
}