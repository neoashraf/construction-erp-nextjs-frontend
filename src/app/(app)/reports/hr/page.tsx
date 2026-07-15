import { HrReportsViewer } from "@/features/reports/hr/components/HrReportsViewer";

/**
 * FE-60 fe-hr-reports — three-report HR viewer (child of `/reports`).
 * Guarded on `reports:READ` by the module registry.
 */
export const dynamic = "force-dynamic";

export default function HrReportsPage() {
  return <HrReportsViewer />;
}
