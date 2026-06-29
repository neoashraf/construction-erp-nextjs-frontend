import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

/** Accounting Period Control (PER) segment — guarded, empty. Screens come with their briefs. */
export default async function PeriodPage() {
  await requireModuleAccess("period");
  return <ModulePlaceholder module="period" />;
}
