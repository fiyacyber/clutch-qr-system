import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ExternalLink, FileText, PackageCheck } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { loadAccountAccess } from "@/lib/account-access-server";

type PrintOrderItem = Record<string, any>;

function humanize(value?: string | null, fallback = "In progress") {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function itemStatus(item: PrintOrderItem) {
  if (item.attention_reason) return { label: "Needs attention", detail: item.attention_reason, tone: "attention" };
  if (item.fulfillment_status === "delivered") return { label: "Delivered", detail: "This item has been delivered.", tone: "complete" };
  if (item.fulfillment_status === "fulfilled") return { label: "Shipped", detail: "Your order is on the way.", tone: "active" };
  if (item.production_status === "complete") return { label: "Production complete", detail: "Preparing this item for shipment.", tone: "active" };
  if (item.production_status === "in_production") return { label: "In production", detail: "Your approved artwork is being printed.", tone: "active" };
  if (item.proof_status === "approved") return { label: "Proof approved", detail: "Ready for production.", tone: "active" };
  if (item.proof_status === "sent") return { label: "Proof ready", detail: "Review and approve your artwork proof.", tone: "attention" };
  if (item.artwork_status === "received") return { label: "Artwork received", detail: "Clutch is reviewing your artwork.", tone: "active" };
  if (item.qr_setup_status === "submitted") return { label: "QR submitted", detail: "Upload your artwork when you are ready.", tone: "active" };
  if (item.tracking_mode !== "none") return { label: "Action needed", detail: "Set up the Clutch Code for this item.", tone: "attention" };
  return { label: "Order received", detail: "We are preparing the next step.", tone: "active" };
}

function progressSteps(item: PrintOrderItem) {
  const qrComplete = item.tracking_mode === "none" || item.qr_setup_status === "submitted";
  const artworkComplete = ["received", "approved"].includes(String(item.artwork_status));
  const proofComplete = item.proof_status === "approved";
  const productionComplete = item.production_status === "complete";
  const deliveryComplete = item.fulfillment_status === "delivered";
  return [
    { label: "QR", complete: qrComplete },
    { label: "Artwork", complete: artworkComplete },
    { label: "Proof", complete: proofComplete },
    { label: "Print", complete: productionComplete },
    { label: "Delivered", complete: deliveryComplete },
  ];
}

function primaryAction(item: PrintOrderItem) {
  if (item.proof_status === "sent") return "Review proof";
  if (item.tracking_mode !== "none" && item.qr_setup_status !== "submitted") return "Set up QR";
  return "View details";
}

export default async function CustomerPrintOrdersPage() {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer) redirect("/portal");
  const admin = createSupabaseAdminClient();
  const access = await loadAccountAccess(admin, customer);
  if (!access.canViewPrintOrders) redirect("/portal?access=print-orders-locked");
  const { data, error } = await admin.from("print_order_items")
    .select("*, print_qr_provisionings(qr_code_id, qr_codes(slug))")
    .eq("customer_id", customer.id).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load your print orders.");

  const groups = new Map<string, PrintOrderItem[]>();
  for (const item of data || []) {
    const key = String(item.shopify_order_number || item.shopify_order_id || item.id);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return <DashboardShell accountAccess={access}>
    <main className="container customer-orders-page">
      <DashboardHeader title="Orders" subtitle="Follow each item from QR setup and artwork through proof, printing, and delivery." />
      {!data?.length ? (
        <section className="customer-orders-empty">
          <PackageCheck size={24} aria-hidden="true" />
          <div><h2>No orders yet</h2><p>Your paid print and NFC orders will appear here automatically.</p></div>
        </section>
      ) : null}

      <div className="customer-order-list">
        {[...groups.entries()].map(([orderNumber, items]) => {
          const first = items[0];
          return <section className="customer-order-card" key={orderNumber}>
            <header className="customer-order-head">
              <div>
                <span>Order #{orderNumber}</span>
                <h2>{first.product_title || "Clutch Print Order"}</h2>
                <p>{items.length} {items.length === 1 ? "item" : "items"}{first.created_at ? ` · Placed ${formatDate(first.created_at)}` : ""}</p>
              </div>
              <Link href={`/portal/print-orders/${first.id}`}>Open order <ArrowRight size={16} aria-hidden="true" /></Link>
            </header>

            <div className="customer-order-items">
              {items.map((item) => {
                const qr = item.print_qr_provisionings?.[0]?.qr_codes;
                const status = itemStatus(item);
                const steps = progressSteps(item);
                return <article className="customer-order-item" key={item.id}>
                  <div className="customer-order-item-main">
                    <span className="customer-order-item-icon"><FileText size={19} aria-hidden="true" /></span>
                    <div className="customer-order-item-copy">
                      <div className="customer-order-item-title">
                        <div><h3>{humanize(item.material_type, "Print item")}</h3><span>Qty {item.quantity || 1}</span></div>
                        <strong className={`customer-order-status is-${status.tone}`}>{status.label}</strong>
                      </div>
                      <p>{status.detail}</p>
                      {item.campaign_name ? <p className="customer-order-campaign">Campaign: {item.campaign_name}</p> : null}
                      {item.destination_url ? (
                        <a className="customer-order-destination" href={item.destination_url} rel="noreferrer" target="_blank">
                          {item.destination_url}<ExternalLink size={13} aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <ol className="customer-order-progress" aria-label={`Progress for ${humanize(item.material_type, "print item")}`}>
                    {steps.map((step) => <li className={step.complete ? "is-complete" : ""} key={step.label}><i aria-hidden="true" /><span>{step.label}</span></li>)}
                  </ol>

                  <div className="customer-order-item-actions">
                    {item.tracking_url ? <a href={item.tracking_url} rel="noreferrer" target="_blank">Track shipment</a> : null}
                    <Link className="customer-order-primary-action" href={`/portal/print-orders/${item.id}${qr?.slug && item.qr_setup_status !== "submitted" ? "#qr-setup" : ""}`}>
                      {primaryAction(item)} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
    </main>
  </DashboardShell>;
}
