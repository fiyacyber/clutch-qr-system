"use client";

import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import styles from "./page.module.css";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <DashboardShell isAdmin>
      <main className={`container ${styles.page}`}>
        <DashboardHeader
          title="Smart Card Onboarding QA"
          subtitle="There was a problem loading this admin QA view."
        />

        <section className={styles.errorState}>
          <h2>Unable to load QA diagnostics</h2>
          <p>Please try again. If this continues, review server logs and Supabase connectivity.</p>
          <button className={styles.searchButton} type="button" onClick={() => reset()}>
            Try again
          </button>
        </section>
      </main>
    </DashboardShell>
  );
}