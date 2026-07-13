export type TrackingMode = "none" | "new_included_code" | "existing_code";
export type NormalizedPrintProperties = {
  trackingMode: TrackingMode;
  campaignName: string | null;
  destinationUrl: string | null;
  existingQrCodeId: string | null;
  artworkMethod: string | null;
  artworkFileUrl: string | null;
  artworkInstructions: string | null;
  qrPlacementInstructions: string | null;
  validDestination: boolean;
  normalizedProperties: Record<string, string>;
};

function clean(value: unknown, max = 1000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function propertyMap(properties: Array<{ name?: string; key?: string; value?: unknown }> | Record<string, unknown> | null | undefined) {
  const entries = Array.isArray(properties)
    ? properties.map((entry) => [entry.name || entry.key || "", entry.value] as const)
    : Object.entries(properties || {});
  return new Map(entries.map(([key, value]) => [clean(key, 120).toLowerCase().replace(/[\s_-]+/g, " "), clean(value)]));
}

function first(map: Map<string, string>, aliases: string[]) {
  for (const alias of aliases) { const value = map.get(alias); if (value) return value; }
  return "";
}

export function normalizePrintLineProperties(properties: Parameters<typeof propertyMap>[0]): NormalizedPrintProperties {
  const map = propertyMap(properties);
  const rawMode = first(map, ["tracking mode", "qr tracking", "clutch code option", "tracking"])
    .toLowerCase().replace(/[\s-]+/g, "_");
  const modeAliases: Record<string, TrackingMode> = {
    none: "none", no_tracking: "none", standard: "none",
    new_included_code: "new_included_code", new_code: "new_included_code", tracked_print: "new_included_code",
    existing_code: "existing_code", use_existing_code: "existing_code", existing_qr: "existing_code",
  };
  const trackingMode = modeAliases[rawMode] || "none";
  const campaignName = first(map, ["campaign name", "qr campaign", "campaign"]) || null;
  const destinationRaw = first(map, ["destination url", "qr destination", "destination", "url"]);
  let destinationUrl: string | null = null;
  let validDestination = !destinationRaw;
  if (destinationRaw) {
    try { const url = new URL(destinationRaw); if (["http:", "https:"].includes(url.protocol)) { destinationUrl = url.toString(); validDestination = true; } } catch {}
  }
  const existingQrCodeId = first(map, ["existing qr code id", "existing clutch code id", "qr code id"]) || null;
  const artworkMethod = first(map, ["artwork method", "artwork option"]) || null;
  const artworkFileUrl = first(map, ["artwork upload url", "artwork file url", "artwork url"]) || null;
  const artworkInstructions = first(map, ["artwork instructions", "art instructions"]) || null;
  const qrPlacementInstructions = first(map, ["qr placement instructions", "qr placement"]) || null;
  const normalizedProperties = Object.fromEntries(Object.entries({
    tracking_mode: trackingMode, campaign_name: campaignName, destination_url: destinationUrl,
    existing_qr_code_id: existingQrCodeId, artwork_method: artworkMethod,
    artwork_file_url: artworkFileUrl, artwork_instructions: artworkInstructions,
    qr_placement_instructions: qrPlacementInstructions,
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return { trackingMode, campaignName, destinationUrl, existingQrCodeId, artworkMethod, artworkFileUrl, artworkInstructions, qrPlacementInstructions, validDestination, normalizedProperties };
}
