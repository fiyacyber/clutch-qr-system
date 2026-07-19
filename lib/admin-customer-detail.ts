import { resolveAccountAccess, type AccountAccessCustomer } from "./account-access.ts";
import { normalizeRelation } from "./account-evidence.ts";

type QrEvidence = {
  counts_toward_capacity?: boolean | null;
  is_system?: boolean | null;
  qr_type?: string | null;
};

type ProfileEvidence = {
  is_active?: boolean | null;
};

type ProvisioningEvidence = {
  access_type?: string | null;
  source_type?: string | null;
  provisioning_status?: string | null;
  material_type?: string | null;
};

type PrintOrderEvidence = {
  material_type?: string | null;
};

export type AdminCustomerEvidenceInput = {
  customer: AccountAccessCustomer;
  qrCodes?: QrEvidence | QrEvidence[] | null;
  profiles?: ProfileEvidence | ProfileEvidence[] | null;
  cardOrders?: object | object[] | null;
  printOrders?: PrintOrderEvidence | PrintOrderEvidence[] | null;
  provisionings?: ProvisioningEvidence | ProvisioningEvidence[] | null;
  exact?: {
    qrCodes: number;
    usedQrCodes: number;
    activeProfiles: number;
    cardOrders: number;
    printOrders: number;
    completedProvisionings: number;
    includedPrintQr: number;
    hasSmartCardSystemQr: boolean;
    hasTrackedPrint: boolean;
    hasBusinessKit: boolean;
  };
};

export function summarizeAdminCustomerEvidence(input: AdminCustomerEvidenceInput) {
  const qrCodes = normalizeRelation(input.qrCodes);
  const profiles = normalizeRelation(input.profiles);
  const cardOrders = normalizeRelation(input.cardOrders);
  const printOrders = normalizeRelation(input.printOrders);
  const provisionings = normalizeRelation(input.provisionings);
  const completedProvisionings = provisionings.filter(
    (row) => row.provisioning_status === "completed"
  );
  const materialTypes = Array.from(new Set(
    printOrders
      .map((row) => row.material_type)
      .filter((value): value is string => Boolean(value))
  ));
  const exact = input.exact;
  const qrCodeCount = exact?.qrCodes ?? qrCodes.length;
  const usedQrCount = exact?.usedQrCodes
    ?? qrCodes.filter((row) => row.counts_toward_capacity !== false).length;
  const activeProfileCount = exact?.activeProfiles
    ?? profiles.filter((row) => row.is_active === true).length;
  const cardOrderCount = exact?.cardOrders ?? cardOrders.length;
  const printOrderCount = exact?.printOrders ?? printOrders.length;
  const completedProvisioningCount = exact?.completedProvisionings
    ?? completedProvisionings.length;
  const includedPrintQrCount = exact?.includedPrintQr
    ?? completedProvisionings.filter((row) => row.access_type === "included_permanent").length;

  const access = resolveAccountAccess({
    customer: input.customer,
    usedQrCount,
    hasSmartCardOrder: cardOrderCount > 0,
    hasSmartCardSystemQr: exact?.hasSmartCardSystemQr
      ?? qrCodes.some((row) => row.is_system === true && row.qr_type === "smart_card"),
    hasActiveProfile: activeProfileCount > 0,
    hasPrintOrders: printOrderCount > 0,
    hasTrackedPrint: exact?.hasTrackedPrint
      ?? completedProvisionings.some((row) => row.source_type === "tracked_print"),
    hasBusinessKit: exact?.hasBusinessKit
      ?? completedProvisionings.some((row) => row.source_type === "business_kit"),
    hasIncludedPrintQr: includedPrintQrCount > 0,
    printOrderCount,
    includedPrintQrCount,
    materialTypes,
  });

  return {
    access,
    counts: {
      qrCodes: qrCodeCount,
      activeProfiles: activeProfileCount,
      cardOrders: cardOrderCount,
      printOrders: printOrderCount,
      completedProvisionings: completedProvisioningCount,
    },
  };
}
