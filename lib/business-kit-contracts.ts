import {
  TRACKED_PRINT_MATERIAL_TYPES,
  type TrackedPrintMaterialType,
  type TrustedPrintProduct,
} from "./print-products.ts";
import { isEnabledEnvironmentFlag } from "./env-flags.js";

export type BusinessKitComponent = {
  componentId: string;
  materialType: TrackedPrintMaterialType;
  codeCount: number;
  trackingPropertyName: string;
  campaignPropertyName: string;
  destinationPropertyName: string;
  existingCodePropertyName: string;
};

export const BUSINESS_KIT_COMPONENT_PROPERTY_CONTRACT = [
  {
    componentId: "business_cards",
    materialType: "business_card",
    codeCount: 1,
    trackingPropertyName: "Business Cards Tracking Mode",
    campaignPropertyName: "Business Cards Campaign Name",
    destinationPropertyName: "Business Cards Destination URL",
    existingCodePropertyName: "Business Cards Existing Clutch Code",
  },
  {
    componentId: "door_hangers",
    materialType: "door_hanger",
    codeCount: 1,
    trackingPropertyName: "Door Hangers Tracking Mode",
    campaignPropertyName: "Door Hangers Campaign Name",
    destinationPropertyName: "Door Hangers Destination URL",
    existingCodePropertyName: "Door Hangers Existing Clutch Code",
  },
  {
    componentId: "flyers",
    materialType: "flyer",
    codeCount: 1,
    trackingPropertyName: "Flyers Tracking Mode",
    campaignPropertyName: "Flyers Campaign Name",
    destinationPropertyName: "Flyers Destination URL",
    existingCodePropertyName: "Flyers Existing Clutch Code",
  },
] as const satisfies readonly BusinessKitComponent[];

export type BusinessKitComponentSelection = BusinessKitComponent & {
  trackingMode: "new_included_code" | "existing_code" | "none";
  campaignName: string | null;
  destinationUrl: string | null;
  existingCodeReference: string | null;
  selectionValid: boolean;
  timedAccessEligible: boolean;
  reason: string | null;
};

export type TrustedBusinessKitContract = {
  productId: string;
  sku: string;
  kitType: "starter" | "growth" | "approved_custom";
  components: BusinessKitComponent[];
};

type RawBusinessKitProperties = Array<{ name?: unknown; key?: unknown; value?: unknown }> | Record<string, unknown> | null | undefined;

const GENERIC_CRITICAL_PROPERTY_NAMES = [
  "Tracking Mode",
  "Clutch Codes Access",
  "Campaign Name",
  "Destination URL",
  "Existing Clutch Code",
] as const;

const GENERIC_CRITICAL_PROPERTY_ALIASES = [
  "tracking mode", "qr tracking", "clutch code option", "tracking",
  "clutch codes access",
  "campaign name", "qr campaign", "campaign",
  "destination url", "qr destination", "destination", "url",
  "existing clutch code", "existing qr code id", "existing clutch code id", "qr code id",
] as const;

function normalizedPropertyName(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_-]+/g, " ") : "";
}

const CRITICAL_NORMALIZED_NAMES = new Set(GENERIC_CRITICAL_PROPERTY_ALIASES.map(normalizedPropertyName));

function exactPropertyEntries(properties: RawBusinessKitProperties) {
  return Array.isArray(properties)
    ? properties.map((property) => ({ name: property?.name ?? property?.key, value: property?.value }))
    : Object.entries(properties || {}).map(([name, value]) => ({ name, value }));
}

