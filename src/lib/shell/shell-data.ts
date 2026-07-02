import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/**
 * Shell-owned data hooks (App Shell v2 — screen spec §5/§6). These live in `lib/`
 * (shared plumbing over the configured `apiClient`) rather than a feature, because
 * the import-boundary rule forbids `components/shell` from importing a `feature`
 * (skill §2.4). They resolve the switcher's display names and the alerts-bell count,
 * and both **degrade silently** so the shell never blanks on their failure.
 */

interface Envelope<T> {
  data: T;
}

interface CompanyName {
  id: string;
  name: string;
}
interface FinancialYearName {
  id: string;
  label: string;
  isActive: boolean;
}

/**
 * Resolve the company name + the list of financial years for the switcher chip/popover
 * (`GET /api/masters/companies`, `GET /api/masters/financial-years`). On failure the
 * hook returns `isError` and the chip falls back to short IDs (spec §6 partial) — the
 * nav is unaffected.
 */
export function useShellMasters(companyId: string) {
  return useQuery({
    queryKey: ["shell", "masters", companyId],
    queryFn: async () => {
      const [companiesRes, fyRes] = await Promise.all([
        apiClient.get<Envelope<CompanyName[]>>("/masters/companies"),
        apiClient.get<Envelope<FinancialYearName[]>>("/masters/financial-years"),
      ]);
      const companies = companiesRes.data ?? [];
      const financialYears = fyRes.data ?? [];
      const company = companies.find((c) => c.id === companyId) ?? companies[0] ?? null;
      return { company, financialYears };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export interface ShellFinancialYear {
  id: string;
  label: string;
  isActive: boolean;
}

/**
 * The open over-budget alert count for the topbar bell (`GET /api/cost-control/alerts`,
 * count = pagination `meta.total`; spec §5/§14-2). Enabled only when the Cost-control
 * module is built + the role sees the bell; on any error it resolves to `null` so the
 * bell degrades to a plain bell with no badge (spec §6 partial).
 */
export function useAlertCount(enabled: boolean) {
  const query = useQuery({
    queryKey: ["shell", "alertCount"],
    queryFn: async () => {
      const res = await apiClient.get<{ meta?: { total?: number } }>(
        "/cost-control/alerts?page=1&pageSize=1",
      );
      return res.meta?.total ?? null;
    },
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
  // Degrade silently: expose the count only on success; never surface the error.
  return { count: query.isSuccess ? (query.data ?? null) : null };
}
