import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const VALID_STATUSES = new Set(["new", "contacted", "qualified", "converted", "closed", "archived"]);
const TIMESTAMP_BY_STATUS: Record<string, string> = {
  contacted: "contacted_at",
  qualified: "qualified_at",
  converted: "converted_at",
  closed: "closed_at",
};

function normalizeStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(status) ? status : null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const { user, customer } = await requireCustomer();
  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await context.params;
  if (!/^\d+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid lead." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedAction = String(body.action || "").trim().toLowerCase();
  const requestedStatus = body.status === undefined ? null : normalizeStatus(body.status);
  const hasNotes = Object.prototype.hasOwnProperty.call(body, "crm_notes");

  if (body.status !== undefined && !requestedStatus) {
    return NextResponse.json({ error: "Invalid lead status." }, { status: 400 });
  }

  if (requestedAction && !["archive", "unarchive"].includes(requestedAction)) {
    return NextResponse.json({ error: "Invalid lead action." }, { status: 400 });
  }

  if (!requestedAction && !requestedStatus && !hasNotes) {
    return NextResponse.json({ error: "No lead updates provided." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: lead, error: leadError } = await admin
    .from("profile_leads")
    .select("id, profile_id, status, archived_at, contacted_at, qualified_at, converted_at, closed_at")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    console.error("CONNECT LEAD LOOKUP ERROR", { message: leadError.message, leadId });
    return NextResponse.json({ error: "Lead could not be loaded." }, { status: 500 });
  }

  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (!customer.is_admin) {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, customer_id")
      .eq("id", lead.profile_id)
      .maybeSingle();

    if (profileError) {
      console.error("CONNECT LEAD PROFILE LOOKUP ERROR", {
        message: profileError.message,
        leadId,
        profileId: lead.profile_id,
      });
      return NextResponse.json({ error: "Lead ownership could not be verified." }, { status: 500 });
    }

    if (!profile || profile.customer_id !== customer.id) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, string | null> = {
    updated_at: now,
  };

  if (hasNotes) {
    updatePayload.crm_notes = String(body.crm_notes || "").slice(0, 5000);
  }

  let nextStatus = requestedStatus;
  if (requestedAction === "archive") {
    nextStatus = "archived";
    updatePayload.archived_at = lead.archived_at || now;
  } else if (requestedAction === "unarchive") {
    nextStatus = requestedStatus && requestedStatus !== "archived"
      ? requestedStatus
      : lead.status === "archived"
        ? "new"
        : null;
    updatePayload.archived_at = null;
  }

  if (nextStatus) {
    updatePayload.status = nextStatus;

    const timestampColumn = TIMESTAMP_BY_STATUS[nextStatus];
    if (timestampColumn && lead.status !== nextStatus && !lead[timestampColumn as keyof typeof lead]) {
      updatePayload[timestampColumn] = now;
    }

    if (nextStatus === "archived") {
      updatePayload.archived_at = lead.archived_at || now;
    }
  }

  const { data: updatedLead, error: updateError } = await admin
    .from("profile_leads")
    .update(updatePayload)
    .eq("id", leadId)
    .select("id, name, email, phone, message, ip_hash, created_at, status, archived_at, contacted_at, qualified_at, converted_at, closed_at, crm_notes, updated_at")
    .maybeSingle();

  if (updateError) {
    console.error("CONNECT LEAD UPDATE ERROR", {
      message: updateError.message,
      leadId,
      customerId: customer.id,
    });
    return NextResponse.json({ error: "Failed to update lead." }, { status: 500 });
  }

  if (!updatedLead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead: updatedLead });
}
