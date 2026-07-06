"use client";

import { useState } from "react";

type CopyValueButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

export default function CopyValueButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "btn secondary",
}: CopyValueButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={className} onClick={handleCopy} disabled={!value}>
      {copied ? copiedLabel : label}
    </button>
  );
}
