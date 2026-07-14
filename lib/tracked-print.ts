import { classifyPrintProduct, readPrintProductRegistry, type PrintProductClassification, type TrustedPrintProduct } from "./print-products.ts";
import { hasIncludedAccessCriticalProperties, normalizePrintLineProperties, parseStrictIncludedAccessIntent } from "./print-line-properties.ts";
import { isEnabledEnvironmentFlag } from "./env-flags.js";
import {
  businessKitOrderLinkedAccessEnabled,
  matchBusinessKitContract,
  resolveBusinessKitComponentSelections,
  validateBusinessKitContracts,
  validateBusinessKitIdentityContracts,
} from "./business-kit-contracts.ts";

export type PrintOrderPayload = {
  id?: string | number; order_id?: string | number; name?: string; order_number?: string | number;
  email?: string; contact_email?: string; customer?: { id?: string | number; email?: string; first_name?: string; last_name?: string } | null;
  billing_address?: { email?: string; name?: string } | null;
  line_items?: Array<Record<string, any>>;
};

export type TrackedPrintCustomer = { id: string; auth_user_id?: string | null; shopify_customer_id?: string | null; [key: string]: any };
export type CustomerIdentityResolution =
  | { status: "found"; customer: TrackedPrintCustomer }
  | { status: "not_found" }
  | { status: "conflict" };

export type TrackedPrintDependencies = {
  resolveCustomer(email: string, shopifyCustomerId: string | null): Promise<CustomerIdentityResolution>;
  ensureNeutralCustomer(email: string, name: string, shopifyCustomerId: string | null, orderId: string): Promise<CustomerIdentityResolution>;
  resolveExistingCode(customerId: string, reference: string): Promise<string | null>;
  findPrintItem(orderId: string, lineItemId: string): Promise<Record<string, any> | null>;
  upsertPrintItem(input: Record<string, unknown>): Promise<Record<string, any> & { id: string; provisioning_status: string; immutableMatch: boolean }>;
  importArtwork(input: { printOrderItemId: string; customerId: string; sourceUrl: string; idempotencyKey: string }): Promise<{ fileId: string; imported: boolean }>;
  provisionQr(input: { printOrderItemId: string; customerId: string; destinationUrl: string | null; campaignName: string | null; materialType: string; sourceType: "tracked_print" | "business_kit"; idempotencyKey: string; existingQrCodeId: string | null }): Promise<{ qrCodeId: string; includedQrAllowance: number }>;
  recordActivity(input: { orderId: string; action: string; idempotencyKey: string; reason?: string | null }): Promise<void>;
  markAttention(orderId: string, reason: string): Promise<void>;
};

const CHECKOUT_ARTWORK_IMPORT_FAILURE = "Checkout artwork could not be imported securely.";

function emailFor(order: PrintOrderPayload) {
  return String(order.customer?.email || order.email || order.contact_email || order.billing_address?.email || "").trim().toLowerCase();
}

function artworkValidationReason(properties: ReturnType<typeof normalizePrintLineProperties>) {
  if (properties.artworkMethod === "upload_now" && !properties.artworkFileUrl) return "Artwork upload is required for the selected artwork method.";
  if (properties.artworkMethod === "request_design" && !properties.artworkInstructions) return "Design instructions are required for the selected artwork method.";
  if (properties.artworkMethod === "reorder_existing" && !properties.reorderReference) return "A reorder reference is required for the selected artwork method.";
  return null;
}

