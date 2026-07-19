import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import styles from "./page.module.css";

const PLACEHOLDERS: Record<string, { title: string; description: string }> = {
  proofs: { title: "Proofs", description: "A dedicated proof queue is not connected yet. Use Orders to review and manage the current proof workflow." },
  production: { title: "Production", description: "A dedicated production queue is not connected yet. Use Orders to manage approved work through production." },
  fulfillment: { title: "Fulfillment", description: "A dedicated fulfillment queue is not connected yet. Use Orders to review completed production and fulfillment status." },
  "clutch-codes": { title: "Clutch Codes", description: "A dedicated Clutch Codes operations view is not connected yet. Customer configuration remains available under Customers." },
  "connect-leads": { title: "Connect & Leads", description: "A dedicated Connect and leads workspace is not connected yet. Existing customer data remains available under Customers." },
  subscriptions: { title: "Subscriptions", description: "A dedicated subscription operations view is not connected yet. Existing plan management remains available under Customers." },
  activity: { title: "Activity", description: "A dedicated activity explorer is not connected yet. Recent operational events remain visible on Operations Overview and individual orders." },
};

export default async function AdminPlaceholderPage({ params }: { params: Promise<{ section: string }> }) {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer?.is_admin) redirect("/portal");
  const { section } = await params;
  const placeholder = PLACEHOLDERS[section];
  if (!placeholder) notFound();

  return (
    <DashboardShell isAdmin>
      <main className={styles.page}>
        <h1>{placeholder.title}</h1>
        <section>
          <strong>Placeholder</strong>
          <p>{placeholder.description}</p>
          <Link href="/admin/print-orders">Open Orders</Link>
        </section>
      </main>
    </DashboardShell>
  );
}
