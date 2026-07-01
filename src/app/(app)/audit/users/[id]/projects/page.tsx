import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ProjectAssignmentScreen } from "@/features/audit/components/ProjectAssignmentScreen";

/**
 * Project assignment route (AUD; FR-AUD-014/015/020). Admin-only — guarded on
 * the `audit` module capability (only ADMIN has it, `lib/auth/roles.ts`); the
 * screen itself also renders an inline 403 view for defence-in-depth, since the
 * backend re-checks every `/api/users/:id/projects*` request. `[id]` is the
 * target user's uuid.
 */
export default async function ProjectAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("audit");
  const { id } = await params;
  return <ProjectAssignmentScreen userId={id} />;
}
