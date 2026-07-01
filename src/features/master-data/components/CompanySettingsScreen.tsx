"use client";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/providers/session-provider";
import { useCompany } from "../hooks/useCompany";
import { CompanyIdentityCard } from "./CompanyIdentityCard";
import { LocalizationCard } from "./LocalizationCard";

/**
 * Company settings screen (FR-MAS-001/004). One fetch feeds two independent editable
 * cards (identity → PATCH, localization → PUT). Admin edits; other roles read-only
 * (backend re-checks). The single company opens directly — no list step (Phase-1).
 */
export function CompanySettingsScreen() {
  const session = useSession();
  const isAdmin = session?.role === "ADMIN";
  const query = useCompany();
  const company = query.data;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb + title + active-company badge */}
      <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
        Master Data <span className="text-border-strong">/</span>{" "}
        <span className="font-medium text-foreground">Company</span>
      </nav>
      <div className="flex items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">Company settings</h1>
        {company && (
          <Badge tone="accent" dot data-testid="active-company-badge">
            {company.name}
          </Badge>
        )}
      </div>
      <p className="mt-1 max-w-[62ch] text-[13px] text-muted-foreground">
        The single company record every master and transaction is scoped to.
      </p>

      {/* Non-Admin notice (read-only) */}
      {!isAdmin && (
        <div className="mt-4" role="status">
          <Alert tone="info">You don&apos;t have permission to change company settings.</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-[18px]">
        <CompanyIdentityCard
          company={company}
          isLoading={query.isLoading}
          isError={query.isError}
          onReload={() => query.refetch()}
          canEdit={isAdmin}
        />
        <LocalizationCard
          company={company}
          isLoading={query.isLoading}
          isError={query.isError}
          onReload={() => query.refetch()}
          canEdit={isAdmin}
        />
      </div>
    </div>
  );
}
