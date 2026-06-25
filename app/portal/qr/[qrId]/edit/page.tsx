import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import QRCodeEditForm from "@/components/QRCodeEditForm";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function EditQrCodePage({
  params,
}: {
  params: Promise<{ qrId: string }>;
}) {
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const { qrId } = await params;
  const admin = createSupabaseAdminClient();

  const [{ data: code }, { data: profiles }] = await Promise.all([
    admin
      .from("qr_codes")
      .select("id, name, destination_url, slug, qr_type, profile_id, scan_count, updated_at, foreground_color, background_color, dot_style, corner_style, logo_url")
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

  if (!code) {
    redirect("/portal/qr");
  }

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
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
