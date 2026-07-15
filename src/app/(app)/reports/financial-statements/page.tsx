import { FinancialStatementsScreen } from "@/features/reports/financial-statements/components/FinancialStatementsScreen";

/**
 * FE-55 fe-financial-statements — P&L + Balance sheet viewer (child route of
 * `/reports`). Guarded on `reports:READ` by the module registry.
 */
export const dynamic = "force-dynamic";

export default function FinancialStatementsPage() {
  return <FinancialStatementsScreen />;
}
