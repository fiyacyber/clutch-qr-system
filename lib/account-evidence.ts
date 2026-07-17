export interface SystemQrEvidence {
  is_system?: boolean | null;
  qr_type?: string | null;
}

export interface ProfileEvidence {
  is_active?: boolean | null;
}

export type RelationValue<T> = T | T[] | null | undefined;

export function normalizeRelation<T>(value: RelationValue<T>): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function isSmartCardSystemQr(qr: SystemQrEvidence): boolean {
  return qr.is_system === true && qr.qr_type === "smart_card";
}

export function hasSmartCardSystemQrEvidence(rows: RelationValue<SystemQrEvidence>): boolean {
  return normalizeRelation(rows).some(isSmartCardSystemQr);
}

export function hasActiveProfileEvidence(rows: RelationValue<ProfileEvidence>): boolean {
  return normalizeRelation(rows).some((profile) => profile.is_active === true);
}
