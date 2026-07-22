"use client";

import { ReportTypeSwitcher, type ReportChip } from "../../components/ReportTypeSwitcher";
import { type ProjectReportTab } from "../types";

/**
 * FE-57 project-report chip row (spec §3, §9). Flow reports (P&L, IPC report) =
 * blue dot; the as-of Outstanding report = violet; the two budget-variance reports
 * (material consumption, labour cost) = amber. Rendered as the shared design chip row.
 */
const CHIPS: ReadonlyArray<ReportChip<ProjectReportTab>> = [
  { id: "PROJECT_PNL", label: "Project P&L", tone: "blue" },
  { id: "IPC_BILLING", label: "IPC report", tone: "blue" },
  { id: "OUTSTANDING", label: "Outstanding", tone: "violet" },
  { id: "MATERIAL_CONSUMPTION", label: "Material consumption vs budget", tone: "amber" },
  { id: "LABOUR_COST", label: "Labour cost", tone: "amber" },
];

export function ProjectIpcReportSwitcher({
  value,
  onChange,
}: {
  value: ProjectReportTab;
  onChange: (next: ProjectReportTab) => void;
}) {
  return (
    <ReportTypeSwitcher
      ariaLabel="Project report"
      chips={CHIPS}
      value={value}
      onChange={onChange}
      testId="pi-switcher"
      chipTestId={(id) => `pi-tab-${id}`}
    />
  );
}
