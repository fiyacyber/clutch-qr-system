import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Library, ShieldCheck, Sparkles } from "lucide-react";
import QRCodeCreateStudioForm from "@/components/QRCodeCreateStudioForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import RetryNotice from "@/components/dashboard/RetryNotice";
import { requireCustomer } from "@/lib/auth";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";
import { canPerformAccountAction } from "@/lib/account-access";

export default async function CreatePortalPage() {
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) return <DashboardShell><PortalCustomerLookupUnavailable /></DashboardShell>;
  if (!customer) return <PortalAccountNotActive />;
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const [access, qrCodesResult, profilesResult] = await Promise.all([
    loadAccountAccess(admin, customer),
    runGuardedDashboardTask({
      route: "/portal/create",
      endpoint: "supabase:qr_codes.select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string }>,
      task: () => admin.from("qr_codes").select("id").eq("customer_id", customer.id).eq("counts_toward_capacity", true),
    }),
    runGuardedDashboardTask({
      route: "/portal/create",
      endpoint: "supabase:profiles.active_select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string; slug: string | null; business_name: string | null; contact_name: string | null }>,
      task: () => admin.from("profiles").select("id,slug,business_name,contact_name").eq("customer_id", customer.id).eq("is_active", true).order("created_at", { ascending: false }),
    }),
  ]);

  if (!canPerformAccountAction(access, "create-qr")) redirect("/portal?access=clutch-code-creation-locked");
  const panelIssues: string[] = [];
  if (qrCodesResult.failed) panelIssues.push("Code allowance totals are temporarily unavailable.");
  if (profilesResult.failed) panelIssues.push("Clutch Connect destination options are temporarily unavailable.");
  const used = qrCodesResult.data?.length || 0;
  const limit = access.effectiveQrCapacity ?? Math.max(used + 1, 10000);

  return (
    <DashboardShell accountAccess={access} isAdmin={Boolean(customer.is_admin)}>
      <main className="container create-studio-shell">
        <DashboardHeader
          title="Clutch Code Studio"
          subtitle="Choose a destination, customize the design, and prepare the code for the way you plan to distribute it."
          actions={<div className="qr-studio-status-cards">
            <article className="qr-studio-status-card"><span><ShieldCheck size={14} /> Code allowance</span><strong>{access.effectiveQrCapacity === null ? `${used} / Unlimited` : `${used} / ${limit}`}</strong></article>
            <article className="qr-studio-status-card"><span><Sparkles size={14} /> Design</span><strong>Live preview</strong></article>
          </div>}
        />
        <section className="create-page-nav qr-studio-top-actions">
          <Link className="btn ghost" href="/portal/qr"><Library size={16} /> Clutch Codes</Link>
          {access.canUseCampaignAnalytics ? <Link className="btn secondary" href="/portal/analytics"><BarChart3 size={16} /> Analytics</Link> : null}
        </section>
        {panelIssues.length ? <RetryNotice title="Some Studio data is temporarily unavailable" description={panelIssues[0]} details={panelIssues.slice(1)} /> : null}
        <QRCodeCreateStudioForm used={used} limit={limit} connectProfiles={(profilesResult.data || []) as any} />
      </main>
    </DashboardShell>
  );
}
