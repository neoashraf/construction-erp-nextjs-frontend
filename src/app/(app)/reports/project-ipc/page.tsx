import { ProjectIpcViewer } from "@/features/reports/project-ipc/components/ProjectIpcViewer";

/**
 * FE-57 fe-project-ipc-reports — the project-lens report family viewer (child
 * route of `/reports`). Guarded on `reports:READ` by the module registry.
 */
export const dynamic = "force-dynamic";

export default function ProjectIpcReportsPage() {
  return <ProjectIpcViewer />;
}
