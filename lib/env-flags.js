const ENABLED_ENV_FLAG_VALUES = new Set(["true", "1", "yes", "on"]);

/**
 * @param {string | undefined | null} value
 */
export function isEnabledEnvironmentFlag(value) {
  return ENABLED_ENV_FLAG_VALUES.has(String(value ?? "").trim().toLowerCase());
}
