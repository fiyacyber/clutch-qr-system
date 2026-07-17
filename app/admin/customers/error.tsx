"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardShell from "@/components/dashboard/DashboardShell";
import styles from "./page.module.css";

export default function AdminCustomersError({ reset }: { reset: () => void }) {
  return (
    <DashboardShell isAdmin>
      <main className={`${styles.page} container admin-page`}>
        <DashboardHeader
          title="Customers"
          subtitle="Required customer-management data could not be loaded."
        />

        <section className={styles.errorState} role="alert">
          <h2>Unable to load customer management</h2>
          <p>
            No customer totals are shown because one or more required data
            sources failed. Try again, then review server logs and Supabase
            connectivity if the problem continues.
          </p>
          <button className={styles.retryButton} type="button" onClick={reset}>
            Try again
          </button>
        </section>
      </main>
    </DashboardShell>
  );
}
