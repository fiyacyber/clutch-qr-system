const CANONICAL_CUSTOMER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalCustomerId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_CUSTOMER_UUID.test(value);
}
