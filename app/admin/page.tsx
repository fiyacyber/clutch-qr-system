import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import AdminDashboardTabs from "@/components/admin/AdminDashboardTabs";
import PlanLimitFields from "@/components/admin/PlanLimitFields";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCustomerPlan, normalizePlanCode, PLAN_DEFINITIONS } from "@/lib/plans";
import { resolveAccountAccess } from "@/lib/account-access";
import { hasActiveProfileEvidence, hasSmartCardSystemQrEvidence } from "@/lib/account-evidence";

interface AdminPageProps {
  searchParams?: Promise<{ q?: string }>;
}

const ONBOARDING_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "needs_help", label: "Needs Help" },
  { value: "blocked", label: "Blocked" },
];

const SUBSCRIPTION_STATUSES = [
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "unpaid", label: "Unpaid" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDate(value?: string | null) {
  if (!value) return "Not sent";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const searchQuery = String(params?.q || "").trim().toLowerCase();
  const { user, customer } = await requireCustomer();

  if (!user) redirect("/login");
  if (customer?.must_change_password) redirect("/change-password");
  if (!customer?.is_admin) redirect("/portal");

  const admin = createSupabaseAdminClient();

  const [
    { data: customers },
    { data: groups },
    { data: qrCodes },
    { data: recentScans },
    { data: connectProfiles },
    { data: connectLeads },
    { count: connectLeadCount },
    { data: connectEvents },
    { count: connectEventCount },
  ] =
    await Promise.all([
      admin
        .from("customers")
        .select("*, customer_groups(id, name), qr_codes(id, name, slug, scan_count, is_active, is_system, qr_type, updated_at), card_orders(id), profiles(id, is_active)")
        .order("created_at", { ascending: false }),
      admin.from("customer_groups").select("*").order("name", { ascending: true }),
      admin
        .from("qr_codes")
        .select("id, name, slug, scan_count, is_active, updated_at, customer_id, customers(email, company_name)")
        .order("scan_count", { ascending: false })
        .limit(10),
      admin
        .from("qr_scans")
        .select("id, slug, referrer, user_agent, created_at, qr_code_id")
        .order("created_at", { ascending: false })
        .limit(250),
      admin
        .from("profiles")
        .select("id, slug, business_name, contact_name, is_active, created_at, customer_id, customers(company_name, email)")
        .order("created_at", { ascending: false }),
      admin
        .from("profile_leads")
        .select("id, profile_id, name, email, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("profile_leads")
        .select("id", { count: "exact", head: true }),
      admin
        .from("profile_click_events")
        .select("id, profile_id, event_type")
        .order("created_at", { ascending: false }),
      admin
        .from("profile_click_events")
        .select("id", { count: "exact", head: true }),
    ]);

  const allCustomerRows = customers || [];
  const customerRows = searchQuery
    ? allCustomerRows.filter((c: any) =>
        [c.email, c.company_name, c.shopify_customer_id, c.shopify_order_id]
          .filter(Boolean)
          .some((value: string) => value.toLowerCase().includes(searchQuery))
      )
    : allCustomerRows;
  const groupRows = groups || [];
  const qrRows = qrCodes || [];
  const scanRows = recentScans || [];
  const connectProfileRows = connectProfiles || [];
  const connectLeadRows = connectLeads || [];
  const connectEventRows = connectEvents || [];
  const filteredConnectProfileRows = searchQuery
    ? connectProfileRows.filter((profile: any) =>
        [
          profile.business_name,
          profile.contact_name,
          profile.slug,
          profile.customers?.company_name,
          profile.customers?.email,
          profile.is_active ? "live" : "draft",
        ]
          .filter(Boolean)
          .some((value: string) => value.toLowerCase().includes(searchQuery))
      )
    : connectProfileRows;
  const filteredConnectLeadRows = searchQuery
    ? connectLeadRows.filter((lead: any) =>
        [lead.name, lead.email, lead.phone, lead.message, lead.profile_id]
          .filter(Boolean)
          .some((value: string) => value.toLowerCase().includes(searchQuery))
      )
    : connectLeadRows;
  const filteredConnectEventRows = searchQuery
    ? connectEventRows.filter((event: any) =>
        [event.event_type, event.profile_id]
          .filter(Boolean)
          .some((value: string) => value.toLowerCase().includes(searchQuery))
      )
    : connectEventRows;
  const totalQrCodes = customerRows.reduce(
    (sum: number, c: any) => sum + (c.qr_codes?.length || 0),
    0
  );
  const totalScans = customerRows.reduce(
    (sum: number, c: any) =>
      sum + (c.qr_codes || []).reduce((qrSum: number, qr: any) => qrSum + (qr.scan_count || 0), 0),
    0
  );
  const activeQrCodes = customerRows.reduce(
    (sum: number, c: any) =>
      sum + (c.qr_codes || []).filter((qr: any) => qr.is_active !== false).length,
    0
  );
  const planCounts = countBy(customerRows, (c: any) => getCustomerPlan(c).code);
  const onboardingCounts = countBy(
    customerRows,
    (c: any) => c.onboarding_status || "not_started"
  );
  const needsAttention = customerRows.filter((c: any) =>
    ["not_started", "needs_help", "blocked"].includes(c.onboarding_status || "not_started")
  );
  const groupCounts = countBy(
    customerRows,
    (c: any) => c.customer_groups?.name || "Ungrouped"
  );

  const connectLeadCountByProfile = countBy(
    filteredConnectLeadRows,
    (lead: any) => lead.profile_id
  );
  const connectEventCountByProfile = countBy(
    filteredConnectEventRows,
    (event: any) => event.profile_id
  );
  const connectViewsByProfile = countBy(
    filteredConnectEventRows.filter((event: any) => event.event_type === "profile_view"),
    (event: any) => event.profile_id
  );
  const connectLinkClicksByProfile = countBy(
    filteredConnectEventRows.filter((event: any) => event.event_type === "link_click"),
    (event: any) => event.profile_id
  );

  return (
    <DashboardShell isAdmin>
      <main className="container admin-page">
        <DashboardHeader
          title="Admin Dashboard"
          subtitle="Manage customers, plans, QR limits, onboarding, groups, and account analytics from one private dashboard."
          actions={(
            <div className="dashboard-badges">
              <span>{customerRows.length} customers</span>
              <span>{activeQrCodes} active QRs</span>
              <span>{totalScans} scans</span>
            </div>
          )}
        />

        <AdminDashboardTabs activeTab="overview" />

        <section className="dashboard-grid">
          <div className="metric-card">
            <span className="metric-label">Customers</span>
            <strong className="metric-value">{customerRows.length}</strong>
            <p>Total portal accounts.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">QR Codes</span>
            <strong className="metric-value">{totalQrCodes}</strong>
            <p>{activeQrCodes} active across all customers.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total Scans</span>
            <strong className="metric-value">{totalScans}</strong>
            <p>Lifetime scan volume.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Needs Attention</span>
            <strong className="metric-value">{needsAttention.length}</strong>
            <p>Onboarding or support follow-up.</p>
          </div>
        </section>

        <section className="admin-dashboard-grid">
          <article className="card">
            <p className="eyebrow">Customer Management</p>
            <h2>Create Customer</h2>
            <form className="form" action="/api/admin/customers" method="post">
              <div className="admin-form-grid">
                <input className="input" name="email" type="email" placeholder="customer@email.com" required />
                <input className="input" name="company_name" placeholder="Company name" />
                <select className="input" name="customer_group_id" defaultValue="">
                  <option value="">No group</option>
                  {groupRows.map((group: any) => (
                    <option value={group.id} key={group.id}>{group.name}</option>
                  ))}
                </select>
                <PlanLimitFields initialPlanCode="connect_basic" initialQrLimit={PLAN_DEFINITIONS.connect_basic.qrLimit} />
                <select className="input" name="subscription_status" defaultValue="active">
                  {SUBSCRIPTION_STATUSES.map((status) => (
                    <option value={status.value} key={status.value}>{status.label}</option>
                  ))}
                </select>
                <select className="input" name="onboarding_status" defaultValue="not_started">
                  {ONBOARDING_STATUSES.map((status) => (
                    <option value={status.value} key={status.value}>{status.label}</option>
                  ))}
                </select>
                <input className="input" name="onboarding_note" placeholder="Onboarding note" />
              </div>
              <button className="btn primary">Create Customer</button>
            </form>
          </article>

          <article className="card">
            <p className="eyebrow">Groups</p>
            <h2>Customer Groups</h2>
            <form className="form" action="/api/admin/groups" method="post">
              <input className="input" name="name" placeholder="Group name, e.g. Contractors" required />
              <input className="input" name="description" placeholder="Description" />
              <button className="btn primary">Create Group</button>
            </form>
            <ul className="admin-summary-list">
              {Object.entries(groupCounts).map(([name, count]) => (
                <li key={name}><span>{name}</span><strong>{count}</strong></li>
              ))}
            </ul>
          </article>
        </section>

        <section className="section-heading">
          <p className="eyebrow">Analytics Overview</p>
          <h2>Account Performance</h2>
        </section>

        <section className="analytics-grid">
          <article className="analytics-card">
            <p className="eyebrow">Plans</p>
            <ul className="analytics-list">
              {(["connect_basic", "connect_plus", "qr_pro", "agency", "admin"] as const).map((planCode) => (
                <li key={planCode}>
                  <span>{PLAN_DEFINITIONS[planCode].name}</span>
                  <strong>{planCounts[planCode] || 0}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="analytics-card">
            <p className="eyebrow">Onboarding</p>
            <ul className="analytics-list">
              {ONBOARDING_STATUSES.map((status) => (
                <li key={status.value}>
                  <span>{status.label}</span>
                  <strong>{onboardingCounts[status.value] || 0}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="analytics-card wide">
            <p className="eyebrow">Top QR Codes</p>
            <ul className="analytics-list">
              {(qrRows.length ? qrRows : [{ id: "empty", name: "No QR codes yet", scan_count: 0 }]).map((qr: any) => (
                <li key={qr.id}>
                  <span>{qr.name} <small>{qr.customers?.company_name || qr.customers?.email || ""}</small></span>
                  <strong>{qr.scan_count || 0}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="analytics-card">
            <p className="eyebrow">Recent Scan Feed</p>
            <ul className="analytics-list">
              {(scanRows.slice(0, 5).length ? scanRows.slice(0, 5) : [{ id: "empty", slug: "No scans yet", created_at: null }]).map((scan: any) => (
                <li key={scan.id}>
                  <span>{scan.slug || "Unknown QR"}</span>
                  <strong>{formatDate(scan.created_at)}</strong>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="section-heading">
          <p className="eyebrow">Clutch Connect</p>
          <h2>Profiles, Leads, and Events</h2>
        </section>

        <section className="analytics-grid">
          <article className="analytics-card">
            <p className="eyebrow">Profiles</p>
            <h3>{filteredConnectProfileRows.length}</h3>
            <p className="muted">Total smart business card profiles.</p>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Leads</p>
            <h3>{searchQuery ? filteredConnectLeadRows.length : (connectLeadCount || 0)}</h3>
            <p className="muted">Lead submissions across all profiles.</p>
          </article>
          <article className="analytics-card">
            <p className="eyebrow">Events</p>
            <h3>{searchQuery ? filteredConnectEventRows.length : (connectEventCount || 0)}</h3>
            <p className="muted">Profile views, clicks, and downloads.</p>
          </article>
        </section>

        <section className="card admin-table-card">
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Leads</th>
                <th>Events</th>
                <th>Views</th>
                <th>Link Clicks</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(filteredConnectProfileRows.length ? filteredConnectProfileRows : [{ id: "none", slug: searchQuery ? "No matching profiles" : "No profiles yet" }]).map((profile: any) => (
                <tr key={profile.id}>
                  <td>
                    <strong>{profile.business_name || profile.contact_name || profile.slug}</strong>
                    <span className="admin-cell-subtext">/{profile.slug}</span>
                  </td>
                  <td>
                    <strong>{profile.customers?.company_name || "-"}</strong>
                    <span className="admin-cell-subtext">{profile.customers?.email || "-"}</span>
                  </td>
                  <td>{profile.is_active ? "Live" : "Draft"}</td>
                  <td>{connectLeadCountByProfile[profile.id] || 0}</td>
                  <td>{connectEventCountByProfile[profile.id] || 0}</td>
                  <td>{connectViewsByProfile[profile.id] || 0}</td>
                  <td>{connectLinkClicksByProfile[profile.id] || 0}</td>
                  <td>{formatDate(profile.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card admin-table-card">
          <p className="eyebrow">Recent Connect Leads</p>
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Profile ID</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {(filteredConnectLeadRows.length ? filteredConnectLeadRows : [{ id: "none", name: searchQuery ? "No matching leads" : "No leads yet" }]).map((lead: any) => (
                <tr key={lead.id}>
                  <td>{lead.name || "-"}</td>
                  <td>{lead.email || "-"}</td>
                  <td>{lead.phone || "-"}</td>
                  <td>{lead.profile_id || "-"}</td>
                  <td>{formatDate(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="section-heading">
          <p className="eyebrow">Customers</p>
          <h2>Manage Accounts</h2>
        </section>

        <section className="card">
          <form className="admin-search-form" action="/admin" method="get">
            <input
              className="input"
              name="q"
              defaultValue={params?.q || ""}
              placeholder="Search customers, Connect profiles, leads, Shopify IDs, or order IDs"
            />
            <button className="btn secondary">Search</button>
            {searchQuery ? <a className="btn ghost" href="/admin">Clear</a> : null}
          </form>
        </section>

        <section className="card admin-table-card">
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Limits</th>
                <th>Shopify</th>
                <th>Onboarding</th>
                <th>Group</th>
                <th>Manage</th>
                <th>Add QR</th>
              </tr>
            </thead>
            <tbody>
              {customerRows.map((c: any) => {
                const plan = getCustomerPlan(c);
                const normalizedStoredPlanCode = normalizePlanCode(String(c.plan_code || c.plan || "connect_basic"));
                const qrCount = c.qr_codes?.length || 0;
                const scanCount = (c.qr_codes || []).reduce(
                  (sum: number, qr: any) => sum + (qr.scan_count || 0),
                  0
                );
                const access = resolveAccountAccess({
                  customer: c,
                  usedQrCount: qrCount,
                  hasSmartCardOrder: (c.card_orders || []).length > 0,
                  hasSmartCardSystemQr: hasSmartCardSystemQrEvidence(c.qr_codes),
                  hasActiveProfile: hasActiveProfileEvidence(c.profiles),
                });

                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.company_name || c.email}</strong>
                      <span className="admin-cell-subtext">{c.email}</span>
                    </td>
                    <td>
                      <span className="status-pill">{plan.name}</span>
                      <span className="admin-cell-subtext">Active Products: {access.activeProductLabels.join(", ") || "None"}</span>
                      <span className="admin-cell-subtext">Base Profile Plan: {plan.name}</span>
                      <span className="admin-cell-subtext">Smart Card: {access.hasSmartCard ? "Yes" : "No"}</span>
                      <span className="admin-cell-subtext">Connect+: {access.hasConnectPlus ? "Active" : "No"}</span>
                      <span className="admin-cell-subtext">Clutch Codes: {access.clutchCodesPlanName || "None"} ({String(c.clutch_codes_subscription_status || "inactive")})</span>
                      <span className="admin-cell-subtext">Normalized: {plan.code}</span>
                      <span className="admin-cell-subtext">Stored: {String(c.plan_code || c.plan || "-")}</span>
                      <span className="admin-cell-subtext">Subscription: {c.subscription_status || c.plan_status || "active"}</span>
                    </td>
                    <td>
                      <strong>{qrCount}/{access.effectiveQrCapacity === null ? "Unlimited" : access.effectiveQrCapacity}</strong>
                      <span className="admin-cell-subtext">Included: {access.includedQrAllowance}</span>
                      <span className="admin-cell-subtext">Subscription: {access.subscriptionQrAllowance}</span>
                      <span className="admin-cell-subtext">Tracked Print: {access.hasTrackedPrint ? "Yes" : "No"}</span>
                      <span className="admin-cell-subtext">Business Kit: {access.hasBusinessKit ? "Yes" : "No"}</span>
                      {access.warnings.map((warning) => <span className="admin-cell-subtext" key={warning}>Warning: {warning}</span>)}
                      <span className="admin-cell-subtext">Plan baseline: {normalizedStoredPlanCode === "admin" ? "Unlimited" : PLAN_DEFINITIONS[normalizedStoredPlanCode].qrLimit}</span>
                      <span className="admin-cell-subtext">{scanCount} scans</span>
                    </td>
                    <td>
                      <strong>{c.shopify_customer_id || "No customer ID"}</strong>
                      <span className="admin-cell-subtext">Order: {c.shopify_order_id || "none"}</span>
                      <span className="admin-cell-subtext">Sub: {c.shopify_subscription_id || "none"}</span>
                    </td>
                    <td>
                      <strong>{ONBOARDING_STATUSES.find((s) => s.value === (c.onboarding_status || "not_started"))?.label}</strong>
                      <span className="admin-cell-subtext">Invite: {formatDate(c.onboarding_email_sent_at)}</span>
                    </td>
                    <td>{c.customer_groups?.name || "Ungrouped"}</td>
                    <td>
                      <form className="admin-account-form" action="/api/admin/customers" method="post">
                        <input type="hidden" name="id" value={c.id} />
                        <input className="input" name="company_name" defaultValue={c.company_name || ""} placeholder="Company" />
                        <PlanLimitFields initialPlanCode={plan.code} initialQrLimit={c.qr_limit || PLAN_DEFINITIONS[plan.code].qrLimit} />
                        <select className="input" name="subscription_status" defaultValue={c.subscription_status || c.plan_status || "active"}>
                          {SUBSCRIPTION_STATUSES.map((status) => (
                            <option value={status.value} key={status.value}>{status.label}</option>
                          ))}
                        </select>
                        <select className="input" name="customer_group_id" defaultValue={c.customer_group_id || ""}>
                          <option value="">No group</option>
                          {groupRows.map((group: any) => (
                            <option value={group.id} key={group.id}>{group.name}</option>
                          ))}
                        </select>
                        <select className="input" name="onboarding_status" defaultValue={c.onboarding_status || "not_started"}>
                          {ONBOARDING_STATUSES.map((status) => (
                            <option value={status.value} key={status.value}>{status.label}</option>
                          ))}
                        </select>
                        <input className="input" name="onboarding_note" defaultValue={c.onboarding_note || ""} placeholder="Onboarding note" />
                        <input className="input" name="internal_notes" defaultValue={c.internal_notes || ""} placeholder="Internal notes" />
                        <label className="checkbox-row"><input type="checkbox" name="mark_invited" /> Mark invited</label>
                        <label className="checkbox-row"><input type="checkbox" name="must_change_password" defaultChecked={c.must_change_password} /> Force password change</label>
                        <label className="checkbox-row"><input type="checkbox" name="reset_temp_password" /> Reset/send temp password</label>
                        <label className="checkbox-row"><input type="checkbox" name="is_admin" defaultChecked={c.is_admin} /> Admin</label>
                        <button className="btn secondary">Save</button>
                      </form>
                    </td>
                    <td>
                      <form action="/api/admin/qr" method="post" className="admin-qr-form">
                        <input type="hidden" name="customer_id" value={c.id} />
                        <input className="input" name="name" placeholder="QR name" />
                        <input className="input" name="destination_url" placeholder="Destination URL" />
                        <button className="btn primary">Add QR</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </DashboardShell>
  );
}
