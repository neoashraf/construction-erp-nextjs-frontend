"use client";

import { roleLabel, type Role } from "@/lib/auth/roles";
import { useCompanyFy } from "@/providers/company-fy-provider";
import { LogoutButton } from "./logout-button";

interface TopbarUser {
  name: string;
  role: Role;
}

/**
 * Topbar (skill §2.1, ADR-0003 F1). Shows the brand, the active company/FY context
 * (read from the provider — the platform is multi-company/FY aware, NFR-005), the
 * user + role, and logout. Token-driven styling; the real design comes later.
 */
export function Topbar({ user }: { user: TopbarUser }) {
  const { companyId, financialYearId } = useCompanyFy();
  return (
    <header
      data-testid="topbar"
      className="flex h-14 items-center justify-between border-b border-border bg-background px-4"
    >
      <div className="flex items-center gap-4">
        <span className="font-semibold">Zakir Enterprise ERP</span>
        <span className="text-xs text-muted-foreground" data-testid="company-fy">
          {/* TODO(screen brief): resolve names from masters; ids shown for now. */}
          Co: {companyId.slice(0, 8)} · FY: {financialYearId.slice(0, 8)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span data-testid="topbar-user">
          {user.name} · {roleLabel(user.role)}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
