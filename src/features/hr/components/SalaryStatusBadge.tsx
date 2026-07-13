"use client";

import { Badge } from "@/components/ui/badge";
import { SALARY_STATUS_LABEL } from "../schemas/salary.schema";
import { type SalarySheetStatus } from "../api/salary";

/**
 * Salary-sheet status badge (spec §5, §10). Text-labelled (not colour-only, WCAG 2.1 AA):
 * DRAFT = warning · POSTED = success · REVERSED = neutral. Drives which actions the
 * editor exposes; server-authoritative regardless.
 */
export function SalaryStatusBadge({ status }: { status: SalarySheetStatus }) {
  const tone: "warning" | "success" | "neutral" =
    status === "POSTED" ? "success" : status === "REVERSED" ? "neutral" : "warning";
  return (
    <Badge tone={tone} dot data-testid={`salary-status-${status}`}>
      {SALARY_STATUS_LABEL[status]}
    </Badge>
  );
}
