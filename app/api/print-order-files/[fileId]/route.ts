import { NextResponse } from "next/server";
import { PRINT_ORDER_FILE_BUCKET } from "@/lib/print-operations";
import { loadAuthorizedPrintOrder, requirePrintOperationsActor } from "@/lib/print-operations-server";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const { admin, actor } = await requirePrintOperationsActor();
  if (!actor) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: file, error } = await admin.from("print_order_files")
    .select("id, print_order_item_id, file_kind, storage_path, original_filename, mime_type")
    .eq("id", fileId).limit(1).maybeSingle();
  if (error || !file) return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  const order = await loadAuthorizedPrintOrder(admin, actor, file.print_order_item_id, "id");
  if (!order) return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  if (!actor.isAdmin && !["customer_artwork", "admin_proof", "qr_artwork_asset"].includes(file.file_kind)) {
    return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  }

  const inlineRequested = new URL(request.url).searchParams.get("inline") === "1";
  const inlineAllowed = file.file_kind === "admin_proof" && (file.mime_type === "application/pdf" || file.mime_type.startsWith("image/"));
  const { data, error: signedError } = await admin.storage.from(PRINT_ORDER_FILE_BUCKET)
    .createSignedUrl(file.storage_path, 300, inlineRequested && inlineAllowed ? undefined : { download: file.original_filename });
  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl, { status: 307 });
}