export async function provisionTrackedPrintOrder(input: {
  payload: PrintOrderPayload; webhookEventId: string; dependencies: TrackedPrintDependencies; registry?: TrustedPrintProduct[];
}) {
  const orderId = String(input.payload.id || input.payload.order_id || "").trim();
  if (!orderId) return { eligibleItems: 0, processedItems: 0, results: [] };
  const results: Array<Record<string, unknown>> = [];

  const productRegistry = input.registry || readPrintProductRegistry();
  const contractValidation = validateBusinessKitContracts(process.env.BUSINESS_KIT_ORDER_LINKED_REGISTRY_JSON || "[]");
  const businessKitContracts = contractValidation.contracts;
  const identityValidation = validateBusinessKitIdentityContracts(productRegistry, businessKitContracts);
  const businessKitConfigurationInvalid = contractValidation.errors.length > 0 || !identityValidation.valid;
  type ExpandedLineItem = {
    lineItem: Record<string, any>;
    classification: PrintProductClassification;
  };
  const expandedLineItems: ExpandedLineItem[] = [];
  for (const lineItem of input.payload.line_items || []) {
    const classification = classifyPrintProduct(lineItem, productRegistry);
    if (!classification.eligible || !classification.materialType) continue;
    const contract = matchBusinessKitContract(lineItem.product_id, lineItem.sku, businessKitContracts);
    if (classification.sourceType === "tracked_print") {
      // A component contract may never turn a generic print identity into a Business Kit.
      if (contract) continue;
      expandedLineItems.push({ lineItem, classification });
      continue;
    }
    // Explicit Business Kit identities fail closed unless both trusted registries agree exactly.
    if (businessKitConfigurationInvalid || !contract || !businessKitOrderLinkedAccessEnabled()) continue;
    const selections = resolveBusinessKitComponentSelections(contract, lineItem.properties);
    if (selections.some((selection) => !selection.selectionValid)) continue;
    if (hasIncludedAccessCriticalProperties(lineItem.properties) && !parseStrictIncludedAccessIntent(lineItem.properties).valid) continue;
    for (const selection of selections.filter((selection) =>
      selection.trackingMode === "existing_code" ||
      (selection.trackingMode === "new_included_code" && selection.codeCount === 1)
    )) {
      const original = Array.isArray(lineItem.properties)
        ? lineItem.properties.filter((property: any) => !["Tracking Mode", "Clutch Codes Access"].includes(property?.name ?? property?.key))
        : Object.entries(lineItem.properties || {}).filter(([name]) => !["Tracking Mode", "Clutch Codes Access"].includes(name)).map(([name, value]) => ({ name, value }));
      expandedLineItems.push({
        lineItem: {
          ...lineItem,
          id: `${String(lineItem.id || "")}:${selection.componentId}`,
          properties: [
            ...original,
            { name: "Tracking Mode", value: selection.trackingMode },
            { name: "Clutch Codes Access", value: selection.trackingMode === "new_included_code" ? "included_90_days" : "none" },
          ],
        },
        classification: {
          ...classification,
          materialType: selection.materialType,
          defaultTrackingAvailable: true,
        },
      });
    }
  }

  for (const { lineItem, classification } of expandedLineItems) {
    const lineItemId = String(lineItem.id || "").trim();
    if (!lineItemId) continue;

    const properties = normalizePrintLineProperties(lineItem.properties);
    const strictAccess = parseStrictIncludedAccessIntent(lineItem.properties);
    const timedAccessEnabled = isEnabledEnvironmentFlag(process.env.ENABLE_ORDER_LINKED_90_DAY_ACCESS);
    if (timedAccessEnabled && !strictAccess.valid) {
      results.push({ lineItemId, status: "skipped", reason: "invalid_tracking_authority" });
      continue;
    }
    const operationalTrackingMode = timedAccessEnabled
      ? strictAccess.trackingMode!
      : properties.trackingMode;
    const email = emailFor(input.payload);
    const requiresNew = operationalTrackingMode === "new_included_code";
    const requiresExisting = operationalTrackingMode === "existing_code";
    const trackingUnavailable = operationalTrackingMode !== "none" && classification.defaultTrackingAvailable === false;
    const artworkReason = artworkValidationReason(properties);
    const existingItem = await input.dependencies.findPrintItem(orderId, lineItemId);
    let invalid = Boolean(
      artworkReason ||
      (requiresNew && (!email || !properties.campaignName || !properties.destinationUrl || !properties.validDestination)) ||
      (requiresExisting && (!email || !properties.existingClutchCode)) ||
      (properties.artworkMethod && !email)
    );
    const shopifyCustomerId = input.payload.customer?.id ? String(input.payload.customer.id) : null;
    const identity = !trackingUnavailable && email
      ? await input.dependencies.resolveCustomer(email, shopifyCustomerId)
      : { status: "not_found" as const };
    let identityConflict = identity.status === "conflict";
    let customer = existingItem?.customer_id
      ? identity.status === "found" && String(identity.customer.id) === String(existingItem.customer_id)
        ? identity.customer
        : { id: String(existingItem.customer_id) }
      : identity.status === "found"
        ? identity.customer
        : null;

    if (requiresExisting && !customer) invalid = true;
    const requiresNeutralCustomer = requiresNew || Boolean(properties.artworkMethod);
    if (!identityConflict && !trackingUnavailable && !invalid && requiresNeutralCustomer && !customer) {
      const ensured = await input.dependencies.ensureNeutralCustomer(
        email,
        input.payload.billing_address?.name || "",
        shopifyCustomerId,
        orderId
      );
      identityConflict = ensured.status === "conflict";
      customer = ensured.status === "found" ? ensured.customer : null;
    }

    let existingQrCodeId: string | null = null;
    if (!identityConflict && !trackingUnavailable && !invalid && requiresExisting && customer && properties.existingClutchCode) {
      try {
        existingQrCodeId = await input.dependencies.resolveExistingCode(customer.id, properties.existingClutchCode);
      } catch {
        existingQrCodeId = null;
      }
      if (!existingQrCodeId) invalid = true;
    }

    const provisioningStatus = identityConflict || trackingUnavailable || invalid
      ? "needs_attention"
      : operationalTrackingMode === "none"
        ? "not_required"
        : "pending";
    const attentionReason = identityConflict
      ? "Customer account identifiers require review."
      : trackingUnavailable
        ? "QR tracking is not available for this product configuration."
        : artworkReason
          ? artworkReason
          : requiresExisting && invalid
            ? "Selected Clutch Code could not be linked."
            : invalid
              ? (email ? "Tracking request requires a campaign name and valid destination." : "Print setup requires checkout email.")
              : null;

    const item = await input.dependencies.upsertPrintItem({
      customer_id: identityConflict ? null : customer?.id || null,
      shopify_order_id: orderId,
      shopify_order_number: String(input.payload.name || input.payload.order_number || "") || null,
      shopify_line_item_id: lineItemId,
      shopify_customer_id: input.payload.customer?.id ? String(input.payload.customer.id) : null,
      customer_email: email || null,
      customer_name: input.payload.billing_address?.name || null,
      product_id: lineItem.product_id ? String(lineItem.product_id) : null,
      variant_id: lineItem.variant_id ? String(lineItem.variant_id) : null,
      sku: lineItem.sku || null,
      product_title: lineItem.product_title || lineItem.title || "Print product",
      variant_title: lineItem.variant_title || null,
      material_type: classification.materialType,
      quantity: Math.max(1, Number(lineItem.quantity) || 1),
      tracking_mode: operationalTrackingMode,
      clutch_codes_access_opt_in: timedAccessEnabled && strictAccess.optIn,
      campaign_name: properties.campaignName,
      destination_url: properties.destinationUrl,
      existing_qr_code_id: existingQrCodeId,
      artwork_method: properties.artworkMethod,
      artwork_file_url: properties.artworkFileUrl,
      artwork_instructions: properties.artworkInstructions,
      reorder_reference: properties.reorderReference,
      qr_placement_instructions: properties.qrPlacementInstructions,
      artwork_status: "not_received",
      proof_status: "not_started",
      production_status: "not_started",
      fulfillment_status: "unfulfilled",
      provisioning_status: provisioningStatus,
      attention_reason: attentionReason,
      normalized_properties: properties.normalizedProperties,
    });
    const itemKey = `tracked-print:${orderId}:${lineItemId}`;

    if (!item.immutableMatch) {
      await input.dependencies.recordActivity({
        orderId: item.id,
        action: "payload_discrepancy",
        idempotencyKey: `${itemKey}:discrepancy`,
        reason: "Replay payload differs from accepted provisioning inputs.",
      });
      if (!["completed", "not_required"].includes(item.provisioning_status)) {
        await input.dependencies.markAttention(item.id, "Replay payload differs from accepted provisioning inputs.");
      }
      results.push({ lineItemId, status: "needs_attention", discrepancy: true });
      continue;
    }

    if (identityConflict || trackingUnavailable || invalid) {
      const reason = attentionReason || "Print setup requires review.";
      await input.dependencies.markAttention(item.id, reason);
      await input.dependencies.recordActivity({
        orderId: item.id,
        action: "needs_attention",
        idempotencyKey: `${itemKey}:needs-attention`,
        reason,
      });
      results.push({ lineItemId, status: "needs_attention" });
      continue;
    }

    const acceptedStatus = item.provisioning_status;
    const operationKey = `${itemKey}:${item.tracking_mode}`;
    const canResumeArtworkImport = acceptedStatus === "needs_attention" &&
      item.attention_reason === CHECKOUT_ARTWORK_IMPORT_FAILURE &&
      properties.artworkMethod === "upload_now" &&
      Boolean(properties.artworkFileUrl);
    if (acceptedStatus === "needs_attention" && !canResumeArtworkImport) {
      await input.dependencies.recordActivity({
        orderId: item.id,
        action: "needs_attention",
        idempotencyKey: `${operationKey}:activity`,
        reason: item.attention_reason || attentionReason,
      });
      results.push({ lineItemId, status: "needs_attention" });
      continue;
    }

    if (properties.artworkMethod === "upload_now" && properties.artworkFileUrl) {
      if (!customer) {
        await input.dependencies.markAttention(item.id, CHECKOUT_ARTWORK_IMPORT_FAILURE);
        results.push({ lineItemId, status: "needs_attention" });
        continue;
      }
      try {
        await input.dependencies.importArtwork({
          printOrderItemId: item.id,
          customerId: customer.id,
          sourceUrl: properties.artworkFileUrl,
          idempotencyKey: `${itemKey}:artwork-import`,
        });
      } catch {
        const reason = CHECKOUT_ARTWORK_IMPORT_FAILURE;
        await input.dependencies.markAttention(item.id, reason);
        await input.dependencies.recordActivity({
          orderId: item.id,
          action: "needs_attention",
          idempotencyKey: `${itemKey}:artwork-import-failed`,
          reason,
        });
        results.push({ lineItemId, status: "needs_attention" });
        continue;
      }
    }

    if (acceptedStatus === "not_required") {
      await input.dependencies.recordActivity({
        orderId: item.id,
        action: "not_required",
        idempotencyKey: `${operationKey}:activity`,
        reason: item.attention_reason || attentionReason,
      });
      results.push({ lineItemId, status: "not_required" });
      continue;
    }
    if (!customer) {
      results.push({ lineItemId, status: "needs_attention" });
      continue;
    }

    let provisioned;
    try {
      provisioned = await input.dependencies.provisionQr({
        printOrderItemId: item.id,
        customerId: customer.id,
        destinationUrl: item.destination_url,
        campaignName: item.campaign_name,
        materialType: item.material_type,
        sourceType: classification.sourceType,
        idempotencyKey: operationKey,
        existingQrCodeId: item.existing_qr_code_id,
      });
    } catch (error) {
      if (!requiresExisting) throw error;
      const reason = "Selected Clutch Code could not be linked.";
      await input.dependencies.markAttention(item.id, reason);
      await input.dependencies.recordActivity({
        orderId: item.id,
        action: "needs_attention",
        idempotencyKey: `${operationKey}:attention`,
        reason,
      });
      results.push({ lineItemId, status: "needs_attention" });
      continue;
    }
    results.push({
      lineItemId,
      status: "completed",
      qrCodeId: provisioned.qrCodeId,
      includedQrAllowance: provisioned.includedQrAllowance,
    });
  }
  return { eligibleItems: results.length, processedItems: results.length, results };
}
