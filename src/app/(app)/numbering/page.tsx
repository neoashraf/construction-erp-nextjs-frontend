import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

/** Voucher Numbering (NUM) segment — guarded, empty. Screens come with their briefs. */
export default async function NumberingPage() {
  await requireModuleAccess("numbering");
  return <ModulePlaceholder module="numbering" />;
}
