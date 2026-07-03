"use client";

import { useState } from "react";

type CopyTextButtonProps = {
  value: string;
  label?: string;
};

export default function CopyTextButton({ value, label = "Copy link" }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={handleCopy} disabled={!value}>
      {copied ? "Copied" : label}
    </button>
  );
}
