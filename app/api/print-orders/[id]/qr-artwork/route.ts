import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { requireCustomer } from "@/lib/auth";
import { loadAccountAccess } from "@/lib/account-access-server";
import { isEmailConfigured, sendTransactionalEmail } from "@/lib/email";
import { getExportShortUrl } from "@/lib/qrExport";
import { loadOrderLinkedQrAccess } from "@/lib/order-linked-access";
import { renderPrintQrSvg, sanitizePrintQrDesign, type PrintQrDesign } from "@/lib/print-qr-artwork";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const QR_LOGO_BUCKET = "qr-logos";
const PRINT_FILE_BUCKET = "print-order-files";
const MAX_LOGO_SIZE = 1024 * 1024;
const LOGO_TYPES = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]);

type PlacementPreferences = {
  placementMode: "clutch_choice" | "customer_preference";
  artworkSide: "front" | "back" | "either" | "not_applicable";
  preferredPosition: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "centered" | "custom" | "";
  placementInstructions: string;
  preferredPrintSize: string;
};

function sanitizePlacement(input: Record<string, unknown>): PlacementPreferences {
  const placementMode = input.placementMode === "customer_preference" ? "customer_preference" : "clutch_choice";
  if (placementMode === "clutch_choice") return {
    placementMode, artworkSide: "not_applicable", preferredPosition: "", placementInstructions: "", preferredPrintSize: "",
  };
  const sides = ["front", "back", "either"] as const;
  const positions = ["top_left", "top_right", "bottom_left", "bottom_right", "centered", "custom"] as const;
  const artworkSide = sides.includes(input.artworkSide as typeof sides[number]) ? input.artworkSide as typeof sides[number] : "either";
  const preferredPosition = positions.includes(input.preferredPosition as typeof positions[number]) ? input.preferredPosition as typeof positions[number] : "centered";
  return {
    placementMode, artworkSide, preferredPosition,
    placementInstructions: String(input.placementInstructions || "").trim().slice(0, 2000),
    preferredPrintSize: String(input.preferredPrintSize || "").trim().slice(0, 100),
  };
}

async function readPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const design = JSON.parse(String(form.get("design") || "{}")) as Record<string, unknown>;
    const entry = form.get("logo");
    return {
      action: String(form.get("action") || "draft"),
      design,
      placement: JSON.parse(String(form.get("placement") || "{}")) as Record<string, unknown>,
      logo: entry && typeof entry !== "string" && entry.size > 0 ? entry : null,
      idempotencyKey: String(form.get("idempotencyKey") || ""),
    };
  }
  const body = await request.json() as Record<string, unknown>;
  return {
    action: String(body.action || "draft"),
    design: (body.design && typeof body.design === "object" ? body.design : {}) as Record<string, unknown>,
    placement: (body.placement && typeof body.placement === "object" ? body.placement : {}) as Record<string, unknown>,
    logo: null,
    idempotencyKey: String(body.idempotencyKey || ""),
  };
}