function cleanContent(value: string, max: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function strictDestination(value: string) {
  if (!value || value !== value.trim() || /\s/.test(value) || value.startsWith("//")) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateBusinessKitContracts(value: unknown): { contracts: TrustedBusinessKitContract[]; errors: string[] } {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return { contracts: [], errors: ["Business Kit registry must be valid JSON."] }; }
  }
  if (!Array.isArray(parsed)) return { contracts: [], errors: ["Business Kit registry must be an array."] };
  const errors: string[] = [];
  const contracts: TrustedBusinessKitContract[] = [];
  const contractKeys = new Set<string>();
  parsed.forEach((raw, index) => {
    const item = raw as Record<string, any>;
    const label = `Contract ${index + 1}`;
    const productId = typeof item?.productId === "string" ? item.productId : "";
    const sku = typeof item?.sku === "string" ? item.sku : "";
    const kitType = typeof item?.kitType === "string" ? item.kitType : "";
    const components = Array.isArray(item?.components) ? item.components : [];
    if (!/^\d+$/.test(productId)) errors.push(`${label} requires an exact numeric productId.`);
    if (!sku) errors.push(`${label} requires an exact SKU.`);
    if (!["starter", "growth", "approved_custom"].includes(kitType)) errors.push(`${label} has an unsupported kitType.`);
    if (!components.length) errors.push(`${label} requires explicit components.`);
    const contractKey = `${productId}\u0000${sku}`;
    if (contractKeys.has(contractKey)) errors.push(`${label} duplicates an existing productId and SKU pair.`);
    contractKeys.add(contractKey);
    const componentIds = new Set<string>();
    const propertyNames = new Set<string>();
    const normalized = components.map((component: any, componentIndex: number) => {
      const materialType = (typeof component?.materialType === "string" ? component.materialType : "") as TrackedPrintMaterialType;
      const codeCount = component?.codeCount;
      const componentId = typeof component?.componentId === "string" ? component.componentId : "";
      const trackingPropertyName = typeof component?.trackingPropertyName === "string" ? component.trackingPropertyName : "";
      const campaignPropertyName = typeof component?.campaignPropertyName === "string" ? component.campaignPropertyName : "";
      const destinationPropertyName = typeof component?.destinationPropertyName === "string" ? component.destinationPropertyName : "";
      const existingCodePropertyName = typeof component?.existingCodePropertyName === "string" ? component.existingCodePropertyName : "";
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(componentId)) errors.push(`${label} component ${componentIndex + 1} requires a stable lowercase componentId.`);
      const namedProperties = [
        ["trackingPropertyName", trackingPropertyName],
        ["campaignPropertyName", campaignPropertyName],
        ["destinationPropertyName", destinationPropertyName],
        ["existingCodePropertyName", existingCodePropertyName],
      ] as const;
      for (const [role, propertyName] of namedProperties) {
        if (!propertyName || propertyName !== propertyName.trim()) {
          errors.push(`${label} component ${componentIndex + 1} requires an exact ${role}.`);
          continue;
        }
        const normalizedName = normalizedPropertyName(propertyName);
        if (CRITICAL_NORMALIZED_NAMES.has(normalizedName) || GENERIC_CRITICAL_PROPERTY_NAMES.includes(propertyName as typeof GENERIC_CRITICAL_PROPERTY_NAMES[number])) {
          errors.push(`${label} component ${componentIndex + 1} ${role} collides with a generic entitlement-critical property.`);
        }
        if (propertyNames.has(normalizedName)) errors.push(`${label} has a duplicate or normalized-colliding component property name.`);
        propertyNames.add(normalizedName);
      }
      if (!TRACKED_PRINT_MATERIAL_TYPES.includes(materialType)) errors.push(`${label} component ${componentIndex + 1} has unsupported materialType.`);
      if (!Number.isInteger(codeCount) || codeCount < 0 || codeCount > 1) errors.push(`${label} component ${componentIndex + 1} codeCount must be 0 or 1.`);
      if (componentIds.has(componentId)) errors.push(`${label} has a duplicate componentId.`);
      componentIds.add(componentId);
      return { componentId, materialType, codeCount, trackingPropertyName, campaignPropertyName, destinationPropertyName, existingCodePropertyName };
    });
    if (!errors.some((error) => error.startsWith(label))) contracts.push({ productId, sku, kitType: kitType as TrustedBusinessKitContract["kitType"], components: normalized });
  });
  return { contracts: errors.length ? [] : contracts, errors };
}

export function resolveBusinessKitComponentSelections(
  contract: TrustedBusinessKitContract,
  properties: RawBusinessKitProperties
): BusinessKitComponentSelection[] {
  return validateBusinessKitComponentPayload(contract, properties).selections;
}

