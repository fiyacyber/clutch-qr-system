export interface SystemQrEvidence {
  is_system?: boolean | null;
  qr_type?: string | null;
}

export interface ProfileEvidence {
  is_active?: boolean | null;
}

export function isSmartCardSystemQr(qr: SystemQrEvidence): boolean {
  return qr.is_system === true && qr.qr_type === "smart_card";
}

export function hasSmartCardSystemQrEvidence(rows: SystemQrEvidence[] | null | undefined): boolean {
  return (rows || []).some(isSmartCardSystemQr);
}

export function hasActiveProfileEvidence(rows: ProfileEvidence[] | null | undefined): boolean {
  return (rows || []).some((profile) => profile.is_active === true);
}
