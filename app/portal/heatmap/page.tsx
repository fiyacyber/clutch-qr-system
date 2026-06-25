import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import LocationHeatmap from "@/components/dashboard/LocationHeatmap";
import { requireCustomer } from "@/lib/auth";
import { parseCoordinate } from "@/lib/analytics";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function HeatmapCommandCenterPage() {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const { data: qrCodes } = await admin
    .from("qr_codes")
    .select("id, name, is_active")
    .eq("customer_id", customer.id);

  const codes = qrCodes || [];
  const qrIds = codes.map((code) => code.id);
  const { data: scanRows } = qrIds.length
    ? await admin
        .from("qr_scans")
        .select("id, qr_code_id, created_at, city, region, country, latitude, longitude, location_source")
        .in("qr_code_id", qrIds)
        .order("created_at", { ascending: false })
        .limit(5000)
    : { data: [] };

  const scans = scanRows || [];
  const hasCoordinateData = scans.some((scan: any) => parseCoordinate(scan.latitude) !== null && parseCoordinate(scan.longitude) !== null);

  return (
    <DashboardShell isAdmin={Boolean(customer.is_admin)}>
      <main className="container portal-heatmap-shell">
        <DashboardHeader
          title="Heatmap Command Center"
          subtitle="See where your print campaigns, smart cards, and QR codes are generating engagement."
          actions={<Link className="btn secondary" href="/portal/analytics?tab=geography">Geography Insights</Link>}
        />

        <LocationHeatmap
          scans={scans as any}
          hasCoordinateData={hasCoordinateData}
        />
      </main>
    </DashboardShell>
  );
}