import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { NumberingSeriesScreen } from "@/features/numbering/components/NumberingSeriesScreen";

/**
 * Numbering series route (NUM; FR-NUM-001/002/013/018/019/020/021/022). Placed under
 * the Master Data group per the screen spec (breadcrumb `Master Data / Numbering
 * series`). Guarded on the `numbering` module capability; the screen itself is
 * Admin-only (spec §11) and renders a 403 view for non-Admins as defence-in-depth
 * (the server re-checks every write).
 */
export default async function NumberingSeriesPage() {
  await requireModuleAccess("numbering");
  return <NumberingSeriesScreen />;
}
