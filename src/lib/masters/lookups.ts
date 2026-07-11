import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/**
 * Master-data NAME lookups as shared plumbing over the configured `apiClient`.
 * These live in `lib/` (not the master-data feature) so any feature — e.g. the
 * ledger, whose line read carries dimension IDs only — can resolve IDs → names
 * without violating the feature-import boundary (skill §2.4; mirrors
 * `lib/shell/shell-data.ts`). Read-only, cached, and they DEGRADE SILENTLY: on any
 * failure a lookup returns the raw ID so the UI never blanks.
 */

interface Envelope<T> {
  data: T;
}
interface Paged<T> {
  data: T[];
}

export interface AccountRef {
  id: string;
  code: string;
  name: string;
}
interface PartyRef {
  id: string;
  name: string;
}
interface ProjectRef {
  id: string;
  projectCode: string;
  name: string;
}
interface CostCentreRef {
  id: string;
  code: string;
  name: string;
}

async function safeList<T>(fetcher: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fetcher();
  } catch {
    return [];
  }
}

/** Index rows by every provided key → a display string. */
function indexBy<T>(
  rows: T[],
  keys: (r: T) => (string | null | undefined)[],
  value: (r: T) => string,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    const v = value(r);
    for (const k of keys(r)) if (k) m.set(k, v);
  }
  return m;
}

export interface MasterLookups {
  /** "1201 — Accounts Receivable" (code + name), or the raw id. */
  accountLabel: (id: string | null | undefined) => string;
  /** Account name only (no code) — for a chip that already shows the code. */
  accountName: (id: string | null | undefined) => string | null;
  party: (id: string | null | undefined) => string;
  project: (id: string | null | undefined) => string;
  costCentre: (id: string | null | undefined) => string;
}

/**
 * Fetch the company-global master lists (accounts · parties · projects · cost
 * centres) and expose ID→name lookups. Each map is keyed by BOTH `id` and the
 * entity's business code, because a consumer may reference either (the account
 * ledger scopes by account CODE, e.g. "1201"). Purpose/godown are project-scoped
 * and intentionally not resolved here.
 */
/**
 * The chart-of-accounts list for a picker (`GET /masters/accounts`), sorted by code.
 * Shared lib so any feature can populate an account selector without importing the
 * master-data feature. Degrades to an empty list on failure.
 */
export function useAccountOptions() {
  const query = useQuery({
    queryKey: ["masters", "accounts", "options"],
    queryFn: async () =>
      safeList(async () => (await apiClient.get<Envelope<AccountRef[]>>("/masters/accounts")).data ?? []),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const accounts = useMemo(() => {
    const rows = query.data ?? [];
    return [...rows].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [query.data]);
  return { accounts, isLoading: query.isLoading };
}

export function useMasterLookups(): MasterLookups {
  const query = useQuery({
    queryKey: ["masters", "lookups"],
    queryFn: async () => {
      const [accounts, parties, projects, costCentres] = await Promise.all([
        safeList(async () => (await apiClient.get<Envelope<AccountRef[]>>("/masters/accounts")).data ?? []),
        safeList(async () => (await apiClient.get<Paged<PartyRef>>("/masters/parties?page=1&pageSize=500")).data ?? []),
        safeList(async () => (await apiClient.get<Paged<ProjectRef>>("/masters/projects?page=1&pageSize=500")).data ?? []),
        safeList(async () => (await apiClient.get<Paged<CostCentreRef>>("/masters/cost-centres?page=1&pageSize=500")).data ?? []),
      ]);
      return { accounts, parties, projects, costCentres };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return useMemo(() => {
    const d = query.data ?? { accounts: [], parties: [], projects: [], costCentres: [] };
    const acctName = indexBy(d.accounts, (a) => [a.id, a.code], (a) => a.name);
    const acctCodeName = indexBy(d.accounts, (a) => [a.id, a.code], (a) => `${a.code} — ${a.name}`);
    const partyName = indexBy(d.parties, (p) => [p.id], (p) => p.name);
    const projectName = indexBy(d.projects, (p) => [p.id, p.projectCode], (p) => p.projectCode);
    const ccName = indexBy(d.costCentres, (c) => [c.id, c.code], (c) => c.name);

    const lookup = (m: Map<string, string>) => (id: string | null | undefined) =>
      (id && m.get(id)) || id || "";

    return {
      accountLabel: lookup(acctCodeName),
      accountName: (id) => (id ? (acctName.get(id) ?? null) : null),
      party: lookup(partyName),
      project: lookup(projectName),
      costCentre: lookup(ccName),
    };
  }, [query.data]);
}
