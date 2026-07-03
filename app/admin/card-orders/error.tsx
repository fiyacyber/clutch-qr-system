"use client";

import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import styles from "./page.module.css";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <DashboardShell isAdmin>
      <main className={`container ${styles.page}`}>
        <DashboardHeader
          title="Smart Card Orders"
          subtitle="There was a problem loading this admin view."
        />

        <section className={styles.errorState}>
          <h2>Unable to load card orders</h2>
          <p>Please try again. If the problem continues, check server logs.</p>
          <button className={styles.updateButton} type="button" onClick={() => reset()}>
            Try again
          </button>
        </section>
      </main>
    </DashboardShell>
  );
}
