import { classifyPrintProduct, type TrustedPrintProduct } from "./print-products.ts";
import { normalizePrintLineProperties } from "./print-line-properties.ts";

export type PrintOrderPayload = {
  id?: string | number; order_id?: string | number; name?: string; order_number?: string | number;
  email?: string; contact_email?: string; customer?: { id?: string | number; email?: string; first_name?: string; last_name?: string } | null;
  billing_address?: { email?: string; name?: string } | null;
  line_items?: Array<Record<string, any>>;
};

export type TrackedPrintDependencies = {
  findCustomer(email: string, shopifyCustomerId: string | null): Promise<{ id: string; auth_user_id?: string | null } | null>;
  ensureNeutralCustomer(email: string, name: string, shopifyCustomerId: string | null, orderId: string): Promise<{ id: string }>;
  findPrintItem(orderId: string, lineItemId: string): Promise<Record<string, any> | null>;
  upsertPrintItem(input: Record<string, unknown>): Promise<Record<string, any> & { id: string; provisioning_status: string; immutableMatch: boolean }>;
  provisionQr(input: { printOrderItemId: string; customerId: string; destinationUrl: string | null; campaignName: string | null; materialType: string; idempotencyKey: string; existingQrCodeId: string | null }): Promise<{ qrCodeId: string; includedQrAllowance: number }>;
  recordActivity(input: { orderId: string; action: string; idempotencyKey: string; reason?: string | null }): Promise<void>;
  markAttention(orderId: string, reason: string): Promise<void>;
};

function emailFor(order: PrintOrderPayload) {
  return String(order.customer?.email || order.email || order.contact_email || order.billing_address?.email || "").trim().toLowerCase();
}

export async function provisionTrackedPrintOrder(input: {
  payload: PrintOrderPayload; webhookEventId: string; dependencies: TrackedPrintDependencies; registry?: TrustedPrintProduct[];
}) {
  const orderId = String(input.payload.id || input.payload.order_id || "").trim();
  if (!orderId) return { eligibleItems: 0, processedItems: 0, results: [] };
  const results: Array<Record<string, unknown>> = [];
  for (const lineItem of input.payload.line_items || []) {
    const classification = classifyPrintProduct(lineItem, input.registry);
    if (!classification.eligible || !classification.materialType) continue;
    const lineItemId = String(lineItem.id || "").trim();
    if (!lineItemId) continue;
    const properties = normalizePrintLineProperties(lineItem.properties);
    const email = emailFor(input.payload);
    const requiresNew = properties.trackingMode === "new_included_code";
    const requiresExisting = properties.trackingMode === "existing_code";
    const trackingUnavailable = properties.trackingMode !== "none" && classification.defaultTrackingAvailable === false;
    const existingItem = await input.dependencies.findPrintItem(orderId, lineItemId);
    let invalid = (requiresNew && (!email || !properties.destinationUrl || !properties.validDestination)) ||
      (requiresExisting && (!email || !properties.existingQrCodeId));
    let customer = existingItem?.customer_id ? { id: String(existingItem.customer_id) } :
      (!trackingUnavailable && email ? await input.dependencies.findCustomer(email, input.payload.customer?.id ? String(input.payload.customer.id) : null) : null);
    if (requiresExisting && !customer) invalid = true;
    if (!trackingUnavailable && !invalid && requiresNew && !customer) {
      customer = await input.dependencies.ensureNeutralCustomer(email, input.payload.billing_address?.name || "", input.payload.customer?.id ? String(input.payload.customer.id) : null, orderId);
    }
    const provisioningStatus = trackingUnavailable || invalid ? "needs_attention" : properties.trackingMode === "none" ? "not_required" : "pending";
    const attentionReason = trackingUnavailable ? "QR tracking is not available for this product configuration." :
      invalid ? (email ? "Tracking request requires valid destination or existing code." : "Tracking request requires checkout email.") : null;
    const item = await input.dependencies.upsertPrintItem({
      customer_id: customer?.id || null, shopify_order_id: orderId,
      shopify_order_number: String(input.payload.name || input.payload.order_number || "") || null,
      shopify_line_item_id: lineItemId, shopify_customer_id: input.payload.customer?.id ? String(input.payload.customer.id) : null,
      customer_email: email || null, customer_name: input.payload.billing_address?.name || null,
      product_id: lineItem.product_id ? String(lineItem.product_id) : null, variant_id: lineItem.variant_id ? String(lineItem.variant_id) : null,
      sku: lineItem.sku || null, product_title: lineItem.product_title || lineItem.title || "Print product",
      variant_title: lineItem.variant_title || null, material_type: classification.materialType,
      quantity: Math.max(1, Number(lineItem.quantity) || 1), tracking_mode: properties.trackingMode,
      campaign_name: properties.campaignName, destination_url: properties.destinationUrl,
      existing_qr_code_id: properties.existingQrCodeId, artwork_method: properties.artworkMethod,
      artwork_file_url: properties.artworkFileUrl, artwork_instructions: properties.artworkInstructions,
      qr_placement_instructions: properties.qrPlacementInstructions,
      artwork_status: properties.artworkFileUrl ? "received" : "not_received", proof_status: "not_started",
      production_status: "not_started", fulfillment_status: "unfulfilled", provisioning_status: provisioningStatus,
      attention_reason: attentionReason, normalized_properties: properties.normalizedProperties,
    });
    const itemKey = `tracked-print:${orderId}:${lineItemId}`;
    if (!item.immutableMatch) {
      await input.dependencies.recordActivity({ orderId: item.id, action: "payload_discrepancy", idempotencyKey: `${itemKey}:discrepancy`, reason: "Replay payload differs from accepted provisioning inputs." });
      if (!["completed", "not_required"].includes(item.provisioning_status)) await input.dependencies.markAttention(item.id, "Replay payload differs from accepted provisioning inputs.");
      results.push({ lineItemId, status: "needs_attention", discrepancy: true }); continue;
    }
    const acceptedStatus = item.provisioning_status;
    const operationKey = `${itemKey}:${item.tracking_mode}`;
    if (acceptedStatus === "not_required" || acceptedStatus === "needs_attention") {
      await input.dependencies.recordActivity({ orderId: item.id, action: acceptedStatus, idempotencyKey: `${operationKey}:activity`, reason: item.attention_reason || attentionReason });
      results.push({ lineItemId, status: acceptedStatus }); continue;
    }
    if (!customer) {
      results.push({ lineItemId, status: "needs_attention" }); continue;
    }
    let provisioned;
    try {
      provisioned = await input.dependencies.provisionQr({
        printOrderItemId: item.id, customerId: customer.id, destinationUrl: item.destination_url,
        campaignName: item.campaign_name, materialType: item.material_type,
        idempotencyKey: operationKey, existingQrCodeId: item.existing_qr_code_id,
      });
    } catch (error) {
      if (!requiresExisting) throw error;
      await input.dependencies.markAttention(item.id, "Selected Clutch Code could not be linked.");
      await input.dependencies.recordActivity({ orderId: item.id, action: "needs_attention", idempotencyKey: `${operationKey}:attention`, reason: "Selected Clutch Code could not be linked." });
      results.push({ lineItemId, status: "needs_attention" }); continue;
    }
    results.push({ lineItemId, status: "completed", qrCodeId: provisioned.qrCodeId, includedQrAllowance: provisioned.includedQrAllowance });
  }
  return { eligibleItems: results.length, processedItems: results.length, results };
}
