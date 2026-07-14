import { TrialBalanceLedgersViewer } from "@/features/reports/viewers/trial-balance-ledgers/components/TrialBalanceLedgersViewer";

/**
 * FE-56 fe-trial-balance-ledgers — the four-in-one dense-registers viewer
 * (child route of `/reports`). Guarded by `reports:READ`.
 */
export const dynamic = "force-dynamic";

export default function TrialBalanceLedgersPage() {
  return <TrialBalanceLedgersViewer />;
}
