import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { StockJournalEditor } from "@/features/inventory/components/StockJournalEditor";

/**
 * Stock Journal editor / viewer route (INV; FR-INV-007…-022) — under the (app) shell + the
 * `inventory` module guard. `id="new"` opens a blank DRAFT editor; a uuid opens the
 * editor (DRAFT) or read-only viewer (APPROVED/POSTED/CANCELLED). Write/lifecycle actions
 * are gated per-actor inside the editor; the server re-checks every action.
 */
export default async function StockJournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("inventory");
  const { id } = await params;
  return <StockJournalEditor id={id} />;
}
