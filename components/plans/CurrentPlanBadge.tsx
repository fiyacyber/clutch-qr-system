import styles from "@/components/plans/PlanCards.module.css";

type CurrentPlanBadgeProps = {
  planCode: string;
  planName: string;
  priceLabel: string;
  description: string;
  usageLabel?: string;
  subscriptionStatus?: string;
  locked?: boolean;
  trialStatus?: string;
};

function normalizeCode(planCode: string) {
  const normalized = String(planCode || "").toLowerCase();
  if (normalized === "free_qr") return "connect_basic";
  if (normalized === "qr_pro_plus") return "agency";
  return normalized;
}

export default function CurrentPlanBadge({
  planCode,
  planName,
  priceLabel,
  description,
  usageLabel,
  subscriptionStatus,
  locked,
  trialStatus,
}: CurrentPlanBadgeProps) {
  const canonicalCode = normalizeCode(planCode);

  return (
    <section className={styles.planBadge}>
      <div className={styles.planBadgeTop}>
        <span className={`${styles.planPill} ${styles[canonicalCode] || ""}`}>
          {planName}
        </span>
        <strong className={styles.planTitle}>{priceLabel}</strong>
      </div>

      <p className={styles.planSubtitle}>{description}</p>

      <div className={styles.planMetaRow}>
        {usageLabel ? <span className={styles.planMeta}>{usageLabel}</span> : null}
        {subscriptionStatus ? <span className={styles.planMeta}>Status: {subscriptionStatus}</span> : null}
        {trialStatus && trialStatus !== "none" ? <span className={styles.planMeta}>Trial: {trialStatus}</span> : null}
        {locked ? <span className={styles.planMeta}>Locked</span> : null}
      </div>
    </section>
  );
}
