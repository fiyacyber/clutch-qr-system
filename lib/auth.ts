import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function getCustomerForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function requireCustomer() {
  const user = await getSessionUser();
  if (!user) return { user: null, customer: null };
  const customer = await getCustomerForUser(user.id);
  return { user, customer };
}

export async function isCurrentUserAdmin() {
  const { customer } = await requireCustomer();
  return Boolean(customer?.is_admin);
}
