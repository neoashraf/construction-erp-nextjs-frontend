import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { MatchView } from "@/features/purchase/components/MatchView";

/**
 * PO → Bill → GRN match view route (PUR; FR-PUR-017/-018). Under the `(app)`
 * shell + the `purchase` module guard. Read-only reconciliation of ordered vs
 * billed vs received vs open per PO line; PM is server-scoped to assigned
 * projects (403 outside).
 */
export default async function PurchaseMatchPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  await requireModuleAccess("purchase");
  const { poId } = await params;
  return <MatchView poId={poId} />;
}
