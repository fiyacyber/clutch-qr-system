type BuilderConfigLike = {
  blocks?: Array<{
    type?: string;
    data?: Record<string, any>;
    settings?: Record<string, any>;
  }>;
};

export function normalizeServiceArea(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildDirectionsBlockState(serviceArea: unknown): {
  address: string;
  url: string;
  visible: boolean;
} {
  const address = normalizeServiceArea(serviceArea);
  return {
    address,
    url: address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : "",
    visible: Boolean(address),
  };
}

export function hasOwnServiceArea(rawContact: Record<string, any>): boolean {
  return Object.prototype.hasOwnProperty.call(rawContact, "serviceArea");
}

export function recoverServiceArea(
  rawContact: Record<string, any>,
  fallbackServiceArea: string
): string {
  return hasOwnServiceArea(rawContact)
    ? normalizeServiceArea(rawContact.serviceArea)
    : fallbackServiceArea;
}

export function getDirectionsDataFromBlock(block: {
  data?: Record<string, any>;
  settings?: Record<string, any>;
} | null | undefined): Record<string, any> {
  if (block?.data && typeof block.data === "object") return block.data;
  if (block?.settings && typeof block.settings === "object") return block.settings;
  return {};
}

export function getInitialServiceAreaFromBuilderConfig(config: BuilderConfigLike | null | undefined): string {
  const directionsBlock = (config?.blocks || []).find((block) => block?.type === "directions-button");
  const directionsData = getDirectionsDataFromBlock(directionsBlock);
  return normalizeServiceArea(directionsData.address);
}

export function hasRenderableDirectionsAddress(data: Record<string, any>): boolean {
  return Boolean(normalizeServiceArea(data.address));
}
