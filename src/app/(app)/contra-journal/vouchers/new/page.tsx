import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ContraVoucherEditor } from "@/features/contra-journal/components/ContraVoucherEditor";
import { JournalVoucherEditor } from "@/features/contra-journal/components/JournalVoucherEditor";

/**
 * New voucher route (GEN; FR-GEN-001…-018). Dispatches by `?type`. FE-49 owns the
 * contra branch; FE-50 mounts the journal editor on `?type=journal`. `contra` is the
 * default fallback.
 */
export default async function NewVoucherPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleAccess("contra-journal");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const type = (one(sp.type) ?? "contra").toLowerCase();
  if (type === "journal") return <JournalVoucherEditor voucherId={null} />;
  return <ContraVoucherEditor voucherId={null} />;
}