export function validateBusinessKitComponentPayload(contract: TrustedBusinessKitContract, properties: RawBusinessKitProperties) {
  const entries = exactPropertyEntries(properties);
  const configuredNames = new Set(contract.components.flatMap((component) => [
    component.trackingPropertyName,
    component.campaignPropertyName,
    component.destinationPropertyName,
    component.existingCodePropertyName,
  ]));
  const configuredNormalizedNames = new Map([...configuredNames].map((name) => [normalizedPropertyName(name), name]));
  const genericSpoof = entries.some((entry) => CRITICAL_NORMALIZED_NAMES.has(normalizedPropertyName(entry.name)));
  const componentSpoof = entries.some((entry) => {
    const expected = configuredNormalizedNames.get(normalizedPropertyName(entry.name));
    return Boolean(expected) && entry.name !== expected;
  });
  const globalReason = genericSpoof
    ? "Business Kit payload contains a generic entitlement-critical property."
    : componentSpoof
      ? "Business Kit component properties must use exact contract names."
      : null;

  const selections = contract.components.map((component): BusinessKitComponentSelection => {
    const exact = (name: string) => entries.filter((entry) => entry.name === name);
    const tracking = exact(component.trackingPropertyName);
    const campaign = exact(component.campaignPropertyName);
    const destination = exact(component.destinationPropertyName);
    const existing = exact(component.existingCodePropertyName);
    let reason = globalReason;
    const rawMode = tracking.length === 1 && typeof tracking[0].value === "string" ? tracking[0].value : null;
    const modeValid = rawMode === "new_included_code" || rawMode === "existing_code" || rawMode === "none";
    if (!reason && (tracking.length !== 1 || !modeValid)) reason = "Each Business Kit component requires one exact scalar tracking mode.";
    const trackingMode = modeValid ? rawMode : "none";
    let campaignName: string | null = null;
    let destinationUrl: string | null = null;
    let existingCodeReference: string | null = null;

    if (!reason && trackingMode === "new_included_code") {
      if (campaign.length !== 1 || typeof campaign[0].value !== "string") reason = "A new Business Kit component requires one scalar campaign name.";
      else campaignName = cleanContent(campaign[0].value, 160) || null;
      if (!reason && !campaignName) reason = "A new Business Kit component campaign name cannot be blank.";
      const destinationValue = destination.length === 1 && typeof destination[0].value === "string" ? destination[0].value : null;
      if (!reason && destinationValue === null) reason = "A new Business Kit component requires one scalar destination URL.";
      else if (!reason && destinationValue !== null) destinationUrl = strictDestination(destinationValue);
      if (!reason && !destinationUrl) reason = "A new Business Kit component requires a credential-free HTTP or HTTPS destination URL.";
      if (!reason && existing.length !== 0) reason = "A new Business Kit component cannot include an existing-code reference.";
    }
    if (!reason && trackingMode === "existing_code") {
      if (existing.length !== 1 || typeof existing[0].value !== "string") reason = "An existing-code Business Kit component requires one scalar reference.";
      else existingCodeReference = cleanContent(existing[0].value, 512) || null;
      if (!reason && !existingCodeReference) reason = "An existing-code Business Kit component reference cannot be blank.";
      if (!reason && (campaign.length !== 0 || destination.length !== 0)) reason = "An existing-code Business Kit component cannot include new-code details.";
    }
    if (!reason && trackingMode === "none" && (campaign.length !== 0 || destination.length !== 0 || existing.length !== 0)) {
      reason = "A non-tracked Business Kit component cannot include tracking details.";
    }
    const selectionValid = reason === null;
    return {
      ...component,
      trackingMode,
      campaignName,
      destinationUrl,
      existingCodeReference,
      selectionValid,
      timedAccessEligible: selectionValid && trackingMode === "new_included_code" && component.codeCount === 1,
      reason,
    };
  });
  const valid = selections.every((selection) => selection.selectionValid);
  return {
    valid,
    reason: valid ? null : "invalid_business_kit_component_contract",
    selections,
  };
}

export function readBusinessKitContracts(value = process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON) {
  return validateBusinessKitContracts(value || "[]").contracts;
}

export function identifiesConfiguredBusinessKit(
  productId: unknown,
  sku: unknown,
  value = process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON
) {
  let parsed: unknown = value || [];
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return false; }
  }
  if (!Array.isArray(parsed)) return false;
  const id = typeof productId === "string" || typeof productId === "number" ? String(productId) : "";
  const exactSku = typeof sku === "string" ? sku : "";
  return parsed.some((entry) => entry && typeof entry === "object" && !Array.isArray(entry) &&
    (entry as Record<string, unknown>).productId === id && (entry as Record<string, unknown>).sku === exactSku);
}

export function businessKitOrderLinkedAccessEnabled() {
  return isEnabledEnvironmentFlag(process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS) &&
    isEnabledEnvironmentFlag(process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS);
}

export function matchBusinessKitContract(productId: unknown, sku: unknown, contracts = readBusinessKitContracts()) {
  const id = typeof productId === "string" || typeof productId === "number" ? String(productId) : "";
  const normalizedSku = typeof sku === "string" ? sku : "";
  return contracts.find((contract) => contract.productId === id && contract.sku === normalizedSku) || null;
}

export function validateBusinessKitIdentityContracts(
  identities: TrustedPrintProduct[],
  contracts: TrustedBusinessKitContract[]
) {
  const errors: string[] = [];
  const businessKitIdentities = identities.filter((identity) => identity.sourceType === "business_kit");
  const identityKeys = new Set(businessKitIdentities.map((identity) => `${identity.productId || ""}\u0000${identity.sku || ""}`));
  const contractKeys = new Set(contracts.map((contract) => `${contract.productId}\u0000${contract.sku}`));

  for (const contract of contracts) {
    const key = `${contract.productId}\u0000${contract.sku}`;
    if (!identityKeys.has(key)) {
      errors.push(`Business Kit contract ${contract.productId}/${contract.sku} has no matching business_kit product identity.`);
    }
  }
  for (const identity of businessKitIdentities) {
    const key = `${identity.productId || ""}\u0000${identity.sku || ""}`;
    if (!contractKeys.has(key)) {
      errors.push(`Business Kit identity ${identity.productId || ""}/${identity.sku || ""} has no matching component contract.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
