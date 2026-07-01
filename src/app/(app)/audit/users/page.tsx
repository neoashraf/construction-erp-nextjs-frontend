import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { UsersScreen } from "@/features/audit/components/UsersScreen";

/**
 * Users route (AUD; FR-AUD-002/007/008/009/011/018/019/020/027). Admin-only —
 * guarded on the `audit` module capability (only ADMIN has it, `lib/auth/roles.ts`);
 * the screen itself also renders an inline 403 view for defence-in-depth, matching
 * the design file's no-access state, since the backend re-checks every request.
 */
export default async function UsersPage() {
  await requireModuleAccess("audit");
  return <UsersScreen />;
}
