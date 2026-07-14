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
      if (!componentId) errors.push(`${label} component ${componentIndex + 1} requires componentId.`);
      if (!trackingPropertyName) errors.push(`${label} component ${componentIndex + 1} requires an exact trackingPropertyName.`);
      if (!TRACKED_PRINT_MATERIAL_TYPES.includes(materialType)) errors.push(`${label} component ${componentIndex + 1} has unsupported materialType.`);
      if (!Number.isInteger(codeCount) || codeCount < 0 || codeCount > 1) errors.push(`${label} component ${componentIndex + 1} codeCount must be 0 or 1.`);
      if (componentIds.has(componentId)) errors.push(`${label} has a duplicate componentId.`);
      if (propertyNames.has(trackingPropertyName)) errors.push(`${label} has a duplicate trackingPropertyName.`);
      componentIds.add(componentId);
      propertyNames.add(trackingPropertyName);
      return { componentId, materialType, codeCount, trackingPropertyName };
    });
    if (!errors.some((error) => error.startsWith(label))) contracts.push({ productId, sku, kitType: kitType as TrustedBusinessKitContract["kitType"], components: normalized });
  });
  return { contracts: errors.length ? [] : contracts, errors };
}

export function resolveBusinessKitComponentSelections(
  contract: TrustedBusinessKitContract,
  properties: Array<{ name?: unknown; key?: unknown; value?: unknown }> | Record<string, unknown> | null | undefined
) {
  const entries = Array.isArray(properties)
    ? properties.map((property) => ({ name: property?.name ?? property?.key, value: property?.value }))
    : Object.entries(properties || {}).map(([name, value]) => ({ name, value }));
  return contract.components.map((component) => {
    const matches = entries.filter((entry) => entry.name === component.trackingPropertyName);
    const raw = matches.length === 1 && typeof matches[0].value === "string" ? matches[0].value : null;
    const valid = raw === "new_included_code" || raw === "existing_code" || raw === "none";
    const trackingMode: "new_included_code" | "existing_code" | "none" = valid
      ? raw as "new_included_code" | "existing_code" | "none"
      : "none";
    return {
      ...component,
      trackingMode,
      selectionValid: valid,
      timedAccessEligible: valid && trackingMode === "new_included_code" && component.codeCount === 1,
    };
  });
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
