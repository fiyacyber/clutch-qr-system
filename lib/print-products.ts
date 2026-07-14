export const TRACKED_PRINT_MATERIAL_TYPES = [
  "postcard",
  "flyer",
  "door_hanger",
  "business_card",
  "brochure",
  "rack_card",
  "mailer",
  "yard_sign",
  "banner",
  "other_print",
] as const;

export type TrackedPrintMaterialType = (typeof TRACKED_PRINT_MATERIAL_TYPES)[number];
export type TrustedPrintSourceType = "tracked_print" | "business_kit";

export type TrustedPrintProduct = {
  sku?: string;
  productId?: string;
  materialType: TrackedPrintMaterialType;
  defaultTrackingAvailable: boolean;
  sourceType?: TrustedPrintSourceType;
};

export type PrintProductClassification = {
  eligible: boolean;
  materialType: TrackedPrintMaterialType | null;
  defaultTrackingAvailable: boolean;
  sourceType: TrustedPrintSourceType;
  warnings: string[];
};

export type PrintProductRegistryValidation = {
  entries: TrustedPrintProduct[];
  errors: string[];
};

export function validatePrintProductRegistry(value: unknown): PrintProductRegistryValidation {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { entries: [], errors: ["Registry must be valid JSON."] };
    }
  }
  if (!Array.isArray(parsed)) return { entries: [], errors: ["Registry must be a JSON array."] };

  const entries: TrustedPrintProduct[] = [];
  const errors: string[] = [];
  const seenSkus = new Set<string>();
  const productMaterials = new Map<string, string>();
  const seenIdentities = new Set<string>();

  parsed.forEach((raw, index) => {
    const label = `Entry ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    const candidate = raw as Record<string, unknown>;
    const sku = String(candidate.sku ?? "").trim().toUpperCase();
    const productId = String(candidate.productId ?? "").trim();
    const materialType = String(candidate.materialType ?? "").trim();
    const sourceType = candidate.sourceType == null
      ? "tracked_print"
      : String(candidate.sourceType).trim();

    if (!sku && !productId) errors.push(`${label} requires an exact SKU or productId.`);
    if (productId && !/^\d+$/.test(productId)) errors.push(`${label} productId must be the numeric Shopify product ID.`);
    if (!materialType) errors.push(`${label} materialType cannot be blank.`);
    if (materialType && !TRACKED_PRINT_MATERIAL_TYPES.includes(materialType as TrackedPrintMaterialType)) {
      errors.push(`${label} has unsupported materialType \"${materialType}\".`);
    }
    if (typeof candidate.defaultTrackingAvailable !== "boolean") {
      errors.push(`${label} defaultTrackingAvailable must be explicitly true or false.`);
    }
    if (!(["tracked_print", "business_kit"] as const).includes(sourceType as TrustedPrintSourceType)) {
      errors.push(`${label} has unsupported sourceType "${sourceType}".`);
    }
    if (sourceType === "business_kit" && (!sku || !productId)) {
      errors.push(`${label} business_kit entries require both an exact SKU and productId.`);
    }
    if (sku) {
      if (seenSkus.has(sku)) errors.push(`${label} duplicates SKU ${sku}.`);
      seenSkus.add(sku);
    }
    if (productId && materialType) {
      const previousMaterial = productMaterials.get(productId);
      if (previousMaterial && previousMaterial !== materialType) {
        errors.push(`${label} conflicts with another materialType for productId ${productId}.`);
      }
      productMaterials.set(productId, materialType);
    }
    if (sku && productId) {
      const identity = `${productId}\u0000${sku}`;
      if (seenIdentities.has(identity)) errors.push(`${label} duplicates productId/SKU identity ${productId}/${sku}.`);
      seenIdentities.add(identity);
    }

    if (
      (sku || /^\d+$/.test(productId)) &&
      TRACKED_PRINT_MATERIAL_TYPES.includes(materialType as TrackedPrintMaterialType) &&
      typeof candidate.defaultTrackingAvailable === "boolean" &&
      (["tracked_print", "business_kit"] as const).includes(sourceType as TrustedPrintSourceType)
    ) {
      entries.push({
        ...(sku ? { sku } : {}),
        ...(productId ? { productId } : {}),
        materialType: materialType as TrackedPrintMaterialType,
        defaultTrackingAvailable: candidate.defaultTrackingAvailable,
        sourceType: sourceType as TrustedPrintSourceType,
      });
    }
  });

  return { entries: errors.length ? [] : entries, errors };
}

export function readPrintProductRegistry(value = process.env.TRACKED_PRINT_PRODUCT_REGISTRY_JSON): TrustedPrintProduct[] {
  if (!value) return [];
  return validatePrintProductRegistry(value).entries;
}

export function classifyPrintProduct(
  item: { sku?: unknown; product_id?: unknown; title?: unknown; product_title?: unknown },
  registry: TrustedPrintProduct[] = readPrintProductRegistry()
): PrintProductClassification {
  const sku = String(item.sku ?? "").trim().toUpperCase();
  const productId = String(item.product_id ?? "").trim();
  const skuMatch = sku ? registry.find((entry) => entry.sku === sku) : undefined;
  const productMatches = productId ? registry.filter((entry) => entry.productId === productId) : [];
  if (skuMatch && productMatches.length && !productMatches.includes(skuMatch)) {
    return { eligible: false, materialType: null, defaultTrackingAvailable: false, sourceType: "tracked_print", warnings: ["SKU and product ID resolve to different trusted identities."] };
  }
  if (!skuMatch && productMatches.length > 1) {
    return { eligible: false, materialType: null, defaultTrackingAvailable: false, sourceType: "tracked_print", warnings: ["Product ID matches multiple trusted variant identities; an exact SKU is required."] };
  }
  const match = skuMatch || productMatches[0];
  if (!match) return { eligible: false, materialType: null, defaultTrackingAvailable: false, sourceType: "tracked_print", warnings: [] };
  if (match.sourceType === "business_kit" && (match.sku !== sku || match.productId !== productId)) {
    return { eligible: false, materialType: null, defaultTrackingAvailable: false, sourceType: "business_kit", warnings: ["Business Kit identity requires exact SKU and product ID agreement."] };
  }
  return {
    eligible: true,
    materialType: match.materialType,
    defaultTrackingAvailable: match.defaultTrackingAvailable,
    sourceType: match.sourceType || "tracked_print",
    warnings: [],
  };
}
