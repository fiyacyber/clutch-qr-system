import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { AccountWarnings, QrCapacity } from "@/components/dashboard/AccountAccessCards";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import { requireCustomer } from "@/lib/auth";
import { loadAccountAccess } from "@/lib/account-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function SubscriptionPage() {
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) return <DashboardShell><PortalCustomerLookupUnavailable /></DashboardShell>;
  if (!customer) return <PortalAccountNotActive />;
  if (customer.must_change_password) redirect("/change-password");

  const access = await loadAccountAccess(createSupabaseAdminClient(), customer);

  return (
    <DashboardShell accountAccess={access} isAdmin={access.isAdmin}>
      <main className="container portal-overview-shell">
        <DashboardHeader
          pretitle="Clutch Codes"
          title="Subscription"
          subtitle="Review your active-code capacity and Shopify-managed billing status."
        />
        <AccountWarnings warnings={access.warnings} />

        {access.hasClutchCodes ? (
          <>
            <section className="card subscription-summary-card">
              <span className="eyebrow">Active subscription</span>
              <h2>{access.clutchCodesPlanName}</h2>
              <strong>{access.clutchCodesPrice}</strong>
              <dl className="subscription-summary-list">
                <div><dt>Status</dt><dd>{String(customer.clutch_codes_subscription_status || "inactive")}</dd></div>
                <div><dt>Included allowance</dt><dd>{access.includedQrAllowance}</dd></div>
                <div><dt>Subscription allowance</dt><dd>{access.subscriptionQrAllowance}</dd></div>
                <div><dt>Effective capacity</dt><dd>{access.effectiveQrCapacity ?? "Unlimited"}</dd></div>
                <div><dt>Used codes</dt><dd>{access.usedQrCount}</dd></div>
                <div><dt>Remaining codes</dt><dd>{access.remainingQrCapacity ?? "Unlimited"}</dd></div>
              </dl>
            </section>
            <QrCapacity access={access} />
          </>
        ) : (
          <section className="card account-empty-state">
            <h2>No active Clutch Codes subscription</h2>
            <p>No Shopify-managed Clutch Codes subscription is currently connected to this account.</p>
          </section>
        )}

        <section className="card">
          <h2>Subscription changes</h2>
          <p>Billing is managed through Shopify. Contact <a href="mailto:info@clutchprintshop.com">info@clutchprintshop.com</a> for subscription changes.</p>
        </section>
      </main>
    </DashboardShell>
  );
}
