import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ProjectsScreen } from "@/features/master-data/components/ProjectsScreen";

/** Projects list route (FR-MAS-005/006) — under the (app) shell + master-data guard. */
export default async function ProjectsPage() {
  await requireModuleAccess("master-data");
  return <ProjectsScreen />;
}
