"use client";

import { useMemo, useState } from "react";
import { PLAN_DEFINITIONS, normalizePlanCode } from "@/lib/plans";

type PlanOption = {
  value: string;
  label: string;
};

const PLAN_OPTIONS: PlanOption[] = [
  { value: "connect_basic", label: "Clutch Connect Basic" },
  { value: "connect_plus", label: "Clutch Connect+" },
  { value: "qr_pro", label: "QR Pro" },
  { value: "agency", label: "Agency" },
  { value: "admin", label: "Admin" },
];

function getBaselineLimit(planCode: string): number | null {
  const normalized = normalizePlanCode(planCode);
  if (normalized === "admin") return null;
  return PLAN_DEFINITIONS[normalized].qrLimit;
}

interface PlanLimitFieldsProps {
  initialPlanCode?: string | null;
  initialQrLimit?: number | null;
  planInputClassName?: string;
  qrLimitInputClassName?: string;
}

export default function PlanLimitFields({
  initialPlanCode,
  initialQrLimit,
  planInputClassName = "input",
  qrLimitInputClassName = "input",
}: PlanLimitFieldsProps) {
  const normalizedInitialPlan = normalizePlanCode(initialPlanCode || "connect_basic");
  const initialLimitValue =
    normalizedInitialPlan === "admin"
      ? ""
      : String(initialQrLimit ?? PLAN_DEFINITIONS[normalizedInitialPlan].qrLimit);

  const [planCode, setPlanCode] = useState<string>(normalizedInitialPlan);
  const [qrLimit, setQrLimit] = useState<string>(initialLimitValue);

  const baselineLabel = useMemo(() => {
    const baseline = getBaselineLimit(planCode);
    return baseline === null ? "Unlimited" : String(baseline);
  }, [planCode]);

  return (
    <>
      <select
        className={planInputClassName}
        name="plan_code"
        value={planCode}
        onChange={(event) => {
          const nextPlan = normalizePlanCode(event.target.value);
          setPlanCode(nextPlan);
          const baseline = getBaselineLimit(nextPlan);
          setQrLimit(baseline === null ? "" : String(baseline));
        }}
      >
        {PLAN_OPTIONS.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        className={qrLimitInputClassName}
        name="qr_limit"
        type="number"
        min="0"
        value={qrLimit}
        placeholder={planCode === "admin" ? "Unlimited" : undefined}
        onChange={(event) => setQrLimit(event.target.value)}
      />
      <span className="admin-cell-subtext">Baseline: {baselineLabel}</span>
    </>
  );
}
