import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PartyDetailScreen } from "@/features/master-data/components/PartyDetailScreen";

/**
 * Party detail route (FR-MAS-023) — `[id]` is a party uuid, or `new` to create.
 * Guarded by the master-data module guard; the client screen fetches + hosts the form.
 */
export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("master-data");
  const { id } = await params;
  return <PartyDetailScreen id={id} />;
}
