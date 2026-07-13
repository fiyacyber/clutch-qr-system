export type BusinessKitItem = {
  id: string;
  shopify_order_id: string;
  shopify_order_number?: string | null;
  product_title?: string | null;
  variant_title?: string | null;
  material_type?: string | null;
  quantity?: number | null;
  tracking_mode?: string | null;
  campaign_name?: string | null;
  artwork_status?: string | null;
  proof_status?: string | null;
  production_status?: string | null;
  fulfillment_status?: string | null;
  provisioning_status?: string | null;
  attention_reason?: string | null;
  created_at?: string | null;
  normalized_properties?: Record<string, unknown> | null;
  source_type?: string | null;
  qr_code_id?: string | null;
};

export type BusinessKitGroup = {
  key: string;
  name: string;
  orderId: string;
  orderNumber: string;
  createdAt: string | null;
  items: BusinessKitItem[];
  itemCount: number;
  readyCount: number;
  proofActionCount: number;
  attentionCount: number;
  trackedCount: number;
  progressPercent: number;
};

const KIT_ID_KEYS = ["business_kit_id", "kit_id", "bundle_id", "kit_reference"];
const KIT_NAME_KEYS = ["business_kit_name", "kit_name", "bundle_name", "kit"];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function propertyValue(properties: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!properties) return "";
  for (const key of keys) {
    const direct = clean(properties[key]);
    if (direct) return direct;
    const titleCase = clean(properties[key.replace(/(^|_)([a-z])/g, (_match, _prefix, letter) => letter.toUpperCase())]);
    if (titleCase) return titleCase;
  }
  return "";
}

function titleLooksLikeKit(value: string | null | undefined): boolean {
  const title = clean(value).toLowerCase();
  return /\b(business|starter|growth|agency)\s+kit\b/.test(title) || /\bkit\s+bundle\b/.test(title);
}

export function isBusinessKitItem(item: BusinessKitItem): boolean {
  if (clean(item.source_type).toLowerCase() === "business_kit") return true;
  if (propertyValue(item.normalized_properties, KIT_ID_KEYS)) return true;
  if (propertyValue(item.normalized_properties, KIT_NAME_KEYS)) return true;
  return titleLooksLikeKit(item.product_title) || titleLooksLikeKit(item.variant_title);
}

function itemSetupReady(item: BusinessKitItem): boolean {
  const artworkReady = !["", "not_received", "changes_requested"].includes(clean(item.artwork_status).toLowerCase());
  const trackingReady = ["completed", "not_required"].includes(clean(item.provisioning_status).toLowerCase());
  return artworkReady && trackingReady;
}

function kitName(item: BusinessKitItem): string {
  const explicit = propertyValue(item.normalized_properties, KIT_NAME_KEYS);
  if (explicit) return explicit;
  if (titleLooksLikeKit(item.product_title)) return clean(item.product_title);
  if (titleLooksLikeKit(item.variant_title)) return clean(item.variant_title);
  return "Business Kit";
}

function kitKey(item: BusinessKitItem): string {
  const explicit = propertyValue(item.normalized_properties, KIT_ID_KEYS);
  if (explicit) return explicit;
  return clean(item.shopify_order_id) || item.id;
}

export function groupBusinessKitItems(items: BusinessKitItem[]): BusinessKitGroup[] {
  const groups = new Map<string, BusinessKitItem[]>();

  for (const item of items.filter(isBusinessKitItem)) {
    const key = kitKey(item);
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([key, groupItems]) => {
      const sorted = [...groupItems].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });
      const first = sorted[0];
      const readyCount = sorted.filter(itemSetupReady).length;
      const proofActionCount = sorted.filter((item) => clean(item.proof_status).toLowerCase() === "sent").length;
      const attentionCount = sorted.filter((item) => clean(item.provisioning_status).toLowerCase() === "needs_attention" || Boolean(clean(item.attention_reason))).length;
      const trackedCount = sorted.filter((item) => clean(item.tracking_mode).toLowerCase() !== "none").length;
      const progressPercent = sorted.length ? Math.round((readyCount / sorted.length) * 100) : 0;

      return {
        key,
        name: kitName(first),
        orderId: first.shopify_order_id,
        orderNumber: clean(first.shopify_order_number) || clean(first.shopify_order_id),
        createdAt: first.created_at || null,
        items: sorted,
        itemCount: sorted.length,
        readyCount,
        proofActionCount,
        attentionCount,
        trackedCount,
        progressPercent,
      } satisfies BusinessKitGroup;
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
}

export function customerFacingCodeSource(item: {
  source_type?: string | null;
  capacity_source?: string | null;
  print_order_item_id?: string | null;
  qr_type?: string | null;
}): string {
  if (clean(item.source_type).toLowerCase() === "business_kit" || clean(item.qr_type).toLowerCase() === "business_kit") {
    return "Business Kit";
  }
  if (item.print_order_item_id || clean(item.capacity_source).toLowerCase() === "included_print") {
    return "Print order";
  }
  return "Clutch Codes subscription";
}
