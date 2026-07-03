import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import styles from "./page.module.css";

function LoadingCard() {
  return (
    <article className={styles.loadingCard}>
      <span className={`${styles.shimmer} ${styles.shimmerLg}`} />
      <span className={`${styles.shimmer} ${styles.shimmerMd}`} />
      <span className={`${styles.shimmer} ${styles.shimmerSm}`} />
      <span className={`${styles.shimmer} ${styles.shimmerMd}`} />
    </article>
  );
}

export default function Loading() {
  return (
    <DashboardShell isAdmin>
      <main className={`container ${styles.page}`}>
        <DashboardHeader
          title="Smart Card Orders"
          subtitle="Loading order queue..."
        />

        <section className={styles.loadingWrap} aria-live="polite" aria-busy="true">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </section>
      </main>
    </DashboardShell>
  );
}
