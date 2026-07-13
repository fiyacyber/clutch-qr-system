import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Clock3,
  FileUp,
  Link2,
  PackageCheck,
  QrCode,
  Sparkles,
} from "lucide-react";
import ClutchOnboardingTabs from "@/components/dashboard/ClutchOnboardingTabs";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { PortalAccountNotActive, PortalCustomerLookupUnavailable } from "@/components/dashboard/PortalAccountState";
import { requireCustomer } from "@/lib/auth";
import { groupBusinessKitItems, customerFacingCodeSource, type BusinessKitItem } from "@/lib/business-kits";
import { loadAccountAccess } from "@/lib/account-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import styles from "./portal-home.module.css";

function firstNameFromEmail(email?: string | null) {
  const token = String(email || "").split("@")[0].replace(/[._-]+/g, " ").trim().split(/\s+/)[0] || "there";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function formatStatus(value?: string | null) {
  const normalized = String(value || "").replace(/_/g, " ").trim();
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Pending";
}

function formatDate(value?: string | null) {
  if (!value) return "Recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export default async function PortalPage() {
  const { user, customer, customerLookupError } = await requireCustomer();
  if (!user) redirect("/login");
  if (customerLookupError) return <DashboardShell><PortalCustomerLookupUnavailable /></DashboardShell>;
  if (!customer) return <PortalAccountNotActive />;
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const [access, codesResult, printItemsResult, provisioningsResult, profileResult] = await Promise.all([
    loadAccountAccess(admin, customer),
    admin.from("qr_codes")
      .select("id,name,slug,destination_url,scan_count,is_active,is_system,qr_type,capacity_source,print_order_item_id,created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("print_order_items")
      .select("id,shopify_order_id,shopify_order_number,product_title,variant_title,material_type,quantity,tracking_mode,campaign_name,artwork_status,proof_status,production_status,fulfillment_status,provisioning_status,attention_reason,normalized_properties,created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("print_qr_provisionings")
      .select("print_order_item_id,source_type,access_type,qr_code_id,provisioning_status")
      .eq("customer_id", customer.id),
    admin.from("profiles")
      .select("id,slug,business_name,contact_name,is_active")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const codes = codesResult.data || [];
  const printItems = printItemsResult.data || [];
  const provisionings = provisioningsResult.data || [];
  const sourceByItem = new Map(provisionings.map((row) => [String(row.print_order_item_id), row]));
  const enrichedItems: BusinessKitItem[] = printItems.map((item) => ({
    ...item,
    source_type: sourceByItem.get(String(item.id))?.source_type || null,
    qr_code_id: sourceByItem.get(String(item.id))?.qr_code_id || null,
  }));
  const kitGroups = groupBusinessKitItems(enrichedItems);
  const campaignCodes = codes.filter((code) => code.is_system !== true || ["tracked_print", "business_kit"].includes(String(code.qr_type || "")));
  const totalScans = campaignCodes.reduce((sum, code) => sum + Number(code.scan_count || 0), 0);
  const activeCodes = campaignCodes.filter((code) => code.is_active !== false);
  const proofActions = printItems.filter((item) => item.proof_status === "sent");
  const artworkActions = printItems.filter((item) => ["not_received", "changes_requested"].includes(String(item.artwork_status || "")));
  const attentionItems = printItems.filter((item) => item.provisioning_status === "needs_attention" || Boolean(item.attention_reason));
  const activeOrders = printItems.filter((item) => !["delivered", "cancelled"].includes(String(item.fulfillment_status || "")));
  const firstName = firstNameFromEmail(user.email);
  const showOnboarding = campaignCodes.length === 0 && printItems.length === 0 && !profileResult.data?.id;
  const capacityLabel = access.effectiveQrCapacity === null ? `${access.usedQrCount} used · Unlimited` : `${access.usedQrCount} of ${access.effectiveQrCapacity} used`;

  const priorityActions = [
    ...proofActions.slice(0, 2).map((item) => ({
      key: `proof-${item.id}`,
      icon: CheckCircle2,
      title: "Proof ready for approval",
      description: `${item.product_title} · Order ${item.shopify_order_number || item.shopify_order_id}`,
      href: `/portal/print-orders/${item.id}`,
      tone: "orange",
    })),
    ...artworkActions.slice(0, 2).map((item) => ({
      key: `art-${item.id}`,
      icon: FileUp,
      title: item.artwork_status === "changes_requested" ? "Artwork changes requested" : "Artwork needed",
      description: `${item.product_title} · Upload a production-ready file`,
      href: `/portal/print-orders/${item.id}`,
      tone: "navy",
    })),
    ...attentionItems.slice(0, 1).map((item) => ({
      key: `attention-${item.id}`,
      icon: Clock3,
      title: "Order needs attention",
      description: item.attention_reason || `${item.product_title} needs review`,
      href: `/portal/print-orders/${item.id}`,
      tone: "muted",
    })),
  ];

  return (
    <DashboardShell accountAccess={access} isAdmin={Boolean(customer.is_admin)}>
      <main className={styles.page}>
        {showOnboarding ? <ClutchOnboardingTabs firstName={firstName} /> : (
          <>
            <header className={styles.header}>
              <div>
                <span className={styles.eyebrow}>Clutch dashboard</span>
                <h1>Welcome back, {firstName}.</h1>
                <p>Create, distribute, and track Clutch Codes across digital profiles, print campaigns, and Business Kits.</p>
              </div>
              {access.canCreateQr ? <Link href="/portal/create" className={styles.createButton}><QrCode size={18} /> Create Clutch Code</Link> : null}
            </header>

            {priorityActions.length ? (
              <section className={styles.section}>
                <div className={styles.sectionHeading}><div><span>Action center</span><h2>What needs your attention</h2></div><Link href="/portal/print-orders">View all orders <ArrowRight size={16} /></Link></div>
                <div className={styles.actionGrid}>
                  {priorityActions.map(({ key, icon: Icon, title, description, href, tone }) => (
                    <Link key={key} href={href} className={`${styles.actionCard} ${styles[tone]}`}>
                      <span className={styles.actionIcon}><Icon size={21} /></span>
                      <span><strong>{title}</strong><small>{description}</small></span>
                      <ArrowRight size={17} />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.section}>
              <div className={styles.sectionHeading}><div><span>Your products</span><h2>Everything in one workspace</h2></div></div>
              <div className={styles.productGrid}>
                {(access.hasClutchCodes || access.canEditOwnedQr || access.isAdmin) ? (
                  <article className={styles.productCard}>
                    <div className={styles.productIcon}><QrCode size={23} /></div>
                    <span className={styles.productLabel}>Clutch Codes</span>
                    <h3>{activeCodes.length} active code{activeCodes.length === 1 ? "" : "s"}</h3>
                    <p>{capacityLabel}</p>
                    <div className={styles.productMetric}><strong>{totalScans}</strong><span>Total scans</span></div>
                    <Link href="/portal/qr">Open Clutch Codes <ArrowRight size={16} /></Link>
                  </article>
                ) : (
                  <article className={styles.productCard}>
                    <div className={styles.productIcon}><QrCode size={23} /></div>
                    <span className={styles.productLabel}>Clutch Codes</span>
                    <h3>Make campaigns measurable</h3>
                    <p>Create editable codes with scan analytics.</p>
                    <a href="https://clutchprintshop.com/pages/clutch-codes">Explore plans <ArrowRight size={16} /></a>
                  </article>
                )}

                {kitGroups.length ? (
                  <article className={`${styles.productCard} ${styles.featuredCard}`}>
                    <div className={styles.productIcon}><Boxes size={23} /></div>
                    <span className={styles.productLabel}>Business Kits</span>
                    <h3>{kitGroups[0].name}</h3>
                    <p>{kitGroups[0].readyCount} of {kitGroups[0].itemCount} items ready</p>
                    <div className={styles.progressTrack}><span style={{ width: `${kitGroups[0].progressPercent}%` }} /></div>
                    <Link href="/portal/business-kits">Continue Kit setup <ArrowRight size={16} /></Link>
                  </article>
                ) : (
                  <article className={`${styles.productCard} ${styles.featuredCard}`}>
                    <div className={styles.productIcon}><Boxes size={23} /></div>
                    <span className={styles.productLabel}>Business Kits</span>
                    <h3>Coordinated print with tracking</h3>
                    <p>Launch multiple print pieces and compare which material performs best.</p>
                    <a href="https://clutchprintshop.com/pages/business-kits">Shop Business Kits <ArrowRight size={16} /></a>
                  </article>
                )}

                {access.hasPrintOrders ? (
                  <article className={styles.productCard}>
                    <div className={styles.productIcon}><PackageCheck size={23} /></div>
                    <span className={styles.productLabel}>Print Orders</span>
                    <h3>{activeOrders.length} active order item{activeOrders.length === 1 ? "" : "s"}</h3>
                    <p>{proofActions.length} proof action{proofActions.length === 1 ? "" : "s"} waiting</p>
                    <Link href="/portal/print-orders">Track production <ArrowRight size={16} /></Link>
                  </article>
                ) : null}

                {(access.hasConnectBasic || access.hasConnectPlus) ? (
                  <article className={styles.productCard}>
                    <div className={styles.productIcon}><Link2 size={23} /></div>
                    <span className={styles.productLabel}>Clutch Connect</span>
                    <h3>{profileResult.data?.is_active ? "Profile live" : "Finish your profile"}</h3>
                    <p>{profileResult.data?.business_name || profileResult.data?.contact_name || "Your digital profile and smart-card destination"}</p>
                    <Link href={profileResult.data?.id ? "/portal/connect" : "/portal/connect/setup"}>{profileResult.data?.id ? "Manage profile" : "Begin guided setup"} <ArrowRight size={16} /></Link>
                  </article>
                ) : null}
              </div>
            </section>

            <section className={styles.splitGrid}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeading}><div><span>Recent Clutch Codes</span><h2>Campaign activity</h2></div><Link href="/portal/qr">View all</Link></div>
                {campaignCodes.slice(0, 4).map((code) => {
                  const provisioning = code.print_order_item_id ? sourceByItem.get(String(code.print_order_item_id)) : null;
                  return (
                    <Link href={`/portal/qr/${code.id}/edit`} key={code.id} className={styles.codeRow}>
                      <span className={styles.miniCode}><QrCode size={20} /></span>
                      <span className={styles.codeInfo}><strong>{code.name}</strong><small>{customerFacingCodeSource({ ...code, source_type: provisioning?.source_type })} · {code.destination_url}</small></span>
                      <span className={styles.codeScans}><strong>{Number(code.scan_count || 0)}</strong><small>scans</small></span>
                    </Link>
                  );
                })}
                {!campaignCodes.length ? <div className={styles.emptyMini}><Sparkles size={22} /><p>No codes yet. Create a Clutch Code to begin tracking engagement.</p><Link href="/portal/create">Create Clutch Code</Link></div> : null}
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeading}><div><span>Performance</span><h2>At a glance</h2></div><Link href="/portal/analytics">Analytics</Link></div>
                <div className={styles.metricGrid}>
                  <article><BarChart3 size={19} /><strong>{totalScans}</strong><span>Total scans</span></article>
                  <article><QrCode size={19} /><strong>{activeCodes.length}</strong><span>Active codes</span></article>
                  <article><PackageCheck size={19} /><strong>{printItems.length}</strong><span>Print items</span></article>
                  <article><Boxes size={19} /><strong>{kitGroups.length}</strong><span>Business Kits</span></article>
                </div>
                <p className={styles.helperText}>Use Analytics to compare standalone codes, tracked print, Business Kits, Smart Card taps, and profile activity.</p>
              </div>
            </section>

            <section className={styles.quickStart}>
              <div><span className={styles.eyebrow}>Quick start</span><h2>Create → Customize → Distribute → Track</h2><p>The same workflow works for standalone Clutch Codes and every eligible Business Kit print item.</p></div>
              <Link href="/portal/create">Open Clutch Code Studio <ArrowRight size={17} /></Link>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
