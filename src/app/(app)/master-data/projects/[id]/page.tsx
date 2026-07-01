import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ProjectDetailScreen } from "@/features/master-data/components/ProjectDetailScreen";

/** Project detail route (FR-MAS-005..016) — `[id]` is a project uuid, or `new` to create. */
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("master-data");
  const { id } = await params;
  return <ProjectDetailScreen id={id} />;
}