async function getLogoDataUri(admin: ReturnType<typeof createSupabaseAdminClient>, logoPath: string | null) {
  if (!logoPath) return null;
  const { data, error } = await admin.storage.from(QR_LOGO_BUCKET).download(logoPath);
  if (error || !data || data.size > MAX_LOGO_SIZE) return null;
  const mimeType = data.type && LOGO_TYPES.has(data.type) ? data.type : "image/png";
  return `data:${mimeType};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}

async function sendSubmissionNotifications(input: {
  customerEmail: string;
  orderId: string;
  orderNumber: string;
  productTitle: string;
  revision: number;
  idempotencyKey: string;
}) {
  if (!isEmailConfigured()) return;
  const customerText = `Your Clutch Code QR has been submitted for ${input.productTitle}. Revision ${input.revision} is frozen for artwork. You can review it in order ${input.orderNumber}.`;
  const operationsEmail = process.env.PRINT_OPERATIONS_EMAIL || process.env.SUPPORT_EMAIL || "";
  const sends = [sendTransactionalEmail({
    to: input.customerEmail,
    subject: `QR submitted for artwork — order ${input.orderNumber}`,
    text: customerText,
    idempotencyKey: `${input.idempotencyKey}:customer-email`,
    fromName: "Clutch Print Shop",
  })];
  if (operationsEmail) sends.push(sendTransactionalEmail({
    to: operationsEmail,
    subject: `QR ready for artwork — order ${input.orderNumber}`,
    text: `${input.productTitle} has QR revision ${input.revision} ready to place into artwork. Print item: ${input.orderId}.`,
    idempotencyKey: `${input.idempotencyKey}:operations-email`,
    fromName: "Clutch Print Shop",
  }));
  const results = await Promise.allSettled(sends);
  results.forEach((result) => {
    if (result.status === "rejected") console.error("PRINT QR SUBMISSION EMAIL ERROR", result.reason);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, customer } = await requireCustomer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const admin = createSupabaseAdminClient();
  const [{ data: order }, { data: provisioning }] = await Promise.all([
    admin.from("print_order_items").select("*").eq("id", id).eq("customer_id", customer.id).maybeSingle(),
    admin.from("print_qr_provisionings").select("qr_code_id,provisioning_status").eq("print_order_item_id", id).eq("customer_id", customer.id).maybeSingle(),
  ]);
  if (!order || !provisioning?.qr_code_id || provisioning.provisioning_status !== "completed" || order.tracking_mode === "none") {
    return NextResponse.json({ error: "This print item is not eligible for QR setup." }, { status: 404 });
  }
  const { data: code } = await admin.from("qr_codes")
    .select("id,customer_id,name,slug,destination_url,foreground_color,background_color,dot_style,corner_style,style_config,logo_url,logo_path")
    .eq("id", provisioning.qr_code_id).eq("customer_id", customer.id).eq("print_order_item_id", id).maybeSingle();
  if (!code?.slug) return NextResponse.json({ error: "The linked Clutch Code is unavailable." }, { status: 404 });

  const codeAccess = await loadOrderLinkedQrAccess(admin, customer, code.id);
  if (!codeAccess.canEditDestination) {
    return NextResponse.json({ error: "Your Included Access Has Ended", accessState: codeAccess.state }, { status: 403 });
  }

  let payload: Awaited<ReturnType<typeof readPayload>>;
  try {
    payload = await readPayload(request);
  } catch {
    return NextResponse.json({ error: "Invalid QR setup payload." }, { status: 400 });
  }
  if (!["validate", "draft", "submit"].includes(payload.action)) {
    return NextResponse.json({ error: "Invalid QR setup action." }, { status: 400 });
  }

  const accountAccess = await loadAccountAccess(admin, customer);
  const existingStyle = (code.style_config && typeof code.style_config === "object" ? code.style_config : {}) as Record<string, unknown>;
  let logoPath = typeof code.logo_path === "string" ? code.logo_path : null;
  let logoUrl = typeof code.logo_url === "string" ? code.logo_url : null;
  let newlyUploadedLogoPath: string | null = null;
  if (payload.logo && payload.action === "submit") {
    return NextResponse.json({ error: "Save the draft with your logo before sending the QR to artwork." }, { status: 409 });
  }
  if (payload.logo && payload.action === "draft") {
    if (!accountAccess.canUploadQrLogo) return NextResponse.json({ error: "Logo customization requires an active Clutch Codes plan." }, { status: 403 });
    const extension = LOGO_TYPES.get(payload.logo.type);
    if (!extension || payload.logo.size > MAX_LOGO_SIZE) return NextResponse.json({ error: "Use a PNG, JPG, or WEBP logo up to 1 MB." }, { status: 400 });
    const nextPath = `${customer.id}/${code.id}/print-${nanoid(12)}.${extension}`;
    const upload = await admin.storage.from(QR_LOGO_BUCKET).upload(nextPath, payload.logo, { contentType: payload.logo.type, cacheControl: "3600", upsert: false });
    if (upload.error) return NextResponse.json({ error: "Logo upload failed." }, { status: 500 });
    newlyUploadedLogoPath = nextPath;
    logoPath = nextPath;
    logoUrl = admin.storage.from(QR_LOGO_BUCKET).getPublicUrl(nextPath).data.publicUrl;
  }

  let design: PrintQrDesign;
  try {
    design = sanitizePrintQrDesign({ ...payload.design, logoPath, logoUrl }, {
      codeName: code.name,
      campaignName: String(existingStyle.campaignName || code.name),
      destinationUrl: code.destination_url,
      foregroundColor: code.foreground_color,
      backgroundColor: code.background_color,
      dotStyle: code.dot_style,
      cornerStyle: code.corner_style,
      frameStyle: String(existingStyle.frameStyle || "none") as PrintQrDesign["frameStyle"],
      frameColor: String(existingStyle.frameColor || "#384862"),
      frameLabel: String(existingStyle.frameLabel || "SCAN ME"),
      logoPath,
      logoUrl,
      logoSize: Number(existingStyle.logoSize || 18),
    });
  } catch (error) {
    if (newlyUploadedLogoPath) await admin.storage.from(QR_LOGO_BUCKET).remove([newlyUploadedLogoPath]);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid QR design." }, { status: 400 });
  }
  const placement = sanitizePlacement(payload.placement);

  if (payload.action === "validate") return NextResponse.json({ success: true, destinationUrl: design.destinationUrl, message: "Destination is valid and ready to test." });

  if (payload.action === "draft") {
    const { error } = await admin.rpc("save_print_qr_artwork_draft", {
      p_print_order_item_id: id, p_customer_id: customer.id, p_qr_code_id: code.id,
      p_actor_auth_user_id: user.id, p_design: design, p_placement: placement,
    });
    if (error) {
      if (newlyUploadedLogoPath) await admin.storage.from(QR_LOGO_BUCKET).remove([newlyUploadedLogoPath]);
      return NextResponse.json({ error: "QR draft could not be saved." }, { status: 409 });
    }
    return NextResponse.json({ success: true, design, placement, message: "QR draft saved." });
  }

  const idempotencyKey = payload.idempotencyKey.trim() || `qr-artwork:${id}:${nanoid(18)}`;
  const logoDataUri = accountAccess.canUploadQrLogo ? await getLogoDataUri(admin, design.logoPath) : null;
  const svg = renderPrintQrSvg(getExportShortUrl(code.slug), design, logoDataUri);
  const bytes = Buffer.from(svg, "utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storageName = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 40);
  const storagePath = `${customer.id}/${id}/qr-artwork/${storageName}.svg`;
  const designSnapshot = { ...design, shortUrl: getExportShortUrl(code.slug), slug: code.slug };

  const { data: prepared, error: prepareError } = await admin.rpc("prepare_print_qr_artwork_submission", {
    p_print_order_item_id: id, p_customer_id: customer.id, p_qr_code_id: code.id,
    p_actor_auth_user_id: user.id, p_idempotency_key: idempotencyKey,
    p_checksum_sha256: checksum, p_design_snapshot: designSnapshot, p_placement_snapshot: placement,
  });
  if (prepareError) {
    const conflict = prepareError.message?.includes("proof") || prepareError.message?.includes("conflicts");
    return NextResponse.json({ error: prepareError.message?.includes("proof") ? "QR revisions are locked once the complete artwork proof is sent." : "QR submission conflicts with the current order state." }, { status: conflict ? 409 : 500 });
  }
  if (prepared?.[0]) {
    return NextResponse.json({ success: true, revision: Number(prepared[0].revision), fileId: prepared[0].file_id, message: `QR revision ${prepared[0].revision} is already with the artwork team.` });
  }

  const upload = await admin.storage.from(PRINT_FILE_BUCKET).upload(storagePath, bytes, { contentType: "image/svg+xml", upsert: false });
  let createdStorageObject = !upload.error;
  if (upload.error) {
    const existing = await admin.storage.from(PRINT_FILE_BUCKET).download(storagePath);
    if (existing.error || !existing.data) return NextResponse.json({ error: "The print-ready QR could not be stored." }, { status: 500 });
    const existingChecksum = createHash("sha256").update(Buffer.from(await existing.data.arrayBuffer())).digest("hex");
    if (existingChecksum !== checksum) return NextResponse.json({ error: "This retry key is already associated with different artwork." }, { status: 409 });
    createdStorageObject = false;
  }

  const { data: registered, error: registerError } = await admin.rpc("register_print_qr_artwork_submission", {
    p_print_order_item_id: id,
    p_customer_id: customer.id,
    p_qr_code_id: code.id,
    p_storage_path: storagePath,
    p_original_filename: `clutch-code-${code.slug}.svg`,
    p_mime_type: "image/svg+xml",
    p_size_bytes: bytes.byteLength,
    p_checksum_sha256: checksum,
    p_design_snapshot: designSnapshot,
    p_placement_snapshot: placement,
    p_destination_url_snapshot: design.destinationUrl,
    p_actor_auth_user_id: user.id,
    p_idempotency_key: idempotencyKey,
  });
  if (registerError || !registered?.[0]) {
    if (createdStorageObject) await admin.storage.from(PRINT_FILE_BUCKET).remove([storagePath]);
    const conflict = registerError?.message?.includes("proof") || registerError?.message?.includes("conflicts");
    const message = registerError?.message?.includes("proof") ? "QR revisions are locked once the complete artwork proof is sent." : "QR submission could not be completed.";
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 });
  }
  const revision = Number(registered[0].revision);
  await sendSubmissionNotifications({
    customerEmail: customer.email,
    orderId: id,
    orderNumber: order.shopify_order_number || order.shopify_order_id,
    productTitle: order.product_title,
    revision,
    idempotencyKey,
  });
  return NextResponse.json({ success: true, revision, fileId: registered[0].file_id, message: `QR revision ${revision} was sent to the artwork team.` });
}
