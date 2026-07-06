import Link from "next/link";

export function PortalAccountNotActive() {
  return (
    <main className="container">
      <div className="card" role="alert" aria-live="polite">
        <h1>Account not active yet</h1>
        <p className="muted">
          Use the same email from your Clutch Connect checkout. If you just purchased,
          wait a minute and refresh.
        </p>
      </div>
    </main>
  );
}

export function PortalCustomerLookupUnavailable() {
  return (
    <main className="container">
      <div className="card" role="alert" aria-live="assertive">
        <h1>We could not load your account details right now.</h1>
        <p className="muted">
          Some account services may be temporarily unavailable. Please retry in a moment.
        </p>
        <div className="portal-overview-header-actions">
          <Link className="btn primary" href="/portal">
            Retry
          </Link>
        </div>
      </div>
    </main>
  );
}
