"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyPublicProfileButtonProps {
  url: string;
}

export default function CopyPublicProfileButton({ url }: CopyPublicProfileButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;

    const timeout = window.setTimeout(() => setStatus("idle"), 1500);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <span className="copy-profile-link-shell">
      <button
        type="button"
        className="copy-profile-link-btn"
        aria-label="Copy public profile link"
        onClick={handleCopy}
      >
        {status === "copied" ? <Check size={17} /> : <Copy size={17} />}
      </button>
      {status === "copied" ? <span className="copy-profile-link-tip">Copied</span> : null}
      {status === "error" ? <span className="copy-profile-link-tip error">Could not copy link</span> : null}
    </span>
  );
}
