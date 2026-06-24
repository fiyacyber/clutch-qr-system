import { redirect } from "next/navigation";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { getCustomerPlan, getEffectiveQrLimit } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function PortalSettingsPage() {
  const { user, customer } = await requireCustomer();

  if (!user || !customer) redirect("/login");

  const admin = createSupabaseAdminClient();
  const plan = getCustomerPlan(customer as any);

  const [{ data: qrRows }, { data: latestQrRows }] = await Promise.all([
    admin
      .from("qr_codes")
      .select("id")
      .eq("customer_id", customer.id),
    admin
      .from("qr_codes")
      .select("name, foreground_color, background_color")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Account holder";
  const latestQr = latestQrRows?.[0] || null;

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <AnalyticsDashboard
        activeTab="settings"
        accountName={fullName}
        accountEmail={user.email || null}
        companyName={customer.company_name || "—"}
        accountType={customer.is_admin ? "Admin" : plan.code === "qr_pro_plus" ? "Agency" : "QR Pro"}
        memberSince={formatDate(customer.created_at)}
        lastLogin={formatDate(user.last_sign_in_at)}
        authenticationStatus={customer.must_change_password ? "Password reset required" : "Password login active"}
        planName={plan.name}
        planCode={plan.code}
        managePlanHref={plan.checkoutUrl}
        qrUsageUsed={qrRows?.length || 0}
        qrUsageLimit={plan.code === "admin" ? null : getEffectiveQrLimit(customer as any)}
        latestQrName={latestQr?.name || null}
        latestQrForeground={latestQr?.foreground_color || "#384862"}
        latestQrBackground={latestQr?.background_color || "#ffffff"}
        totalScans={0}
        connectViews={0}
        linkClicks={0}
        uniqueVisitors={0}
        leadsCaptured={0}
        activeQrCodes={0}
        qrRows={[]}
        connectRows={[]}
        scansOverTime={[]}
        countryData={[]}
        mapPoints={[]}
        cityRows={[]}
        deviceRows={[]}
        browserRows={[]}
        osRows={[]}
        heatmap={[]}
        geographyRows={[]}
      />
    </DashboardShell>
  );
}