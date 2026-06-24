import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, LayoutGrid, ShieldCheck, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import QRCodeCreateStudioForm from "@/components/QRCodeCreateStudioForm";
import { requireCustomer } from "@/lib/auth";
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
  const [{ data: qrCodes }, { data: profiles }] = await Promise.all([
    admin
      .from("qr_codes")
      .select("id")
      .eq("customer_id", customer.id),
    admin
      .from("profiles")
      .select("id, slug, business_name, contact_name")
      .eq("customer_id", customer.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const used = qrCodes?.length || 0;
  const limit = getEffectiveQrLimit(customer);
  const plan = getCustomerPlan(customer);
  const locked = isCustomerSubscriptionLocked(customer);
  const lockMessage = getSubscriptionLockMessage(customer);

  return (
    <div className="page-shell">
      <Header isAdmin={Boolean(customer.is_admin)} />

      <main className="container create-studio-shell">
        <section className="portal-dashboard-header create-page-header qr-studio-hero">
          <div className="qr-studio-hero-copy">
            <p className="eyebrow">Create QR</p>
            <h1>QR Design Studio</h1>
            <p>
              Create branded, trackable QR codes for print campaigns, business cards, yard signs, and more.
            </p>
          </div>

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
        </section>

        <section className="create-page-nav qr-studio-top-actions">
          <Link className="btn ghost" href="/portal">Back to Dashboard</Link>
          <Link className="btn secondary" href="/portal/analytics"><BarChart3 size={16} />View Analytics</Link>
        </section>

        <QRCodeCreateStudioForm
          used={used}
          limit={limit}
          isLocked={locked}
          lockMessage={lockMessage}
          connectProfiles={(profiles || []) as any}
        />
      </main>
    </div>
  );
}
