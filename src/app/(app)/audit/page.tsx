import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

/** Audit, Security & Access (AUD) segment — guarded, empty. Screens come with their briefs. */
export default async function AuditPage() {
  await requireModuleAccess("audit");
  return <ModulePlaceholder module="audit" />;
}
