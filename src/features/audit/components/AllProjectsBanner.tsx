"use client";

import { Sparkles } from "lucide-react";

/**
 * All-projects banner for an unscoped role (spec §5/§6/§8). Shown instead of the
 * assigned list + picker; editing is disabled because the API would reject an
 * assignment attempt with `ROLE_SCOPE_CONFLICT` (409) anyway (FR-AUD-015).
 */
export function AllProjectsBanner() {
  return (
    <div
      role="alert"
      className="mt-3.5 flex flex-col items-center rounded-card border border-dashed border-accent bg-accent-soft px-6 py-10 text-center"
      data-testid="all-projects-banner"
    >
      <div className="grid h-[54px] w-[54px] place-items-center rounded-full bg-accent-soft text-accent-ink">
        <Sparkles className="h-6 w-6" aria-hidden />
      </div>
      <p className="mt-4 text-base font-bold text-foreground">
        This user&rsquo;s role applies to all projects — no assignment needed.
      </p>
      <p className="mt-2 max-w-[56ch] text-[13px] leading-relaxed text-muted-foreground">
        An unscoped role grants access to every project in the company without an explicit list. To
        restrict this user to specific projects, change their role to a project-scoped one first.
      </p>
      <span className="mt-4 inline-flex items-center gap-2 rounded-pill bg-warning-soft px-3 py-1.5 text-[11.5px] font-semibold text-warning-ink">
        Editing disabled · ROLE_SCOPE_CONFLICT (409) if forced
      </span>
    </div>
  );
}
