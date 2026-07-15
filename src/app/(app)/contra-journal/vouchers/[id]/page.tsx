import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ContraVoucherEditor } from "@/features/contra-journal/components/ContraVoucherEditor";
import { JournalVoucherEditor } from "@/features/contra-journal/components/JournalVoucherEditor";

/**
 * Existing voucher route (GEN; FR-GEN-001…-018). Dispatches by `?type`. FE-49 owns the
 * contra branch; FE-50 mounts the journal editor on `?type=journal`. Both are guarded
 * on `contra-journal:READ`; write actions gate further inside.
 */
export default async function ExistingVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleAccess("contra-journal");
  const { id } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const type = (one(sp.type) ?? "contra").toLowerCase();
  if (type === "journal") return <JournalVoucherEditor voucherId={id} />;
  return <ContraVoucherEditor voucherId={id} />;
}
