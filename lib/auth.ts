import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

function asErrorInfo(error: unknown) {
  const value = (error || {}) as {
    code?: string | number;
    message?: string;
    details?: string;
    hint?: string;
  };

  return {
    code: value.code ?? null,
    message: value.message ?? String(error || "Unknown error"),
    details: value.details ?? null,
    hint: value.hint ?? null,
  };
}

function isDynamicServerUsageError(error: unknown) {
  return String((error as { message?: string } | null)?.message || "").includes("Dynamic server usage");
}

export async function getSessionUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const info = asErrorInfo(error);
      console.error("[portal-auth-error]", {
        route: "auth:getSessionUser",
        endpoint: "supabase:auth.getUser",
        code: info.code,
        message: info.message,
        details: info.details,
        hint: info.hint,
      });
      return null;
    }

    return data.user ?? null;
  } catch (error) {
    if (isDynamicServerUsageError(error)) {
      throw error;
    }

    const info = asErrorInfo(error);
    console.error("[portal-auth-error]", {
      route: "auth:getSessionUser",
      endpoint: "supabase:auth.getUser",
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
    });
    return null;
  }
}

export async function getCustomerForUser(userId: string) {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("customers")
      .select("*")
      .eq("auth_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      const info = asErrorInfo(error);
      console.error("[portal-customer-lookup-error]", {
        route: "auth:getCustomerForUser",
        endpoint: "supabase:customers.maybeSingle",
        code: info.code,
        message: info.message,
        details: info.details,
        hint: info.hint,
      });

      return {
        customer: null,
        customerLookupError: "customer_lookup_unavailable",
      };
    }

    return {
      customer: data,
      customerLookupError: undefined,
    };
  } catch (error) {
    const info = asErrorInfo(error);
    console.error("[portal-customer-lookup-error]", {
      route: "auth:getCustomerForUser",
      endpoint: "supabase:customers.maybeSingle",
      code: info.code,
      message: info.message,
      details: info.details,
      hint: info.hint,
    });

    return {
      customer: null,
      customerLookupError: "customer_lookup_unavailable",
    };
  }
}

export async function requireCustomer() {
  const user = await getSessionUser();
  if (!user) return { user: null, customer: null };

  const { customer, customerLookupError } = await getCustomerForUser(user.id);
  return { user, customer, customerLookupError };
}

export async function isCurrentUserAdmin() {
  const { customer } = await requireCustomer();
  return Boolean(customer?.is_admin);
}

export async function isAdmin() {
  return isCurrentUserAdmin();
}
