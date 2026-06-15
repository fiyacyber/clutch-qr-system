import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { requireCustomer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function AdminPage() {
  const { user, customer } = await requireCustomer();
  if (!user) redirect("/login");
  if (!customer?.is_admin) redirect("/portal");
  const admin = createSupabaseAdminClient();
  const { data: customers } = await admin.from("customers").select("*, qr_codes(id, scan_count)").order("created_at", { ascending: false });
  return (
    <div className="page-shell"><Header isAdmin />
      <main className="container">
        <section className="hero"><div><h1>Admin Dashboard</h1><p>Create customers, adjust QR limits, and manage Clutch QR accounts.</p></div><img src="/clutch-logo.png" alt="Clutch" /></section>
        <section className="card" style={{marginTop: 22}}>
          <h2>Create Customer</h2>
          <form className="form" action="/api/admin/customers" method="post">
            <div className="grid"><input className="input" name="email" type="email" placeholder="customer@email.com" required /><input className="input" name="company_name" placeholder="Company name" /><input className="input" name="qr_limit" type="number" min="1" defaultValue="10" /></div>
            <button className="btn primary">Create Customer</button>
          </form>
        </section>
        <section className="card" style={{marginTop: 22}}>
          <h2>Customers</h2>
          <table className="table"><thead><tr><th>Email</th><th>Company</th><th>QRs</th><th>QR Limit</th><th>Admin</th><th>Update</th></tr></thead><tbody>
            {(customers || []).map((c: any) => <tr key={c.id}><td>{c.email}</td><td>{c.company_name || "—"}</td><td>{c.qr_codes?.length || 0}</td><td>
              <form className="actions" action="/api/admin/customers" method="post"><input type="hidden" name="id" value={c.id} /><input className="input" style={{width:90}} name="qr_limit" type="number" defaultValue={c.qr_limit} min="1" /><input className="input" name="company_name" defaultValue={c.company_name || ""} /><label><input type="checkbox" name="is_admin" defaultChecked={c.is_admin} /> Admin</label><button className="btn secondary">Save</button></form>
            </td><td>{c.is_admin ? "Yes" : "No"}</td><td><form action="/api/admin/qr" method="post" className="actions"><input type="hidden" name="customer_id" value={c.id} /><input className="input" name="name" placeholder="New QR name" /><input className="input" name="destination_url" placeholder="Destination URL" /><button className="btn primary">Add QR</button></form></td></tr>)}
          </tbody></table>
        </section>
      </main>
    </div>
  );
}
