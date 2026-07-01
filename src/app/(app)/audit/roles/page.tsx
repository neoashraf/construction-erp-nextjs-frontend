import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { RolePermissionEditorScreen } from "@/features/audit/components/RolePermissionEditorScreen";

/**
 * Roles & permissions route (AUD; FR-AUD-011/012/013/016/019/020). Admin-only —
 * guarded on the `audit` module capability (only ADMIN has it, `lib/auth/roles.ts`);
 * the screen itself also renders an inline 403 view for defence-in-depth, since
 * the backend re-checks every `/api/roles*` / `/api/permissions*` request.
 */
export default async function RolesPage() {
  await requireModuleAccess("audit");
  return <RolePermissionEditorScreen />;
}
