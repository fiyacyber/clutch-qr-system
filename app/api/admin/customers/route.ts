import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { PLAN_DEFINITIONS, normalizePlanCode } from "@/lib/plans";
import {
  generateTemporaryPassword,
  sendCustomerOnboardingEmail,
} from "@/lib/shopify-provisioning";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("customers").select("is_admin").eq("auth_user_id", user.id).single();
  return Boolean(data?.is_admin);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.redirect(new URL("/portal", req.url));
  const form = await req.formData();
  const admin = createSupabaseAdminClient();
  const id = String(form.get("id") || "");
  const email = String(form.get("email") || "").trim().toLowerCase();
  const company_name = String(form.get("company_name") || "").trim();
  const customer_group_id = String(form.get("customer_group_id") || "") || null;
  const onboarding_status = String(form.get("onboarding_status") || "not_started");
  const onboarding_note = String(form.get("onboarding_note") || "").trim() || null;
  const internal_notes = String(form.get("internal_notes") || "").trim() || null;
  const subscription_status = String(form.get("subscription_status") || "active");
  const mark_invited = form.get("mark_invited") === "on";
  const submittedPlanCode = normalizePlanCode(String(form.get("plan_code") || "qr_pro"));
  const is_admin = form.get("is_admin") === "on" || submittedPlanCode === "admin";
  const must_change_password = form.get("must_change_password") === "on";
  const reset_temp_password = form.get("reset_temp_password") === "on";
  const plan_code = is_admin ? "admin" : submittedPlanCode;
  const submittedLimit = Number(form.get("qr_limit") || 0);
  const qr_limit = submittedLimit || PLAN_DEFINITIONS[plan_code].qrLimit;

  if (id) {
    const updatePayload: Record<string, string | number | boolean | null> = {
      company_name,
      customer_group_id,
      onboarding_status: mark_invited ? "invited" : onboarding_status,
      onboarding_note,
      internal_notes,
      last_admin_reviewed_at: new Date().toISOString(),
      qr_limit,
      is_admin,
      plan: plan_code,
      plan_code,
      subscription_status,
      plan_status: subscription_status === "cancelled" ? "canceled" : subscription_status,
      must_change_password,
      updated_at: new Date().toISOString(),
    };

    if (mark_invited || reset_temp_password) {
      updatePayload.onboarding_email_sent_at = new Date().toISOString();
    }

    const { data: currentCustomer } = await admin
      .from("customers")
      .select("auth_user_id, email")
      .eq("id", id)
      .maybeSingle();

    if (reset_temp_password && currentCustomer?.auth_user_id && currentCustomer.email) {
      const temporaryPassword = generateTemporaryPassword();
      const { error: passwordError } = await admin.auth.admin.updateUserById(
        currentCustomer.auth_user_id,
        { password: temporaryPassword }
      );

      if (!passwordError) {
        updatePayload.must_change_password = true;
        updatePayload.temp_password_created_at = new Date().toISOString();
        await sendCustomerOnboardingEmail({
          email: currentCustomer.email,
          temporaryPassword,
          planCode: plan_code === "admin" ? "qr_pro_plus" : plan_code,
          idempotencyKey: `admin-temp-password-${currentCustomer.email}-${Date.now()}`,
        });
      } else {
        console.error("Admin temp password reset failed", passwordError.message);
      }
    }

    await admin
      .from("customers")
      .update(updatePayload)
      .eq("id", id);
  } else if (email) {
    const temporaryPassword = generateTemporaryPassword();
    const { data: authUser } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });
    await admin
      .from("customers")
      .insert({
        auth_user_id: authUser.user?.id,
        email,
        company_name,
        customer_group_id,
        onboarding_status,
        onboarding_note,
        internal_notes,
        qr_limit,
        plan: plan_code,
        plan_code,
        subscription_status,
        plan_status: subscription_status === "cancelled" ? "canceled" : subscription_status,
        must_change_password: true,
        temp_password_created_at: new Date().toISOString(),
        onboarding_email_sent_at: new Date().toISOString(),
      });

    await sendCustomerOnboardingEmail({
      email,
      temporaryPassword,
      planCode: plan_code === "admin" ? "qr_pro_plus" : plan_code,
      idempotencyKey: `admin-customer-${email}`,
    });
  }
  return NextResponse.redirect(new URL("/admin", req.url));
}
