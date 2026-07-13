import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  actorCanPerformPrintAction,
  isPrintWorkflowAction,
} from "@/lib/print-operations";
import {
  loadAuthorizedPrintOrder,
  requirePrintOperationsActor,
  safePrintOperationsError,
} from "@/lib/print-operations-server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { admin, actor } = await requirePrintOperationsActor();
  if (!actor) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const order = await loadAuthorizedPrintOrder(admin, actor, id, "id, customer_id, workflow_state");
  if (!order) return NextResponse.json({ error: "print_order_not_found" }, { status: 404 });

  const body = await request.json().catch(() => null) as {
    action?: unknown;
    reason?: unknown;
    supplier?: unknown;
    supplierOrderId?: unknown;
    carrier?: unknown;
    trackingNumber?: unknown;
    trackingUrl?: unknown;
  } | null;
  if (!isPrintWorkflowAction(body?.action) || !actorCanPerformPrintAction(actor.actorType, body.action)) {
    return NextResponse.json({ error: "workflow_action_not_allowed" }, { status: 403 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : null;
  const metadata = {
    supplier: typeof body.supplier === "string" ? body.supplier.trim().slice(0, 255) : "",
    supplier_order_id: typeof body.supplierOrderId === "string" ? body.supplierOrderId.trim().slice(0, 255) : "",
    carrier: typeof body.carrier === "string" ? body.carrier.trim().slice(0, 255) : "",
    tracking_number: typeof body.trackingNumber === "string" ? body.trackingNumber.trim().slice(0, 255) : "",
    tracking_url: typeof body.trackingUrl === "string" ? body.trackingUrl.trim().slice(0, 2000) : "",
  };
  const { data, error } = await admin.rpc("transition_print_order_workflow", {
    p_print_order_item_id: id,
    p_action: body.action,
    p_actor_type: actor.actorType,
    p_actor_auth_user_id: actor.userId,
    p_reason: reason,
    p_metadata: metadata,
    p_idempotency_key: `print-transition:${id}:${body.action}:${randomUUID()}`,
  });
  if (error) return NextResponse.json({ error: safePrintOperationsError(error) }, { status: 409 });
  return NextResponse.json({ ok: true, order: data });
}
