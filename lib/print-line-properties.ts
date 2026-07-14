export type TrackingMode = "none" | "new_included_code" | "existing_code";
export type ArtworkMethod = "upload_now" | "upload_later" | "request_design" | "reorder_existing";

export type NormalizedPrintProperties = {
  trackingMode: TrackingMode;
  campaignName: string | null;
  destinationUrl: string | null;
  existingClutchCode: string | null;
  existingQrCodeId: string | null;
  artworkMethod: ArtworkMethod | null;
  artworkFileUrl: string | null;
  artworkInstructions: string | null;
  reorderReference: string | null;
  qrPlacementInstructions: string | null;
  validDestination: boolean;
  normalizedProperties: Record<string, string>;
  clutchCodesAccessOptIn: boolean;
};

function clean(value: unknown, max = 1000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function propertyMap(properties: Array<{ name?: string; key?: string; value?: unknown }> | Record<string, unknown> | null | undefined) {
  const entries = Array.isArray(properties)
    ? properties.map((entry) => [entry.name || entry.key || "", entry.value] as const)
    : Object.entries(properties || {});
  return new Map(entries.map(([key, value]) => [clean(key, 120).toLowerCase().replace(/[\s_-]+/g, " "), clean(value, 4096)]));
}

function first(map: Map<string, string>, aliases: string[], max = 1000) {
  for (const alias of aliases) {
    const value = map.get(alias);
    if (value) return clean(value, max);
  }
  return "";
}

export function normalizePrintLineProperties(properties: Parameters<typeof propertyMap>[0]): NormalizedPrintProperties {
  const map = propertyMap(properties);
  const rawMode = first(map, ["tracking mode", "qr tracking", "clutch code option", "tracking"], 80)
    .toLowerCase().replace(/[\s-]+/g, "_");
  const modeAliases: Record<string, TrackingMode> = {
    none: "none", no_tracking: "none", standard: "none",
    new_included_code: "new_included_code", new_code: "new_included_code", tracked_print: "new_included_code",
    existing_code: "existing_code", use_existing_code: "existing_code", existing_qr: "existing_code",
  };
  const trackingMode = modeAliases[rawMode] || "none";
  const accessValue = first(map, ["clutch codes access"], 80).toLowerCase();
  const clutchCodesAccessOptIn = trackingMode === "new_included_code" && accessValue === "included_90_days";
  const campaignName = first(map, ["campaign name", "qr campaign", "campaign"], 160) || null;
  const destinationRaw = first(map, ["destination url", "qr destination", "destination", "url"], 2048);
  let destinationUrl: string | null = null;
  let validDestination = !destinationRaw;
  if (destinationRaw) {
    try {
      const url = new URL(destinationRaw);
      if (["http:", "https:"].includes(url.protocol) && url.hostname) {
        destinationUrl = url.toString();
        validDestination = true;
      }
    } catch {}
  }

  const existingClutchCode = first(map, [
    "existing clutch code",
    "existing qr code id",
    "existing clutch code id",
    "qr code id",
  ], 512) || null;
  const rawArtworkMethod = first(map, ["artwork method", "artwork option"], 80)
    .toLowerCase().replace(/[\s-]+/g, "_");
  const artworkAliases: Record<string, ArtworkMethod> = {
    upload_now: "upload_now", upload: "upload_now", artwork_upload: "upload_now",
    upload_later: "upload_later", later: "upload_later", provide_later: "upload_later",
    request_design: "request_design", design_assistance: "request_design", professional_design: "request_design",
    reorder_existing: "reorder_existing", reorder: "reorder_existing", previous_artwork: "reorder_existing",
  };
  const artworkMethod = artworkAliases[rawArtworkMethod] || null;
  const artworkFileUrl = first(map, ["artwork upload url", "artwork file url", "artwork url", "artwork upload"], 2048) || null;
  const artworkInstructions = first(map, ["artwork instructions", "art instructions", "artwork notes"], 2000) || null;
  const reorderReference = first(map, ["reorder reference", "prior order number", "previous order"], 200) || null;
  const qrPlacementInstructions = first(map, ["qr placement instructions", "qr placement"], 500) || null;
  const normalizedProperties = Object.fromEntries(Object.entries({
    tracking_mode: trackingMode,
    campaign_name: campaignName,
    destination_url: destinationUrl,
    existing_clutch_code: existingClutchCode,
    artwork_method: artworkMethod,
    artwork_file_url: artworkFileUrl,
    artwork_instructions: artworkInstructions,
    reorder_reference: reorderReference,
    qr_placement_instructions: qrPlacementInstructions,
    clutch_codes_access: clutchCodesAccessOptIn ? "included_90_days" : "none",
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0));

  return {
    trackingMode,
    campaignName,
    destinationUrl,
    existingClutchCode,
    existingQrCodeId: existingClutchCode,
    artworkMethod,
    artworkFileUrl,
    artworkInstructions,
    reorderReference,
    qrPlacementInstructions,
    validDestination,
    normalizedProperties,
    clutchCodesAccessOptIn,
  };
}
