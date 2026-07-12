export type ExtensionPlan = {
  sku: string;
  name: string;
  price: string;
  allowance: number;
};

export const EXTENSION_PLANS: Record<string, ExtensionPlan> = {
  "CLUTCH-CODES-STARTER": {
    sku: "CLUTCH-CODES-STARTER",
    name: "Clutch Codes Starter",
    price: "$3.99/month",
    allowance: 10,
  },
  "CLUTCH-CODES-GROWTH": {
    sku: "CLUTCH-CODES-GROWTH",
    name: "Clutch Codes Growth",
    price: "$6.99/month",
    allowance: 30,
  },
  "CLUTCH-CODES-PRO": {
    sku: "CLUTCH-CODES-PRO",
    name: "Clutch Codes Pro",
    price: "$11.99/month",
    allowance: 100,
  },
};

function getSku(line: any) {
  return String(
    line?.merchandise?.sku ||
      line?.merchandise?.productVariant?.sku ||
      line?.sku ||
      line?.variant?.sku ||
      ""
  )
    .trim()
    .toUpperCase();
}

export function detectExtensionPlan(lines: readonly any[] | null | undefined) {
  const matches = (Array.isArray(lines) ? lines : [])
    .map((line) => EXTENSION_PLANS[getSku(line)] || null)
    .filter((plan): plan is ExtensionPlan => Boolean(plan));
  return matches.sort((a, b) => b.allowance - a.allowance)[0] || null;
}

export function verifiedManagementUrl(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
