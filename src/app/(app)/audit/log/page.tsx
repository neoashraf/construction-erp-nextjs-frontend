import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { AuditLogScreen } from "@/features/audit/components/AuditLogScreen";

/**
 * Audit-log route (AUD; FR-AUD-020/021/022/023/024/026/027/028) — Admin + AUD-READ
 * gated via the existing `audit` module guard (nav slot hidden for every other
 * role; the screen also renders an inline 403 view for defence-in-depth, and the
 * backend re-checks `403` on every `/api/audit-logs*` call). Deep-linkable by
 * `?id=` (breadcrumb "Admin / Audit log / entry {id}") — a row opens the
 * before/after diff without leaving the list.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleAccess("audit");
  const sp = await searchParams;
  const raw = Array.isArray(sp.id) ? sp.id[0] : sp.id;
  const initialId = raw && raw.trim().length > 0 ? raw.trim() : null;
  return <AuditLogScreen initialId={initialId} />;
}
