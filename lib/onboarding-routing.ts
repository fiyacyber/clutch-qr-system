import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { sanitizeNextPath } from "@/lib/safe-redirect";

export const GUIDED_SETUP_ENTRY_PATH = "/setup/guided";
export const GUIDED_SETUP_ROUTE = "/portal/connect/setup";

function isMissingColumnError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

async function getGuidedSetupRequired(customerId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("guided_setup_required")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }

  if (!data) return null;
  return (data as any).guided_setup_required as boolean | null;
}

async function getProfileSetupCompleted(customerId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("setup_completed")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }

  if (!data) return null;
  return (data as any).setup_completed as boolean | null;
}

export async function resolvePostLoginRedirect({
  authUserId,
  requestedNext,
}: {
  authUserId: string;
  requestedNext?: string | null;
}) {
  const safeNext = sanitizeNextPath(requestedNext, "/portal");
  const admin = createSupabaseAdminClient();

  const { data: customer, error } = await admin
    .from("customers")
    .select("id, is_admin, onboarding_status, must_change_password")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  let finalRedirect = "/portal";
  let guidedSetupRequired: boolean | null = null;
  let setupCompleted: boolean | null = null;

  if (!customer?.id) {
    finalRedirect = safeNext || "/portal";
  } else if (customer.is_admin) {
    finalRedirect = safeNext || "/portal";
  } else {
    guidedSetupRequired = await getGuidedSetupRequired(customer.id);
    setupCompleted = await getProfileSetupCompleted(customer.id);

    if (customer.onboarding_status === "password_required" || customer.must_change_password) {
      finalRedirect = `/account/change-password?next=${encodeURIComponent(GUIDED_SETUP_ENTRY_PATH)}`;
    } else if (guidedSetupRequired === true || setupCompleted === false) {
      finalRedirect = GUIDED_SETUP_ROUTE;
    } else {
      const requestedGuided =
        safeNext === GUIDED_SETUP_ENTRY_PATH || safeNext.startsWith(`${GUIDED_SETUP_ENTRY_PATH}?`) ||
        safeNext === GUIDED_SETUP_ROUTE || safeNext.startsWith(`${GUIDED_SETUP_ROUTE}?`);

      if (requestedGuided) {
        finalRedirect = "/portal/connect";
      } else {
        finalRedirect = safeNext || "/portal";
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("post-login onboarding router", {
      auth_user_id_exists: Boolean(authUserId),
      customer_onboarding_status: customer?.onboarding_status || null,
      guided_setup_required: guidedSetupRequired,
      setup_completed: setupCompleted,
      final_redirect_path: finalRedirect,
    });
  }

  return finalRedirect;
}
