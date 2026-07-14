import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ContraVoucherEditor } from "@/features/contra-journal/components/ContraVoucherEditor";

/**
 * New voucher route (GEN; FR-GEN-001…-018). Dispatches by `?type` — this brief owns
 * the contra branch; FE-50's journal branch mounts alongside once it lands. `contra`
 * is the default fallback.
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
  // FE-50 will branch on `type === "journal"` — until then everything opens as a contra.
  if (type === "journal") return <ContraVoucherEditor voucherId={null} />;
  return <ContraVoucherEditor voucherId={null} />;
}
