import crypto from "crypto";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CopyTextButton from "@/components/admin/CopyTextButton";
import { requireCustomer } from "@/lib/auth";
import { sendTransactionalEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./page.module.css";

interface CardOrdersPageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    sent_to_handler?: string;
    fulfillment_status?: string;
    fulfillment_sent_at?: string;
    proof_email_sent?: string;
    proof_status?: string;
    proof_sent_at?: string;
  }>;
}

type CardOrderRow = {
  id: string;
  customer_id: string | null;
  shopify_order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  product_title: string | null;
  variant_title: string | null;
  engraving_requested: boolean | null;
  engraving_business_name: string | null;
  engraving_title: string | null;
  engraving_phone: string | null;
  engraving_email: string | null;
  custom_details: string | null;
  internal_notes: string | null;
  proof_url: string | null;
  proof_token: string | null;
  approver_name: string | null;
  approver_email: string | null;
  proof_sent_at: string | null;
  proof_viewed_at: string | null;
  customer_approved_at: string | null;
  changes_requested_at: string | null;
  approval_notes: string | null;
  approval_status: string | null;
  supplier_ordered_at: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  fulfilled_at: string | null;
  setup_completed_at: string | null;
  fulfillment_handler_email: string | null;
  fulfillment_sent_at: string | null;
  fulfillment_status: string | null;
  fulfillment_notes: string | null;
  supplier_order_id: string | null;
  raw_order_payload: Record<string, any> | null;
  created_at: string;
  updated_at: string | null;
  status: string;
};

type CustomerSetupRow = {
  id: string;
  onboarding_status: string | null;
  guided_setup_required?: boolean | null;
};

type ProfileSetupRow = {
  customer_id: string;
  setup_completed?: boolean | null;
};

const FULFILLMENT_STATUSES = [
  { value: "setup_pending", label: "Setup Pending" },
  { value: "needs_review", label: "Needs Review" },
  { value: "design_pending", label: "Design Pending" },
  { value: "proof_sent", label: "Proof Sent" },
  { value: "approved", label: "Approved" },
  { value: "ordered_from_supplier", label: "Ordered From Supplier" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "changes_requested", label: "Changes Requested" },
] as const;

