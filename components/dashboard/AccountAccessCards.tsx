import Link from "next/link";
import type { AccountAccess } from "@/lib/account-access";

export function ProductAccessCard({ label, detail, href }: { label: string; detail?: string; href?: string }) {
  const body = (
    <article className="card account-product-card">
      <span className="eyebrow">Active product</span>
      <strong>{label}</strong>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
  return href ? <Link href={href} className="account-product-card-link">{body}</Link> : body;
}

export function ActiveProducts({ access }: { access: AccountAccess }) {
  if (!access.activeProductLabels.length) {
    return (
      <section className="card account-empty-state">
        <span className="eyebrow">Active products</span>
        <h2>No products connected</h2>
        <p>Your account is active. Product tools appear here after an eligible purchase is connected.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="section-heading"><div><span className="eyebrow">Commerce access</span><h2>Active Products</h2></div></div>
      <div className="account-product-grid">
        {access.activeProductLabels.map((label) => (
          <ProductAccessCard
            key={label}
            label={label}
            detail={label.startsWith("Clutch Codes") ? access.clutchCodesPrice || undefined : undefined}
            href={label.startsWith("Clutch Codes") ? "/portal/subscription" : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function CapacityMetric({ label, value }: { label: string; value: string }) {
  return <article className="card account-capacity-card"><span>{label}</span><strong>{value}</strong></article>;
}

export function IncludedCapacity({ access }: { access: AccountAccess }) {
  return <CapacityMetric label="Included Capacity" value={`${access.includedQrAllowance} codes`} />;
}

export function SubscriptionCapacity({ access }: { access: AccountAccess }) {
  return <CapacityMetric label="Subscription Capacity" value={`${access.subscriptionQrAllowance} codes`} />;
}

export function CodesUsed({ access }: { access: AccountAccess }) {
  return <CapacityMetric label="Codes Used" value={`${access.usedQrCount}`} />;
}

export function QrCapacity({ access }: { access: AccountAccess }) {
  return (
    <section>
      <div className="section-heading"><div><span className="eyebrow">Allowance</span><h2>QR Capacity</h2></div></div>
      <div className="account-capacity-grid">
        <IncludedCapacity access={access} />
        <SubscriptionCapacity access={access} />
        <CapacityMetric label="Total Capacity" value={access.effectiveQrCapacity === null ? "Unlimited" : `${access.effectiveQrCapacity} active codes`} />
        <CodesUsed access={access} />
      </div>
    </section>
  );
}

export function AccountWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <section className="card account-warning-card" aria-live="polite">
      <strong>Account notices</strong>
      <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </section>
  );
}
