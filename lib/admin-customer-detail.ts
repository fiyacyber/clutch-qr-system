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

  const access = resolveAccountAccess({
    customer: input.customer,
    usedQrCount: qrCodes.filter((row) => row.counts_toward_capacity !== false).length,
    hasSmartCardOrder: cardOrders.length > 0,
    hasSmartCardSystemQr: qrCodes.some(
      (row) => row.is_system === true && row.qr_type === "smart_card"
    ),
    hasActiveProfile: profiles.some((row) => row.is_active === true),
    hasPrintOrders: printOrders.length > 0,
    hasTrackedPrint: completedProvisionings.some((row) => row.source_type === "tracked_print"),
    hasBusinessKit: completedProvisionings.some((row) => row.source_type === "business_kit"),
    hasIncludedPrintQr: completedProvisionings.some(
      (row) => row.access_type === "included_permanent"
    ),
    printOrderCount: printOrders.length,
    includedPrintQrCount: completedProvisionings.filter(
      (row) => row.access_type === "included_permanent"
    ).length,
    materialTypes,
  });

  return {
    access,
    counts: {
      qrCodes: qrCodes.length,
      activeProfiles: profiles.filter((row) => row.is_active === true).length,
      cardOrders: cardOrders.length,
      printOrders: printOrders.length,
      completedProvisionings: completedProvisionings.length,
    },
  };
}
