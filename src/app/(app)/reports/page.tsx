import { ReportCatalogScreen } from "@/features/reports/components/ReportCatalogScreen";

/**
 * FE-54 fe-report-catalog — the /reports hub. Guarded like every (app)
 * segment; the underlying `reports:READ` grant is what the module registry
 * uses. Replaces the ComingSoon placeholder.
 */
export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return <ReportCatalogScreen />;
}
