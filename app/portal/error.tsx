"use client";

import { useEffect } from "react";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal-route-error]", { digest: error?.digest || null });
  }, [error]);

  return (
    <DashboardShell>
      <main className="container">
        <div className="card" role="alert" aria-live="assertive">
          <h1>We could not load this dashboard right now.</h1>
          <p className="muted">
            Some data services may be temporarily unavailable. Please try again.
          </p>
          <div className="portal-overview-header-actions">
            <button className="btn primary" type="button" onClick={reset}>
              Retry
            </button>
            <Link className="btn secondary" href="/portal">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
