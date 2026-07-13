const PROTECTED_COMMERCE_FIELDS = new Set([
  "included_qr_allowance",
  "subscription_qr_limit",
  "clutch_codes_plan_code",
  "clutch_codes_subscription_status",
]);

export function buildLegacyAdminCustomerUpdate(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !PROTECTED_COMMERCE_FIELDS.has(key)));
}

export function isProtectedCommerceField(field: string) {
  return PROTECTED_COMMERCE_FIELDS.has(field);
}
