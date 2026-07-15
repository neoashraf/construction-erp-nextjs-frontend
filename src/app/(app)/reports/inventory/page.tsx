import { InventoryReportsViewer } from "@/features/reports/inventory/components/InventoryReportsViewer";

/**
 * FE-58 fe-inventory-reports — three-report inventory viewer (child of
 * `/reports`). Guarded on `reports:READ` by the module registry.
 */
export const dynamic = "force-dynamic";

export default function InventoryReportsPage() {
  return <InventoryReportsViewer />;
}
