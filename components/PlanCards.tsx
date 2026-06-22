import Link from "next/link";
import { PLAN_DEFINITIONS, type PlanCode } from "@/lib/plans";

type PlanCardsProps = {
  currentPlanCode?: PlanCode;
  compact?: boolean;
};

const PUBLIC_PLANS = [PLAN_DEFINITIONS.qr_pro, PLAN_DEFINITIONS.qr_pro_plus];

export default function PlanCards({ currentPlanCode, compact = false }: PlanCardsProps) {
  return (
    <div className={compact ? "plan-grid compact" : "plan-grid"}>
      {PUBLIC_PLANS.map((plan) => {
        const isCurrent = currentPlanCode === plan.code;

        return (
          <article className={`plan-card ${plan.code === "qr_pro_plus" ? "featured" : ""}`} key={plan.code}>
            <div className="plan-card-top">
              <p className="eyebrow">{isCurrent ? "Current Plan" : "Available Plan"}</p>
              <h2>{plan.name}</h2>
              <strong>{plan.price}</strong>
              <p className="muted">{plan.description}</p>
            </div>

            <ul className="plan-feature-list">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            {isCurrent ? (
              <span className="btn ghost full" aria-current="true">
                Current Plan
              </span>
            ) : (
              <Link className="btn primary full" href={plan.checkoutUrl}>
                {plan.code === "qr_pro_plus" ? "Upgrade to QR Pro+" : "Start QR Pro"}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
