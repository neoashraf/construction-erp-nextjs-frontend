"use client";

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Active company + financial-year context (skill §7, ADR-0003 F7). Phase-1 UI is
 * single-company, but the platform is multi-company / multi-FY from day one
 * (NFR-005) — the active company/FY come from the session and are exposed here so
 * query keys can scope by them.
 *
 * App Shell v2 (screen spec §5/§7/§9) adds the **resolved display names** (company
 * name + FY label, fetched by the switcher and pushed here) and a `switchFinancialYear`
 * that flips the active FY AND invalidates all server-state so every query refetches
 * under the new scope. The names default to `null` until the switcher resolves them
 * (the chip then shows a short-id fallback — spec §6 partial).
 */
export interface CompanyFyState {
  companyId: string;
  financialYearId: string;
}

interface CompanyFyContextValue extends CompanyFyState {
  /** Resolved company name (null until the masters call resolves it). */
  companyName: string | null;
  /** Resolved active-FY label (null until resolved). */
  financialYearLabel: string | null;
  /** Push resolved names once the switcher fetches masters (spec §5). */
  setResolvedNames: (names: { companyName?: string | null; financialYearLabel?: string | null }) => void;
  /** Switch the active FY + label and invalidate every query so data re-scopes (§9). */
  switchFinancialYear: (id: string, label: string | null) => void;
  setCompanyId: (id: string) => void;
}

const CompanyFyContext = createContext<CompanyFyContextValue | undefined>(undefined);

export function CompanyFyProvider({
  initial,
  children,
}: {
  initial: CompanyFyState;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [financialYearId, setFinancialYearId] = useState(initial.financialYearId);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [financialYearLabel, setFinancialYearLabel] = useState<string | null>(null);

  const setResolvedNames = useCallback(
    (names: { companyName?: string | null; financialYearLabel?: string | null }) => {
      if (names.companyName !== undefined) setCompanyName(names.companyName);
      if (names.financialYearLabel !== undefined) setFinancialYearLabel(names.financialYearLabel);
    },
    [],
  );

  const switchFinancialYear = useCallback(
    (id: string, label: string | null) => {
      setFinancialYearId(id);
      setFinancialYearLabel(label);
      // Re-scope all server-state to the new FY (query keys carry financialYearId).
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const value = useMemo<CompanyFyContextValue>(
    () => ({
      companyId,
      financialYearId,
      companyName,
      financialYearLabel,
      setResolvedNames,
      switchFinancialYear,
      setCompanyId,
    }),
    [companyId, financialYearId, companyName, financialYearLabel, setResolvedNames, switchFinancialYear],
  );

  return <CompanyFyContext.Provider value={value}>{children}</CompanyFyContext.Provider>;
}

export function useCompanyFy(): CompanyFyContextValue {
  const ctx = useContext(CompanyFyContext);
  if (!ctx) throw new Error("useCompanyFy must be used within a CompanyFyProvider");
  return ctx;
}
