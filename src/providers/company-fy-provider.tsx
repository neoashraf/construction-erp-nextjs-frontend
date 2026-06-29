"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

/**
 * Active company + financial-year context (skill §7, ADR-0003 F7). Phase-1 UI is
 * single-company, but the platform is multi-company / multi-FY from day one
 * (NFR-005) — the active company/FY come from the session and are exposed here so
 * query keys can scope by them. The setters allow a later company/FY switcher.
 */
export interface CompanyFyState {
  companyId: string;
  financialYearId: string;
}

interface CompanyFyContextValue extends CompanyFyState {
  setFinancialYearId: (id: string) => void;
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
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [financialYearId, setFinancialYearId] = useState(initial.financialYearId);

  const value = useMemo<CompanyFyContextValue>(
    () => ({ companyId, financialYearId, setCompanyId, setFinancialYearId }),
    [companyId, financialYearId],
  );

  return <CompanyFyContext.Provider value={value}>{children}</CompanyFyContext.Provider>;
}

export function useCompanyFy(): CompanyFyContextValue {
  const ctx = useContext(CompanyFyContext);
  if (!ctx) throw new Error("useCompanyFy must be used within a CompanyFyProvider");
  return ctx;
}
