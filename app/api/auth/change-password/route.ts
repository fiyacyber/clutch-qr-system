import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { GUIDED_SETUP_ENTRY_PATH, GUIDED_SETUP_ROUTE } from "@/lib/onboarding-routing";
import { sanitizeNextPath } from "@/lib/safe-redirect";

function isMissingColumnError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

function isCheckConstraintError(error: any) {
  return String(error?.code || "") === "23514";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") || "").trim();
  const requestedNext = String(form.get("next") || "").trim();
  const safeNext = sanitizeNextPath(requestedNext, "/portal");

  const complexityChecks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  if (password.length < 12) {
    return NextResponse.json({ error: "Password must be at least 12 characters." }, { status: 400 });
  }

  if (complexityChecks.some((check) => !check)) {
    return NextResponse.json(
      {
        error: "Password must include uppercase, lowercase, a number, and a symbol.",
      },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in again to change your password." }, { status: 401 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    console.error("Password update failed", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error: customerError } = await admin
    .from("customers")
    .update({ must_change_password: false })
    .eq("auth_user_id", user.id);

  if (customerError) {
    console.error("Failed to update must_change_password", customerError.message);
    return NextResponse.json({ error: "Unable to complete password change." }, { status: 500 });
  }

  const guidedStatusAttempt = await admin
    .from("customers")
    .update({ onboarding_status: "guided_setup" })
    .eq("auth_user_id", user.id);

  if (guidedStatusAttempt.error && !isCheckConstraintError(guidedStatusAttempt.error) && !isMissingColumnError(guidedStatusAttempt.error)) {
    console.warn("Unable to update onboarding_status to guided_setup", guidedStatusAttempt.error.message);
  }

  if (guidedStatusAttempt.error && isCheckConstraintError(guidedStatusAttempt.error)) {
    await admin
      .from("customers")
      .update({ onboarding_status: "active" })
      .eq("auth_user_id", user.id);
  }

  const guidedRequiredAttempt = await admin
    .from("customers")
    .update({ guided_setup_required: true })
    .eq("auth_user_id", user.id);

  if (guidedRequiredAttempt.error && !isMissingColumnError(guidedRequiredAttempt.error)) {
    console.warn("Unable to update guided_setup_required", guidedRequiredAttempt.error.message);
  }

  const redirectTo =
    safeNext === GUIDED_SETUP_ENTRY_PATH ||
    safeNext.startsWith(`${GUIDED_SETUP_ENTRY_PATH}?`) ||
    safeNext === GUIDED_SETUP_ROUTE ||
    safeNext.startsWith(`${GUIDED_SETUP_ROUTE}?`)
      ? GUIDED_SETUP_ENTRY_PATH
      : safeNext;

  if (process.env.NODE_ENV !== "production") {
    console.info("change-password onboarding router", {
      auth_user_id_exists: Boolean(user.id),
      final_redirect_path: redirectTo,
    });
  }

  const response = NextResponse.json({ ok: true, redirectTo });
  response.cookies.delete("clutch-must-change-password");
  return response;
}
