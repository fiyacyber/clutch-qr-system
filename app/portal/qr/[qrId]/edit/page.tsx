import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import QRCodeEditForm from "@/components/QRCodeEditForm";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";

export default async function EditQrCodePage({
  params,
}: {
  params: Promise<{ qrId: string }>;
}) {
  const { user, customer, customerLookupError } = await requireCustomer();

  if (!user) redirect("/login");
  if (customerLookupError) {
    return (
      <DashboardShell>
        <PortalCustomerLookupUnavailable />
      </DashboardShell>
    );
  }
  if (!customer) return <PortalAccountNotActive />;
  if (customer.must_change_password) redirect("/change-password");

  const { qrId } = await params;
  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  if (!access.canEditOwnedQr) redirect("/portal?access=qr-edit-locked");
  const hasDynamicQr = access.canEditOwnedQr;
  const hasHeatmap = access.canUseCampaignAnalytics;

  const [{ data: code, error: codeError }, { data: profiles, error: profilesError }] = await Promise.all([
    admin
      .from("qr_codes")
      .select("id, name, destination_url, slug, qr_type, profile_id, scan_count, updated_at, foreground_color, background_color, dot_style, corner_style, logo_url, customer_can_edit_destination")
      .eq("id", qrId)
      .eq("customer_id", customer.id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, slug, business_name, contact_name")
      .eq("customer_id", customer.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (codeError) {
    console.error("[portal-data-error]", {
      route: "/portal/qr/[qrId]/edit",
      endpoint: "supabase:qr_codes.maybeSingle",
      code: codeError.code ?? null,
      message: codeError.message ?? "Unknown error",
      details: codeError.details ?? null,
      hint: codeError.hint ?? null,
    });
  }

  if (profilesError) {
    console.error("[portal-data-error]", {
      route: "/portal/qr/[qrId]/edit",
      endpoint: "supabase:profiles.select",
      code: profilesError.code ?? null,
      message: profilesError.message ?? "Unknown error",
      details: profilesError.details ?? null,
      hint: profilesError.hint ?? null,
    });
  }

  if (!code) {
    redirect("/portal/qr");
  }
  if (code.customer_can_edit_destination !== true) redirect("/portal/qr");

  return (
    <DashboardShell
      accountAccess={access}
      isAdmin={Boolean(customer.is_admin)}
      navLocks={{
        qr: !hasDynamicQr,
        analytics: !hasHeatmap,
        heatmap: !hasHeatmap,
      }}
    >
      <main className="container create-studio-shell">
        <DashboardHeader
          title={`Edit QR: ${code.name}`}
          subtitle="Update destination, style, and logo settings for this stored QR code."
          actions={(
            <div className="qr-studio-top-actions">
              <Link className="btn ghost" href="/portal/qr">Back to Stored QR Codes</Link>
              <Link className="btn secondary" href={`/portal/analytics/${code.id}`}><BarChart3 size={16} />View Analytics</Link>
            </div>
          )}
        />

        <QRCodeEditForm code={code as any} connectProfiles={(profiles || []) as any} />
      </main>
    </DashboardShell>
  );
}
