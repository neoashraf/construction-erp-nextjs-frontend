"use client";

import { roleLabel, type Role } from "@/lib/auth/roles";
import { useCompanyFy } from "@/providers/company-fy-provider";
import { LogoutButton } from "./logout-button";

interface TopbarUser {
  name: string;
  role: Role;
}

/**
 * Topbar (design-system §5.2, skill §2.1). A light bar over the content showing the
 * active company/FY context (multi-company/FY aware, NFR-005), the user + role, and
 * logout. The brand now lives in the navy sidebar.
 */
export function Topbar({ user }: { user: TopbarUser }) {
  const { companyId, financialYearId } = useCompanyFy();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      data-testid="topbar"
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-5"
    >
      <span
        data-testid="company-fy"
        className="inline-flex items-center gap-2 rounded-token border border-border-strong px-2.5 py-1.5 text-xs text-muted-foreground"
      >
        {/* TODO(screen brief): resolve names from masters; ids shown for now. */}
        <span className="font-semibold text-foreground">Co</span> {companyId.slice(0, 8)}
        <span className="text-faint">·</span>
        <span className="font-semibold text-foreground">FY</span> {financialYearId.slice(0, 8)}
      </span>

      <div className="flex-1" />

      <span data-testid="topbar-user" className="text-sm text-foreground">
        {user.name} <span className="text-muted-foreground">· {roleLabel(user.role)}</span>
      </span>
      <div
        className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink"
        aria-hidden
      >
        {initials}
      </div>
      <LogoutButton />
    </header>
  );
}
