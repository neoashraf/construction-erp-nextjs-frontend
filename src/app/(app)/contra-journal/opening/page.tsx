import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { OpeningJournalWizard } from "@/features/contra-journal/components/OpeningJournalWizard";

/**
 * Opening journal wizard route (GEN; FR-GEN-009…-013). Guarded on
 * `contra-journal:READ`; only Admin + Accounts Manager can Post (server-authoritative).
 * Once an OPENING voucher exists the wizard renders the read-only recap only.
 */
export default async function ContraJournalOpeningPage() {
  await requireModuleAccess("contra-journal");
  return <OpeningJournalWizard />;
}
