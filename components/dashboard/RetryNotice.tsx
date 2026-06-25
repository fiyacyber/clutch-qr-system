"use client";

import { useRouter } from "next/navigation";

interface RetryNoticeProps {
  title: string;
  description: string;
  details?: string[];
}

export default function RetryNotice({ title, description, details = [] }: RetryNoticeProps) {
  const router = useRouter();
  const visibleDetails = details.slice(0, 3);

  return (
    <div className="alert" role="status" aria-live="polite">
      <strong>{title}</strong>
      <p className="muted">{description}</p>
      {visibleDetails.length ? (
        <p className="muted">
          {visibleDetails.join(" ")}
        </p>
      ) : null}
      <div className="portal-overview-header-actions">
        <button className="btn secondary" type="button" onClick={() => router.refresh()}>
          Retry
        </button>
      </div>
    </div>
  );
}
