export type TrustedPrintProduct = {
  sku?: string;
  productId?: string;
  materialType: string;
  defaultTrackingAvailable?: boolean;
};

export type PrintProductClassification = {
  eligible: boolean;
  materialType: string | null;
  defaultTrackingAvailable: boolean;
  warnings: string[];
};

export function readPrintProductRegistry(value = process.env.TRACKED_PRINT_PRODUCT_REGISTRY_JSON): TrustedPrintProduct[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.materialType === "string").map((entry) => ({
      sku: entry.sku ? String(entry.sku).trim().toUpperCase() : undefined,
      productId: entry.productId ? String(entry.productId).trim() : undefined,
      materialType: String(entry.materialType).trim(),
      defaultTrackingAvailable: entry.defaultTrackingAvailable !== false,
    }));
  } catch {
    return [];
  }
}

export function classifyPrintProduct(
  item: { sku?: unknown; product_id?: unknown; title?: unknown; product_title?: unknown },
  registry: TrustedPrintProduct[] = readPrintProductRegistry()
): PrintProductClassification {
  const sku = String(item.sku ?? "").trim().toUpperCase();
  const productId = String(item.product_id ?? "").trim();
  const match = registry.find((entry) =>
    (entry.sku && entry.sku.toUpperCase() === sku) || (entry.productId && entry.productId === productId)
  );
  if (!match) return { eligible: false, materialType: null, defaultTrackingAvailable: false, warnings: [] };
  return {
    eligible: true,
    materialType: match.materialType,
    defaultTrackingAvailable: match.defaultTrackingAvailable !== false,
    warnings: [],
  };
}
