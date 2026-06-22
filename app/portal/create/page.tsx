import Link from "next/link";
import { redirect } from "next/navigation";
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

      <main className="container">
        <section className="portal-dashboard-header create-page-header">
          <div>
            <p className="eyebrow">Create QR</p>
            <h1>QR Design Studio</h1>
            <p>
              Build a trackable QR for flyers, standard business cards, yard signs, and other print campaigns.
            </p>
          </div>

          <div className="dashboard-badges">
            <span>{plan.name}</span>
            <span>{used}/{plan.code === "admin" ? "Unlimited" : limit} QR codes</span>
            <span>Mobile-ready builder</span>
          </div>
        </section>

        <section className="create-page-nav">
          <Link className="btn ghost" href="/portal">Back to Dashboard</Link>
          <Link className="btn secondary" href="/portal/analytics">View Analytics</Link>
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
