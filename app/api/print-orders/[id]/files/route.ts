import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  PRINT_ORDER_FILE_BUCKET,
  MAX_PRINT_FILE_BYTES,
  actorCanUploadPrintFile,
  allowedPrintFileExtension,
  buildPrintFilePath,
  isPrintFileKind,
} from "@/lib/print-operations";
import {
  loadAuthorizedPrintOrder,
  requirePrintOperationsActor,
  safePrintOperationsError,
} from "@/lib/print-operations-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { admin, actor } = await requirePrintOperationsActor();
  if (!actor) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const order = await loadAuthorizedPrintOrder(admin, actor, id, "id, customer_id, workflow_state");
  if (!order) return NextResponse.json({ error: "print_order_not_found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("file_kind");
  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (!isPrintFileKind(kind) || !actorCanUploadPrintFile(actor.actorType, kind)) {
    return NextResponse.json({ error: "file_kind_not_allowed" }, { status: 403 });
  }
  const extension = allowedPrintFileExtension(file.type);
  if (!extension) return NextResponse.json({ error: "file_type_not_supported" }, { status: 415 });
  if (file.size > MAX_PRINT_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileId = randomUUID();
  const storagePath = buildPrintFilePath({ orderId: id, kind, fileId, extension });
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const idempotencyKey = `print-file:${id}:${fileId}`;

  const { error: uploadError } = await admin.storage.from(PRINT_ORDER_FILE_BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    cacheControl: "private, max-age=0",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "file_upload_failed" }, { status: 500 });

  const { data, error } = await admin.rpc("register_print_order_file", {
    p_print_order_item_id: id,
    p_file_kind: kind,
    p_storage_path: storagePath,
    p_original_filename: file.name || `${kind}.${extension}`,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_checksum_sha256: checksum,
    p_actor_type: actor.actorType,
    p_actor_auth_user_id: actor.userId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    await admin.storage.from(PRINT_ORDER_FILE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: safePrintOperationsError(error) }, { status: 409 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (kind === "admin_proof" && row?.proof_id) {
    const pageLabels = String(form.get("page_labels") || "").split(",").map((label) => label.trim()).filter(Boolean).slice(0, 20);
    const scanStatus = String(form.get("qr_scan_validation_status") || "pending");
    const { error: metadataError } = await admin.rpc("update_print_proof_review_metadata", {
      p_print_order_item_id: id,
      p_proof_id: row.proof_id,
      p_actor_auth_user_id: actor.userId,
      p_page_labels: pageLabels,
      p_qr_placement_note: String(form.get("qr_placement_note") || "").trim().slice(0, 500),
      p_scan_validation_status: ["pending", "passed", "failed", "not_required"].includes(scanStatus) ? scanStatus : "pending",
    });
    if (metadataError) return NextResponse.json({ error: safePrintOperationsError(metadataError) }, { status: 409 });
  }
  return NextResponse.json({ ok: true, fileId: row?.file_id, proofId: row?.proof_id, workflowState: row?.workflow_state });
}
