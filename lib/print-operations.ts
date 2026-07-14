export const PRINT_ORDER_FILE_BUCKET = "print-order-files";
export const MAX_PRINT_FILE_BYTES = 25 * 1024 * 1024;

export const PRINT_FILE_KINDS = [
  "customer_artwork",
  "admin_proof",
  "production_artwork",
  "supplier_file",
] as const;

export type PrintFileKind = (typeof PRINT_FILE_KINDS)[number];

export const PRINT_WORKFLOW_STATES = [
  "awaiting_artwork",
  "artwork_received",
  "artwork_review",
  "artwork_changes_requested",
  "proof_preparing",
  "proof_sent",
  "proof_changes_requested",
  "ready_for_production",
  "submitted_to_supplier",
  "in_production",
  "production_complete",
  "fulfilled",
  "delivered",
  "cancelled",
] as const;

export type PrintWorkflowState = (typeof PRINT_WORKFLOW_STATES)[number];

export const PRINT_WORKFLOW_ACTIONS = [
  "begin_artwork_review",
  "request_artwork_changes",
  "approve_artwork",
  "send_proof",
  "approve_proof",
  "request_proof_revision",
  "submit_to_supplier",
  "start_production",
  "complete_production",
  "fulfill",
  "mark_delivered",
  "cancel",
] as const;

export type PrintWorkflowAction = (typeof PRINT_WORKFLOW_ACTIONS)[number];
export type PrintActorType = "admin" | "customer";

const ALLOWED_MIME_EXTENSIONS = new Map([
  ["application/pdf", "pdf"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/tiff", "tiff"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
  ["application/postscript", "eps"],
  ["application/illustrator", "ai"],
]);

const ACTION_ACTOR: Record<PrintWorkflowAction, PrintActorType> = {
  begin_artwork_review: "admin",
  request_artwork_changes: "admin",
  approve_artwork: "admin",
  send_proof: "admin",
  approve_proof: "customer",
  request_proof_revision: "customer",
  submit_to_supplier: "admin",
  start_production: "admin",
  complete_production: "admin",
  fulfill: "admin",
  mark_delivered: "admin",
  cancel: "admin",
};

const TRANSITIONS: Record<PrintWorkflowAction, readonly PrintWorkflowState[]> = {
  begin_artwork_review: ["artwork_received"],
  request_artwork_changes: ["artwork_received", "artwork_review"],
  approve_artwork: ["artwork_received", "artwork_review"],
  send_proof: ["proof_preparing"],
  approve_proof: ["proof_sent"],
  request_proof_revision: ["proof_sent"],
  submit_to_supplier: ["ready_for_production"],
  start_production: ["submitted_to_supplier"],
  complete_production: ["submitted_to_supplier", "in_production"],
  fulfill: ["production_complete"],
  mark_delivered: ["fulfilled"],
  cancel: PRINT_WORKFLOW_STATES.filter((state) => !["delivered", "cancelled"].includes(state)),
};

export function isPrintFileKind(value: unknown): value is PrintFileKind {
  return PRINT_FILE_KINDS.includes(value as PrintFileKind);
}

export function isPrintWorkflowAction(value: unknown): value is PrintWorkflowAction {
  return PRINT_WORKFLOW_ACTIONS.includes(value as PrintWorkflowAction);
}

export function actorCanPerformPrintAction(actor: PrintActorType, action: PrintWorkflowAction) {
  return ACTION_ACTOR[action] === actor;
}

export function canTransitionPrintOrder(state: PrintWorkflowState, action: PrintWorkflowAction) {
  return TRANSITIONS[action].includes(state);
}

export function allowedPrintFileExtension(mimeType: string) {
  return ALLOWED_MIME_EXTENSIONS.get(mimeType.toLowerCase()) || null;
}

export function actorCanUploadPrintFile(actor: PrintActorType, kind: PrintFileKind) {
  return actor === "customer" ? kind === "customer_artwork" : kind !== "customer_artwork";
}

export function buildPrintFilePath(input: {
  orderId: string;
  kind: PrintFileKind;
  fileId: string;
  extension: string;
}) {
  const safeId = input.fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${input.orderId}/${input.kind}/${safeId}.${input.extension}`;
}

export function formatPrintWorkflowState(state: string) {
  return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
