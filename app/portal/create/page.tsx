import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, LayoutGrid, ShieldCheck, Sparkles } from "lucide-react";
import QRCodeCreateStudioForm from "@/components/QRCodeCreateStudioForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RetryNotice from "@/components/dashboard/RetryNotice";
import { requireCustomer } from "@/lib/auth";
import { runGuardedDashboardTask } from "@/lib/dashboard-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  getCustomerPlan,
  getEffectiveQrLimit,
  getSubscriptionLockMessage,
  isCustomerSubscriptionLocked,
} from "@/lib/plans";

export default async function CreatePortalPage() {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const [qrCodesResult, profilesResult] = await Promise.all([
    runGuardedDashboardTask({
      route: "/portal/create",
      endpoint: "supabase:qr_codes.select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string }>,
      task: () =>
        admin
          .from("qr_codes")
          .select("id")
          .eq("customer_id", customer.id),
    }),
    runGuardedDashboardTask({
      route: "/portal/create",
      endpoint: "supabase:profiles.active_select",
      customerId: customer.id,
      fallback: [] as Array<{ id: string; slug: string | null; business_name: string | null; contact_name: string | null }>,
      task: () =>
        admin
          .from("profiles")
          .select("id, slug, business_name, contact_name")
          .eq("customer_id", customer.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
    }),
  ]);

  const panelIssues: string[] = [];
  if (qrCodesResult.failed) panelIssues.push("QR usage totals are temporarily unavailable.");
  if (profilesResult.failed) panelIssues.push("Clutch Connect profile linking is temporarily unavailable.");

  const used = qrCodesResult.data?.length || 0;
  const limit = getEffectiveQrLimit(customer);
  const plan = getCustomerPlan(customer);
  const locked = isCustomerSubscriptionLocked(customer);
  const lockMessage = getSubscriptionLockMessage(customer);

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <main className="container create-studio-shell">
        <DashboardHeader
          title="Create QR"
          subtitle="Build a trackable QR code in minutes."
          actions={(
            <div className="qr-studio-status-cards">
              <article className="qr-studio-status-card">
                <span><ShieldCheck size={14} /> Account type</span>
                <strong>{plan.name}</strong>
              </article>
              <article className="qr-studio-status-card">
                <span><LayoutGrid size={14} /> QR usage</span>
                <strong>{used}/{plan.code === "admin" ? "Unlimited" : limit}</strong>
              </article>
              <article className="qr-studio-status-card">
                <span><Sparkles size={14} /> Builder</span>
                <strong>Mobile-ready</strong>
              </article>
            </div>
          )}
        />

        <section className="create-page-nav qr-studio-top-actions">
          <Link className="btn ghost" href="/portal">Back to Dashboard</Link>
          <Link className="btn secondary" href="/portal/analytics"><BarChart3 size={16} />View Analytics</Link>
        </section>

        {panelIssues.length ? (
          <RetryNotice
            title="Some QR Studio data is temporarily unavailable"
            description={panelIssues[0]}
            details={panelIssues.slice(1)}
          />
        ) : null}

        <QRCodeCreateStudioForm
          used={used}
          limit={limit}
          isLocked={locked}
          lockMessage={lockMessage}
          connectProfiles={(profilesResult.data || []) as any}
        />
      </main>
    </DashboardShell>
  );
}
