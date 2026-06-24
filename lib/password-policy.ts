export const PASSWORD_POLICY_HELPER_TEXT =
  "Use at least 12 characters with uppercase, lowercase, a number, and a special character.";

export function validatePasswordPolicy(password: string) {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialCharacter) {
    return "Password must include uppercase, lowercase, a number, and a special character.";
  }

  return null;
}