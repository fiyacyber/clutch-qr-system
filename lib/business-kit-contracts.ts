import { TRACKED_PRINT_MATERIAL_TYPES, type TrackedPrintMaterialType } from "./print-products.ts";
import { isEnabledEnvironmentFlag } from "./env-flags.js";

export type BusinessKitComponent = {
  componentId: string;
  materialType: TrackedPrintMaterialType;
  codeCount: number;
  trackingPropertyName: string;
};

export type TrustedBusinessKitContract = {
  productId: string;
  sku: string;
  kitType: "starter" | "growth" | "approved_custom";
  components: BusinessKitComponent[];
};

export function validateBusinessKitContracts(value: unknown): { contracts: TrustedBusinessKitContract[]; errors: string[] } {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return { contracts: [], errors: ["Business Kit registry must be valid JSON."] }; }
  }
  if (!Array.isArray(parsed)) return { contracts: [], errors: ["Business Kit registry must be an array."] };
  const errors: string[] = [];
  const contracts: TrustedBusinessKitContract[] = [];
  parsed.forEach((raw, index) => {
    const item = raw as Record<string, any>;
    const label = `Contract ${index + 1}`;
    const productId = String(item?.productId || "").trim();
    const sku = String(item?.sku || "").trim().toUpperCase();
    const kitType = String(item?.kitType || "");
    const components = Array.isArray(item?.components) ? item.components : [];
    if (!/^\d+$/.test(productId)) errors.push(`${label} requires an exact numeric productId.`);
    if (!sku) errors.push(`${label} requires an exact SKU.`);
    if (!["starter", "growth", "approved_custom"].includes(kitType)) errors.push(`${label} has an unsupported kitType.`);
    if (!components.length) errors.push(`${label} requires explicit components.`);
    const normalized = components.map((component: any, componentIndex: number) => {
      const materialType = String(component?.materialType || "") as TrackedPrintMaterialType;
      const codeCount = Number(component?.codeCount);
      const componentId = String(component?.componentId || "").trim();
      const trackingPropertyName = String(component?.trackingPropertyName || "").trim();
      if (!componentId) errors.push(`${label} component ${componentIndex + 1} requires componentId.`);
      if (!trackingPropertyName) errors.push(`${label} component ${componentIndex + 1} requires an exact trackingPropertyName.`);
      if (!TRACKED_PRINT_MATERIAL_TYPES.includes(materialType)) errors.push(`${label} component ${componentIndex + 1} has unsupported materialType.`);
      if (!Number.isInteger(codeCount) || codeCount < 0 || codeCount > 1) errors.push(`${label} component ${componentIndex + 1} codeCount must be 0 or 1.`);
      return { componentId, materialType, codeCount, trackingPropertyName };
    });
    if (!errors.some((error) => error.startsWith(label))) contracts.push({ productId, sku, kitType: kitType as TrustedBusinessKitContract["kitType"], components: normalized });
  });
  return { contracts: errors.length ? [] : contracts, errors };
}

function normalizedProperties(properties: Array<{ name?: string; key?: string; value?: unknown }> | Record<string, unknown> | null | undefined) {
  const entries = Array.isArray(properties)
    ? properties.map((property) => [String(property.name || property.key || "").trim(), String(property.value || "").trim()] as const)
    : Object.entries(properties || {}).map(([key, value]) => [key.trim(), String(value || "").trim()] as const);
  return new Map(entries);
}

export function resolveBusinessKitComponentSelections(
  contract: TrustedBusinessKitContract,
  properties: Parameters<typeof normalizedProperties>[0]
) {
  const values = normalizedProperties(properties);
  return contract.components.map((component) => {
    const raw = String(values.get(component.trackingPropertyName) || "").trim().toLowerCase();
    const trackingMode = raw === "new_included_code" ? "new_included_code" : raw === "existing_code" ? "existing_code" : "none";
    return {
      ...component,
      trackingMode,
      timedAccessEligible: trackingMode === "new_included_code" && component.codeCount === 1,
    };
  });
}

export function readBusinessKitContracts(value = process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON) {
  if (!isEnabledEnvironmentFlag(process.env.ENABLE_BUSINESS_KIT_ORDER_LINKED_ACCESS)) return [];
  return validateBusinessKitContracts(value || "[]").contracts;
}

export function matchBusinessKitContract(productId: unknown, sku: unknown, contracts = readBusinessKitContracts()) {
  const id = String(productId || "").trim();
  const normalizedSku = String(sku || "").trim().toUpperCase();
  return contracts.find((contract) => contract.productId === id && contract.sku === normalizedSku) || null;
}
