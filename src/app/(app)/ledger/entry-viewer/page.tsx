import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { EntryViewerScreen } from "@/features/ledger/components/EntryViewerScreen";
import { parseEntryId } from "@/features/ledger/schemas/entry-id.schema";

/**
 * Entry-viewer route (LED; FR-LED-005/006/030/026/024/007) — under the (app) shell +
 * the `ledger` module guard. Deep-linkable by `?id=` from the Journal-entries list,
 * the Account ledger, or a direct link. Read-only: renders one posted journal entry's
 * header, balanced lines, totals, and linkage; the server further scopes a Project
 * Manager to entries with ≥1 assigned-project line and re-checks every read (`403
 * FORBIDDEN` / `404 NOT_FOUND` cross-company), which the screen renders as its
 * permission-denied / not-found states.
 */
export default async function EntryViewerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleAccess("ledger");
  const sp = await searchParams;
  const raw = Array.isArray(sp.id) ? sp.id[0] : sp.id;
  const id = parseEntryId(raw);
  return <EntryViewerScreen id={id} />;
}
