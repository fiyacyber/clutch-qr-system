import Link from "next/link";
import styles from "@/components/plans/PlanCards.module.css";

type LockedFeatureCardProps = {
  title: string;
  description: string;
  requiredPlan: string;
  requiredPlanPrice: string;
  ctaLabel: string;
  ctaHref: string;
  featureList: string[];
  variant: "connect_plus" | "qr_pro" | "agency";
};

export default function LockedFeatureCard({
  title,
  description,
  requiredPlan,
  requiredPlanPrice,
  ctaLabel,
  ctaHref,
  featureList,
  variant,
}: LockedFeatureCardProps) {
  return (
    <section className={`${styles.lockedCard} ${styles[variant]}`}>
      <p className={styles.lockedEyebrow}>Upgrade Required</p>
      <h3 className={styles.lockedTitle}>{title}</h3>
      <p className={styles.lockedDescription}>{description}</p>
      <ul className={styles.lockedFeatures}>
        {featureList.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <div className={styles.lockedActionRow}>
        <span className={styles.lockedPlan}>{requiredPlan} · {requiredPlanPrice}</span>
        <Link className={styles.lockedCta} href={ctaHref}>{ctaLabel}</Link>
      </div>
    </section>
  );
}
