import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

/** Master Data (MAS) segment — guarded, empty. Screens come with their briefs. */
export default async function MasterDataPage() {
  await requireModuleAccess("master-data");
  return <ModulePlaceholder module="master-data" />;
}