const APPROVAL_STATUSES = [
  "not_ready",
  "ready",
  "sent",
  "viewed",
  "approved",
  "changes_requested",
] as const;

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs Review" },
  { value: "design_pending", label: "Design Pending" },
  { value: "proof_sent", label: "Proof Sent" },
  { value: "approved", label: "Approved" },
  { value: "ordered_from_supplier", label: "Ordered From Supplier" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const QUICK_ACTION_STATUSES = [
  "needs_review",
  "design_pending",
  "proof_sent",
  "approved",
  "ordered_from_supplier",
  "fulfilled",
  "cancelled",
] as const;

const STATUS_MAP = new Map<string, string>(FULFILLMENT_STATUSES.map((status) => [status.value, status.label]));
const ALLOWED_UPDATE_STATUSES = new Set(FULFILLMENT_STATUSES.map((status) => status.value));
const FILTER_SET = new Set<string>(FILTER_OPTIONS.map((status) => status.value));

function toStatusLabel(value: string | null | undefined) {
  if (!value) return "Setup Pending";
  return STATUS_MAP.get(value) || value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toApprovalStatusLabel(value: string | null | undefined) {
  if (!value) return "Not Ready";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toFulfillmentStatusLabel(value: string | null | undefined) {
  if (!value) return "Not Sent";
  if (value === "not_sent") return "Not Sent";
  if (value === "sent_to_handler") return "Sent to Handler";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClassName(status: string) {
  if (status === "fulfilled") return "#d5f7df";
  if (status === "approved") return "#d8f4e7";
  if (status === "ordered_from_supplier") return "#deecff";
  if (status === "proof_sent") return "#d9ecff";
  if (status === "design_pending") return "#e9e4ff";
  if (status === "needs_review") return "#fff0d7";
  if (status === "cancelled") return "#ffe3e3";
  if (status === "changes_requested") return "#ffe5bf";
  return "#e9f0fc";
}

function safeLower(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function hasValue(value: string | null | undefined) {
  return Boolean(String(value || "").trim());
}

function isMissingColumnError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

function normalizeTextInput(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function toInternalUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function isInternalHandlerEmail(email: string) {
  return email.toLowerCase().endsWith("@clutchprintshop.com");
}

function extractShippingAddress(rawPayload: Record<string, any> | null) {
  const shipping = rawPayload?.shipping_address;
  if (!shipping || typeof shipping !== "object") {
    return "Not provided";
  }

  const lines = [
    [shipping.first_name, shipping.last_name].filter(Boolean).join(" "),
    shipping.address1,
    shipping.address2,
    [shipping.city, shipping.province].filter(Boolean).join(", "),
    shipping.zip,
    shipping.country,
    shipping.phone,
  ]
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  return lines.length ? lines.join(", ") : "Not provided";
}

function buildHandlerEmailText(
  order: CardOrderRow,
  params: {
    fulfillmentNotes: string | null;
    supplierOrderId: string | null;
    proofUrl: string | null;
    internalNotes: string | null;
    isInternalHandler: boolean;
    adminBaseUrl: string;
  }
) {
  const shippingAddress = extractShippingAddress(order.raw_order_payload);
  const rawOrderNumber = String(order.shopify_order_number || "").trim();
  const normalizedOrderNumber = rawOrderNumber.replace(/^#+/, "") || "N/A";

  const lines: string[] = [
    `New Smart Business Card Order: #${normalizedOrderNumber}`,
    "",
    `Shopify Order Number: #${normalizedOrderNumber}`,
    `Customer Name: ${order.customer_name || "N/A"}`,
    `Customer Email: ${order.customer_email || "N/A"}`,
    `Customer Phone: ${order.customer_phone || "N/A"}`,
    `Shipping Address: ${shippingAddress}`,
    `Product Title: ${order.product_title || "N/A"}`,
    `Variant Title: ${order.variant_title || "N/A"}`,
    `Engraving Requested: ${order.engraving_requested ? "Yes" : "No"}`,
    `Business Name: ${order.engraving_business_name || "N/A"}`,
    `Title: ${order.engraving_title || "N/A"}`,
    `Business Phone Number: ${order.engraving_phone || "N/A"}`,
    `Business Email: ${order.engraving_email || "N/A"}`,
    `Custom Details: ${order.custom_details || "N/A"}`,
    `Proof URL: ${params.proofUrl || "N/A"}`,
    `Internal Notes: ${params.internalNotes || "N/A"}`,
    `Fulfillment Notes: ${params.fulfillmentNotes || "N/A"}`,
    `Supplier Order ID: ${params.supplierOrderId || "N/A"}`,
  ];

  lines.push("");
  if (params.isInternalHandler) {
    lines.push(`Admin link: ${params.adminBaseUrl}/admin/card-orders`);
  } else {
    lines.push("This handoff email is self-contained and does not require admin login.");
  }

  return lines.join("\n");
}

function buildProofApprovalEmailText({
  approverName,
  approvalUrl,
}: {
  approverName: string | null;
  approvalUrl: string;
}) {
  const greeting = approverName ? `Hi ${approverName},` : "Hi,";
  return [
    greeting,
    "",
    "Your Clutch Connect card proof is ready for review.",
    "",
    "Review & Approve Proof:",
    approvalUrl,
    "",
    "If edits are needed, use the Request Changes option on the review page.",
  ].join("\n");
}

async function generateUniqueProofToken(admin: ReturnType<typeof createSupabaseAdminClient>) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = crypto.randomBytes(24).toString("base64url");
    const { data, error } = await admin
      .from("card_orders")
      .select("id")
      .eq("proof_token", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.id) {
      return candidate;
    }
  }

  return crypto.randomBytes(32).toString("hex");
}

async function loadCustomerSetupRows(admin: ReturnType<typeof createSupabaseAdminClient>, customerIds: string[]) {
  if (!customerIds.length) {
    return [] as CustomerSetupRow[];
  }

  const withGuided = await admin
    .from("customers")
    .select("id, onboarding_status, guided_setup_required")
    .in("id", customerIds);

  if (!withGuided.error) {
    return (withGuided.data || []) as CustomerSetupRow[];
  }

  if (!isMissingColumnError(withGuided.error)) {
    throw withGuided.error;
  }

  const fallback = await admin
    .from("customers")
    .select("id, onboarding_status")
    .in("id", customerIds);

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data || []) as CustomerSetupRow[];
}

async function loadProfileSetupRows(admin: ReturnType<typeof createSupabaseAdminClient>, customerIds: string[]) {
  if (!customerIds.length) {
    return [] as ProfileSetupRow[];
  }

  const withSetupCompleted = await admin
    .from("profiles")
    .select("customer_id, setup_completed")
    .in("customer_id", customerIds);

  if (!withSetupCompleted.error) {
    return (withSetupCompleted.data || []) as ProfileSetupRow[];
  }

  if (!isMissingColumnError(withSetupCompleted.error)) {
    throw withSetupCompleted.error;
  }

  const fallback = await admin
    .from("profiles")
    .select("customer_id")
    .in("customer_id", customerIds);

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data || []) as ProfileSetupRow[];
}

function hasMissingEngravingDetails(order: CardOrderRow) {
  if (!order.engraving_requested) {
    return false;
  }

  return [
    order.engraving_business_name,
    order.engraving_title,
    order.engraving_phone,
    order.engraving_email,
  ].some((field) => !hasValue(field));
}

function getSetupState(
  order: CardOrderRow,
  customerMap: Map<string, CustomerSetupRow>,
  profileMap: Map<string, ProfileSetupRow>
) {
  const customerRow = order.customer_id ? customerMap.get(order.customer_id) : null;
  const profileRow = order.customer_id ? profileMap.get(order.customer_id) : null;

  const onboardingStatus = customerRow?.onboarding_status || "not_started";

  if (!order.customer_id) {
    return { onboardingLabel: "Not linked", setupLabel: "Setup Unknown", setupIncomplete: true, missingProfile: true };
  }

  const setupCompletedTracked = typeof profileRow?.setup_completed === "boolean";

  if (setupCompletedTracked) {
    const complete = profileRow?.setup_completed === true;
    return {
      onboardingLabel: toStatusLabel(onboardingStatus),
      setupLabel: complete ? "Setup Complete" : "Setup Incomplete",
      setupIncomplete: !complete,
      missingProfile: !profileRow,
    };
  }

  if (typeof customerRow?.guided_setup_required === "boolean") {
    const complete = customerRow.guided_setup_required === false;
    return {
      onboardingLabel: toStatusLabel(onboardingStatus),
      setupLabel: complete ? "Setup Complete" : "Setup Incomplete",
      setupIncomplete: !complete,
      missingProfile: !profileRow,
    };
  }

  const completeByStatus = ["active", "complete"].includes(safeLower(onboardingStatus));
  return {
    onboardingLabel: toStatusLabel(onboardingStatus),
    setupLabel: completeByStatus ? "Setup Complete" : "Setup Incomplete",
    setupIncomplete: !completeByStatus,
    missingProfile: !profileRow,
  };
}

function getWarningLabels(
  order: CardOrderRow,
  customerMap: Map<string, CustomerSetupRow>,
  profileMap: Map<string, ProfileSetupRow>
) {
  const warnings: string[] = [];
  const setupState = getSetupState(order, customerMap, profileMap);

  if (hasMissingEngravingDetails(order)) warnings.push("Missing engraving details");
  if (setupState.missingProfile) warnings.push("Missing customer profile");
  if (setupState.setupIncomplete) warnings.push("Setup incomplete");
  if (!hasValue(order.proof_url)) warnings.push("Proof missing");
  if (!hasValue(order.approver_email)) warnings.push("Approver email missing");
  if (order.approval_status === "changes_requested") warnings.push("Changes requested");
  if (order.approval_status === "approved") warnings.push("Approved");

  const ageMs = Date.now() - new Date(order.created_at).getTime();
  const ageOverThreeDays = ageMs > 3 * 24 * 60 * 60 * 1000;
  const notFulfilled = !["fulfilled", "cancelled"].includes(order.status);
  if (ageOverThreeDays && notFulfilled) warnings.push("Over 3 days old and not fulfilled");

  return { warnings, setupState };
}

export default async function CardOrdersPage({ searchParams }: CardOrdersPageProps) {
  const params = await searchParams;
  const queryText = String(params?.q || "").trim();
  const statusParam = String(params?.status || "all").trim().toLowerCase();
  const activeStatus = FILTER_SET.has(statusParam) ? statusParam : "all";

  const diagnostics = {
    sentToHandler: String(params?.sent_to_handler || "") === "true",
    hasHandlerAttempt: Boolean(params?.sent_to_handler),
    fulfillmentStatus: String(params?.fulfillment_status || "").trim() || "not_sent",
    fulfillmentSentAt: String(params?.fulfillment_sent_at || "").trim() || null,
    proofEmailSent: String(params?.proof_email_sent || "") === "true",
    hasProofAttempt: Boolean(params?.proof_email_sent),
    proofStatus: String(params?.proof_status || "").trim() || "not_ready",
    proofSentAt: String(params?.proof_sent_at || "").trim() || null,
  };

  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (customer?.must_change_password) redirect("/change-password");

  if (!customer?.is_admin) {
    return (
      <DashboardShell>
        <main className="container">
          <div className={styles.notAuthorized}>
            <h1>Not authorized</h1>
            <p>You do not have admin access for Smart Business Card order management.</p>
            <p>
              <Link href="/portal">Return to portal</Link>
            </p>
          </div>
        </main>
      </DashboardShell>
    );
  }

  async function updateFulfillment(formData: FormData) {
    "use server";

    const { user: actionUser, customer: actionCustomer } = await requireCustomer();
    if (!actionUser || !actionCustomer?.is_admin) return;

    const cardOrderId = String(formData.get("card_order_id") || "").trim();
    const actionType = String(formData.get("action_type") || "").trim();
    const quickStatus = String(formData.get("status_action") || "").trim();
    const redirectQuery = String(formData.get("redirect_q") || "").trim();
    const redirectStatus = String(formData.get("redirect_status") || "all").trim().toLowerCase();

    if (!cardOrderId) return;

    const redirectParams = new URLSearchParams();
    if (redirectQuery) redirectParams.set("q", redirectQuery);
    if (redirectStatus && redirectStatus !== "all") redirectParams.set("status", redirectStatus);

    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const basePatch: Record<string, any> = {
      internal_notes: normalizeTextInput(formData.get("internal_notes")),
      proof_url: toInternalUrl(normalizeTextInput(formData.get("proof_url"))),
      tracking_number: normalizeTextInput(formData.get("tracking_number")),
      tracking_url: toInternalUrl(normalizeTextInput(formData.get("tracking_url"))),
      fulfillment_handler_email: normalizeTextInput(formData.get("fulfillment_handler_email")),
      fulfillment_notes: normalizeTextInput(formData.get("fulfillment_notes")),
      supplier_order_id: normalizeTextInput(formData.get("supplier_order_id")),
      approver_name: normalizeTextInput(formData.get("approver_name")),
      approver_email: normalizeTextInput(formData.get("approver_email")),
      approval_notes: normalizeTextInput(formData.get("approval_notes")),
      updated_at: nowIso,
    };

    if (actionType === "generate_proof_token") {
      const token = await generateUniqueProofToken(admin);
      const patch: Record<string, any> = {
        ...basePatch,
        proof_token: token,
      };

      if ((basePatch.proof_url || "").toString().trim()) {
        patch.approval_status = "ready";
      }

      await admin.from("card_orders").update(patch).eq("id", cardOrderId);
      revalidatePath("/admin/card-orders");
      return;
    }

    if (actionType === "send_proof_email") {
      const proofUrl = String(basePatch.proof_url || "").trim();
      const approverEmail = String(basePatch.approver_email || "").trim().toLowerCase();

      const { data: tokenRow } = await admin
        .from("card_orders")
        .select("proof_token, shopify_order_number")
        .eq("id", cardOrderId)
        .maybeSingle();

      let proofToken = String(tokenRow?.proof_token || "").trim();
      if (!proofToken) {
        proofToken = await generateUniqueProofToken(admin);
      }

      if (!approverEmail || !proofUrl || !proofToken) {
        redirectParams.set("proof_email_sent", "false");
        redirectParams.set("proof_status", "not_ready");
        redirect(`/admin/card-orders?${redirectParams.toString()}`);
      }

      const appBaseUrl = (process.env.CLUTCH_APP_BASE_URL || "https://qr.clutchprintshop.com").replace(/\/$/, "");
      const approvalUrl = `${appBaseUrl}/proof/card-order/${encodeURIComponent(proofToken)}`;
      const emailSubject = "Please review your Clutch Connect card proof";
      const emailText = buildProofApprovalEmailText({
        approverName: basePatch.approver_name,
        approvalUrl,
      });

      try {
        await sendTransactionalEmail({
          to: approverEmail,
          subject: emailSubject,
          text: emailText,
          idempotencyKey: `card-order-proof-${cardOrderId}-${nowIso.slice(0, 16)}`,
        });

        await admin
          .from("card_orders")
          .update({
            ...basePatch,
            proof_token: proofToken,
            proof_sent_at: nowIso,
            approval_status: "sent",
          })
          .eq("id", cardOrderId);

        redirectParams.set("proof_email_sent", "true");
        redirectParams.set("proof_status", "sent");
        redirectParams.set("proof_sent_at", nowIso);
        redirect(`/admin/card-orders?${redirectParams.toString()}`);
      } catch {
        redirectParams.set("proof_email_sent", "false");
        redirectParams.set("proof_status", "not_ready");
        redirect(`/admin/card-orders?${redirectParams.toString()}`);
      }
    }

    if (actionType === "send_to_handler") {
      const handlerEmail = String(basePatch.fulfillment_handler_email || "").trim();

      if (!handlerEmail) {
        redirectParams.set("sent_to_handler", "false");
        redirectParams.set("fulfillment_status", "not_sent");
        redirect(`/admin/card-orders?${redirectParams.toString()}`);
      }

      const { data: row, error: rowError } = await admin
        .from("card_orders")
        .select(
          "id, shopify_order_number, customer_name, customer_email, customer_phone, product_title, variant_title, engraving_requested, engraving_business_name, engraving_title, engraving_phone, engraving_email, custom_details, internal_notes, proof_url, supplier_order_id, fulfillment_notes, raw_order_payload"
        )
        .eq("id", cardOrderId)
        .maybeSingle();

      if (rowError || !row) {
        redirectParams.set("sent_to_handler", "false");
        redirectParams.set("fulfillment_status", "not_sent");
        redirect(`/admin/card-orders?${redirectParams.toString()}`);
      }

      const appBaseUrl = (process.env.CLUTCH_APP_BASE_URL || "https://qr.clutchprintshop.com").replace(/\/$/, "");
      const internalHandler = isInternalHandlerEmail(handlerEmail);
      const mergedOrder = {
        ...(row as any),
        internal_notes: basePatch.internal_notes,
        proof_url: basePatch.proof_url,
        fulfillment_notes: basePatch.fulfillment_notes,
        supplier_order_id: basePatch.supplier_order_id,
      } as CardOrderRow;

      const rawOrderNumber = String(row.shopify_order_number || "").trim();
      const normalizedOrderNumber = rawOrderNumber.replace(/^#+/, "") || "N/A";
      const emailSubject = `New Smart Business Card Order: #${normalizedOrderNumber}`;
      const emailText = buildHandlerEmailText(mergedOrder, {
        fulfillmentNotes: basePatch.fulfillment_notes,
        supplierOrderId: basePatch.supplier_order_id,
        proofUrl: basePatch.proof_url,
        internalNotes: basePatch.internal_notes,
        isInternalHandler: internalHandler,
        adminBaseUrl: appBaseUrl,
      });

      try {
        await sendTransactionalEmail({
          to: handlerEmail,
          subject: emailSubject,
          text: emailText,
          idempotencyKey: `card-order-handoff-${cardOrderId}-${nowIso.slice(0, 16)}`,
        });

        await admin
          .from("card_orders")
          .update({
            ...basePatch,
            fulfillment_sent_at: nowIso,
            fulfillment_status: "sent_to_handler",
          })
          .eq("id", cardOrderId);

        redirectParams.set("sent_to_handler", "true");
        redirectParams.set("fulfillment_status", "sent_to_handler");
        redirectParams.set("fulfillment_sent_at", nowIso);
        redirect(`/admin/card-orders?${redirectParams.toString()}`);
      } catch {
        redirectParams.set("sent_to_handler", "false");
        redirectParams.set("fulfillment_status", "not_sent");
        redirect(`/admin/card-orders?${redirectParams.toString()}`);
      }
    }

    if (actionType === "set_status" || quickStatus) {
      const nextStatus = quickStatus || String(formData.get("next_status") || "").trim();
      if (!ALLOWED_UPDATE_STATUSES.has(nextStatus)) return;

      const statusPatch: Record<string, any> = { ...basePatch, status: nextStatus };
      if (nextStatus === "proof_sent") statusPatch.proof_sent_at = nowIso;
      if (nextStatus === "approved") statusPatch.customer_approved_at = nowIso;
      if (nextStatus === "ordered_from_supplier") statusPatch.supplier_ordered_at = nowIso;
      if (nextStatus === "fulfilled") statusPatch.fulfilled_at = nowIso;

      await admin.from("card_orders").update(statusPatch).eq("id", cardOrderId);
      revalidatePath("/admin/card-orders");
      return;
    }

    if (actionType === "save_fields") {
      const savePatch: Record<string, any> = { ...basePatch };
      if (savePatch.proof_url && savePatch.proof_token && !APPROVAL_STATUSES.includes(String(savePatch.approval_status || "") as any)) {
        savePatch.approval_status = "ready";
      }
      await admin.from("card_orders").update(savePatch).eq("id", cardOrderId);
      revalidatePath("/admin/card-orders");
    }
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("card_orders")
    .select(
      "id, customer_id, shopify_order_number, customer_name, customer_email, customer_phone, product_title, variant_title, engraving_requested, engraving_business_name, engraving_title, engraving_phone, engraving_email, custom_details, internal_notes, proof_url, proof_token, approver_name, approver_email, proof_sent_at, proof_viewed_at, customer_approved_at, changes_requested_at, approval_notes, approval_status, supplier_ordered_at, tracking_number, tracking_url, fulfilled_at, setup_completed_at, fulfillment_handler_email, fulfillment_sent_at, fulfillment_status, fulfillment_notes, supplier_order_id, raw_order_payload, created_at, updated_at, status"
    )
    .order("created_at", { ascending: false })
    .limit(600);

  if (error) {
    return (
      <DashboardShell isAdmin>
        <main className={`container ${styles.page}`}>
          <DashboardHeader
            title="Smart Card Orders"
            subtitle="Review incoming paid Shopify orders and manage fulfillment workflow."
          />
          <section className={styles.errorState}>
            <h2>Unable to load card orders</h2>
            <p>Please refresh the page and try again.</p>
          </section>
        </main>
      </DashboardShell>
    );
  }

  const allOrders = (data || []) as CardOrderRow[];
  const uniqueCustomerIds = Array.from(new Set(allOrders.map((order) => order.customer_id).filter(Boolean) as string[]));

  const [customerRows, profileRows] = await Promise.all([
    loadCustomerSetupRows(admin, uniqueCustomerIds),
    loadProfileSetupRows(admin, uniqueCustomerIds),
  ]);

  const appBaseUrl = (process.env.CLUTCH_APP_BASE_URL || "https://qr.clutchprintshop.com").replace(/\/$/, "");

  const customerMap = new Map(customerRows.map((row) => [row.id, row]));
  const profileMap = new Map(profileRows.map((row) => [row.customer_id, row]));

  const summary = {
    setupPending: allOrders.filter((row) => row.status === "setup_pending").length,
    needsReview: allOrders.filter((row) => row.status === "needs_review").length,
    proofSent: allOrders.filter((row) => row.status === "proof_sent").length,
    fulfilled: allOrders.filter((row) => row.status === "fulfilled").length,
  };

  const filteredOrders = allOrders.filter((row) => {
    const statusMatches = activeStatus === "all" ? true : row.status === activeStatus;
    if (!statusMatches) return false;

    if (!queryText) return true;

    const needle = queryText.toLowerCase();
    return [
      row.shopify_order_number,
      row.customer_name,
      row.customer_email,
      row.engraving_business_name,
    ]
      .map(safeLower)
      .some((value) => value.includes(needle));
  });

  return (
    <DashboardShell isAdmin>
      <main className={`container ${styles.page}`}>
        <DashboardHeader
          title="Smart Card Orders"
          subtitle="Internal fulfillment workflow for engraving review, proofing, supplier ordering, tracking, delivery, and proof approval."
        />

        {diagnostics.hasHandlerAttempt ? (
          <section className={`${styles.handoffDiagnostic} ${diagnostics.sentToHandler ? styles.handoffSuccess : styles.handoffFailure}`}>
            <strong>Handler handoff diagnostics</strong>
            <p>sent_to_handler: {diagnostics.sentToHandler ? "true" : "false"}</p>
            <p>fulfillment_status: {diagnostics.fulfillmentStatus}</p>
            <p>fulfillment_sent_at: {formatDateTime(diagnostics.fulfillmentSentAt)}</p>
          </section>
        ) : null}

        {diagnostics.hasProofAttempt ? (
          <section className={`${styles.handoffDiagnostic} ${diagnostics.proofEmailSent ? styles.handoffSuccess : styles.handoffFailure}`}>
            <strong>Proof approval diagnostics</strong>
            <p>proof_email_sent: {diagnostics.proofEmailSent ? "true" : "false"}</p>
            <p>approval_status: {diagnostics.proofStatus}</p>
            <p>proof_sent_at: {formatDateTime(diagnostics.proofSentAt)}</p>
          </section>
        ) : null}

        <section className={styles.hero}>
          <h2 className={styles.heroTitle}>Smart Business Card Fulfillment Queue</h2>
          <p className={styles.heroSubtitle}>Read, triage, and fulfill orders quickly with clear status actions, warning labels, and manual handoff/proof controls.</p>
        </section>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Setup Pending</span>
            <strong className={styles.summaryValue}>{summary.setupPending}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Needs Review</span>
            <strong className={styles.summaryValue}>{summary.needsReview}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Proof Sent</span>
            <strong className={styles.summaryValue}>{summary.proofSent}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Fulfilled</span>
            <strong className={styles.summaryValue}>{summary.fulfilled}</strong>
          </article>
        </section>

        <section className={styles.controlsCard}>
          <div className={styles.filtersWrap}>
            {FILTER_OPTIONS.map((statusOption) => {
              const isActive = activeStatus === statusOption.value;
              const target = statusOption.value === "all"
                ? `/admin/card-orders${queryText ? `?q=${encodeURIComponent(queryText)}` : ""}`
                : `/admin/card-orders?status=${statusOption.value}${queryText ? `&q=${encodeURIComponent(queryText)}` : ""}`;

              return (
                <Link
                  key={statusOption.value}
                  href={target}
                  className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ""}`.trim()}
                >
                  {statusOption.label}
                </Link>
              );
            })}
          </div>

          <form className={styles.searchForm} method="get">
            {activeStatus !== "all" ? <input type="hidden" name="status" value={activeStatus} /> : null}
            <input
              className={styles.searchInput}
              type="search"
              name="q"
              defaultValue={queryText}
              placeholder="Search order #, customer, email, business name"
            />
            <button className={styles.searchButton} type="submit">Search</button>
          </form>
        </section>

        {filteredOrders.length === 0 ? (
          <section className={styles.emptyState}>
            <h2>No matching card orders.</h2>
            <p>Try a different filter or search query.</p>
          </section>
        ) : (
          <section className={styles.ordersList}>
            {filteredOrders.map((order) => {
              const { warnings, setupState } = getWarningLabels(order, customerMap, profileMap);
              const proofLink = order.proof_token ? `${appBaseUrl}/proof/card-order/${encodeURIComponent(order.proof_token)}` : "";

              return (
                <article key={order.id} className={styles.orderCard}>
                  <header className={styles.orderTop}>
                    <div>
                      <h2 className={styles.orderNumber}>{order.shopify_order_number || "No order number"}</h2>
                      <p className={styles.orderMeta}>Created {formatDate(order.created_at)} · Updated {formatDate(order.updated_at)}</p>
                    </div>
                    <span
                      className={styles.statusPill}
                      style={{ backgroundColor: statusClassName(order.status) }}
                    >
                      {toStatusLabel(order.status)}
                    </span>
                  </header>

                  {warnings.length ? (
                    <div className={styles.warningWrap}>
                      {warnings.map((warning) => (
                        <span key={warning} className={styles.warningPill}>{warning}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.infoGrid}>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Customer Name</p><p className={styles.infoValue}>{order.customer_name || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Customer Email</p><p className={styles.infoValue}>{order.customer_email || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Customer Phone</p><p className={styles.infoValue}>{order.customer_phone || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Product</p><p className={styles.infoValue}>{order.product_title || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Variant</p><p className={styles.infoValue}>{order.variant_title || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Engraving Requested</p><p className={styles.infoValue}>{order.engraving_requested ? "Yes" : "No"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Business Name</p><p className={styles.infoValue}>{order.engraving_business_name || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Title</p><p className={styles.infoValue}>{order.engraving_title || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Business Phone</p><p className={styles.infoValue}>{order.engraving_phone || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Business Email</p><p className={styles.infoValue}>{order.engraving_email || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Custom Details</p><p className={styles.infoValue}>{order.custom_details || "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Onboarding / Setup</p><p className={styles.infoValue}>{setupState.onboardingLabel} · {setupState.setupLabel}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Proof URL</p><p className={styles.infoValue}>{order.proof_url ? <a href={order.proof_url} target="_blank" rel="noreferrer">Open proof</a> : "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Tracking</p><p className={styles.infoValue}>{order.tracking_number ? (order.tracking_url ? <a href={order.tracking_url} target="_blank" rel="noreferrer">{order.tracking_number}</a> : order.tracking_number) : "-"}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Proof Sent</p><p className={styles.infoValue}>{formatDate(order.proof_sent_at)}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Proof Viewed</p><p className={styles.infoValue}>{formatDate(order.proof_viewed_at)}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Approved</p><p className={styles.infoValue}>{formatDate(order.customer_approved_at)}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Changes Requested</p><p className={styles.infoValue}>{formatDate(order.changes_requested_at)}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Approval Status</p><p className={styles.infoValue}>{toApprovalStatusLabel(order.approval_status)}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Supplier Ordered</p><p className={styles.infoValue}>{formatDate(order.supplier_ordered_at)}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Fulfilled</p><p className={styles.infoValue}>{formatDate(order.fulfilled_at)}</p></div>
                    <div className={styles.infoRow}><p className={styles.infoLabel}>Setup Completed At</p><p className={styles.infoValue}>{formatDate(order.setup_completed_at)}</p></div>
                  </div>

                  <form action={updateFulfillment} className={styles.editorForm}>
                    <input type="hidden" name="card_order_id" value={order.id} />
                    <input type="hidden" name="redirect_q" value={queryText} />
                    <input type="hidden" name="redirect_status" value={activeStatus} />

                    <div className={styles.editorGrid}>
                      <label className={styles.editorLabel}>
                        Internal Notes
                        <textarea
                          className={styles.textArea}
                          name="internal_notes"
                          defaultValue={order.internal_notes || ""}
                          placeholder="Private fulfillment notes..."
                        />
                      </label>
                      <label className={styles.editorLabel}>
                        Proof URL
                        <input
                          className={styles.editorInput}
                          name="proof_url"
                          defaultValue={order.proof_url || ""}
                          placeholder="https://"
                        />
                      </label>
                      <label className={styles.editorLabel}>
                        Tracking Number
                        <input
                          className={styles.editorInput}
                          name="tracking_number"
                          defaultValue={order.tracking_number || ""}
                          placeholder="Carrier tracking number"
                        />
                      </label>
                      <label className={styles.editorLabel}>
                        Tracking URL
                        <input
                          className={styles.editorInput}
                          name="tracking_url"
                          defaultValue={order.tracking_url || ""}
                          placeholder="https://"
                        />
                      </label>
                    </div>

                    <section className={styles.proofSection}>
                      <h3 className={styles.handoffTitle}>Proof Approval</h3>
                      <div className={styles.handoffGrid}>
                        <label className={styles.editorLabel}>
                          Approver Name
                          <input
                            className={styles.editorInput}
                            name="approver_name"
                            defaultValue={order.approver_name || ""}
                            placeholder="Approver full name"
                          />
                        </label>
                        <label className={styles.editorLabel}>
                          Approver Email
                          <input
                            className={styles.editorInput}
                            name="approver_email"
                            defaultValue={order.approver_email || ""}
                            placeholder="approver@email.com"
                          />
                        </label>
                        <label className={styles.editorLabel}>
                          Proof Token
                          <input
                            className={styles.editorInput}
                            name="proof_token_display"
                            value={order.proof_token || ""}
                            readOnly
                            placeholder="Generate token to enable review link"
                          />
                        </label>
                        <label className={styles.editorLabel}>
                          Proof Link
                          <div className={styles.proofLinkRow}>
                            <input
                              className={styles.editorInput}
                              name="proof_link_display"
                              value={proofLink}
                              readOnly
                              placeholder="Generate token to create link"
                            />
                            <CopyTextButton value={proofLink} />
                          </div>
                        </label>
                        <label className={styles.editorLabel}>
                          Approval / Change Notes
                          <textarea
                            className={styles.textArea}
                            name="approval_notes"
                            defaultValue={order.approval_notes || ""}
                            placeholder="Approval notes or requested changes"
                          />
                        </label>
                        <div className={styles.handoffMeta}>
                          <p><strong>Approval Status:</strong> {toApprovalStatusLabel(order.approval_status)}</p>
                          <p><strong>Proof Sent:</strong> {formatDateTime(order.proof_sent_at)}</p>
                          <p><strong>Proof Viewed:</strong> {formatDateTime(order.proof_viewed_at)}</p>
                          <p><strong>Approved:</strong> {formatDateTime(order.customer_approved_at)}</p>
                          <p><strong>Changes Requested:</strong> {formatDateTime(order.changes_requested_at)}</p>
                        </div>
                      </div>

                      <div className={styles.editorActions}>
                        <button type="submit" name="action_type" value="generate_proof_token" className={styles.updateButton}>
                          Generate Proof Token
                        </button>
                        <button type="submit" name="action_type" value="send_proof_email" className={styles.handoffButton}>
                          Send Proof Approval Email
                        </button>
                      </div>
                    </section>

                    <section className={styles.handoffSection}>
                      <h3 className={styles.handoffTitle}>Fulfillment Handoff</h3>
                      <div className={styles.handoffGrid}>
                        <label className={styles.editorLabel}>
                          Fulfillment Handler Email
                          <input
                            className={styles.editorInput}
                            name="fulfillment_handler_email"
                            defaultValue={order.fulfillment_handler_email || ""}
                            placeholder="handler@clutchprintshop.com"
                          />
                        </label>
                        <label className={styles.editorLabel}>
                          Supplier Order ID
                          <input
                            className={styles.editorInput}
                            name="supplier_order_id"
                            defaultValue={order.supplier_order_id || ""}
                            placeholder="Supplier order reference"
                          />
                        </label>
                        <label className={styles.editorLabel}>
                          Fulfillment Notes
                          <textarea
                            className={styles.textArea}
                            name="fulfillment_notes"
                            defaultValue={order.fulfillment_notes || ""}
                            placeholder="Production and handoff notes..."
                          />
                        </label>
                        <div className={styles.handoffMeta}>
                          <p><strong>Fulfillment Status:</strong> {toFulfillmentStatusLabel(order.fulfillment_status)}</p>
                          <p><strong>Fulfillment Sent:</strong> {formatDateTime(order.fulfillment_sent_at)}</p>
                        </div>
                      </div>
                    </section>

                    <div className={styles.editorActions}>
                      <button type="submit" name="action_type" value="save_fields" className={styles.updateButton}>
                        Save Fields
                      </button>
                      <button type="submit" name="action_type" value="send_to_handler" className={styles.handoffButton}>
                        Send to Order Handler
                      </button>
                    </div>

                    <div className={styles.quickActions}>
                      {QUICK_ACTION_STATUSES.map((statusValue) => (
                        <button
                          key={statusValue}
                          type="submit"
                          name="status_action"
                          value={statusValue}
                          className={styles.quickActionButton}
                        >
                          Mark {toStatusLabel(statusValue)}
                        </button>
                      ))}
                    </div>
                  </form>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
