import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import styles from "./page.module.css";

function LoadingBlock() {
  return (
    <section className={styles.section} aria-hidden="true">
      <div className={styles.emptyLine}>Loading diagnostics...</div>
      <div className={styles.emptyLine}>Loading recent records...</div>
    </section>
  );
}

export default function Loading() {
  return (
    <DashboardShell isAdmin>
      <main className={`container ${styles.page}`}>
        <DashboardHeader
          title="Smart Card Onboarding QA"
          subtitle="Loading read-only launch diagnostics..."
        />

        <LoadingBlock />
        <LoadingBlock />
      </main>
    </DashboardShell>
  );
}