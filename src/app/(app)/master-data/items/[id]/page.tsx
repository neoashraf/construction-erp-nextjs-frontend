import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ItemDetailScreen } from "@/features/master-data/components/ItemDetailScreen";

/** Item detail route (FR-MAS-025/026) — `[id]` is an item uuid, or `new` to create. */
export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("master-data");
  const { id } = await params;
  return <ItemDetailScreen id={id} />;
}
