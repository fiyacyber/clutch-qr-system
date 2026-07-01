"use client";

import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";

export default function GuidedSetupSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn primary" type="submit" disabled={pending}>
      <Sparkles size={15} />
      {pending ? "Saving..." : "Save and Open Builder"}
    </button>
  );
}
