"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { matchNav } from "@/lib/nav/nav-tree";
import { cn } from "@/lib/utils";

/**
 * Shell-owned breadcrumb — DETAIL PAGES ONLY (App Shell v3, spec §3.3). Flat
 * list/master pages render NO breadcrumb (the H1 is the page identity; the topbar
 * stays purely global). A drill-down screen supplies its **record** crumb via
 * `useSetRecordCrumb(label)`; only then does the trail render — in the CONTENT
 * header, just above the screen (not the topbar) — as a real clickable path from
 * the list page to the record (e.g. `Chart of accounts › Cash in Hand`). The trail
 * never starts at a sidebar SECTION name; it starts at the first real page (the
 * screen's list route, derived from the nav tree). Long/Bangla record segments
 * truncate with a `title` tooltip. On <768 it collapses to the last segment with a
 * back chevron. `nav[aria-label="Breadcrumb"]` landmark (§10).
 */

interface BreadcrumbContextValue {
  recordCrumb: string | null;
  setRecordCrumb: (label: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [recordCrumb, setRecordCrumb] = useState<string | null>(null);
  const value = useMemo(() => ({ recordCrumb, setRecordCrumb }), [recordCrumb]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("useBreadcrumb must be used within a BreadcrumbProvider");
  return ctx;
}

/**
 * A routed screen calls this with its record label (or null) to feed the shell's
 * breadcrumb. It clears the crumb on unmount so it never leaks to the next route.
 * Detail/viewer screens use it (e.g. an entry no. or party name); list screens omit
 * it — their Module › Screen trail is derived automatically.
 *
 * Safe outside a `BreadcrumbProvider`: it no-ops (so a screen rendered standalone —
 * e.g. in a component test — doesn't crash on the missing shell context).
 */
export function useSetRecordCrumb(label: string | null | undefined): void {
  const ctx = useContext(BreadcrumbContext);
  const setRecordCrumb = ctx?.setRecordCrumb;
  useEffect(() => {
    if (!setRecordCrumb) return;
    setRecordCrumb(label ?? null);
    return () => setRecordCrumb(null);
  }, [label, setRecordCrumb]);
}

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Build the detail-only trail: nothing without a record crumb (list pages carry no
 * breadcrumb — v3 §3.3); with one, the trail is `Screen (list, link) › Record`,
 * starting at the first real page — never a sidebar section or module label.
 */
function useTrail(): Crumb[] {
  const pathname = usePathname();
  const { recordCrumb } = useBreadcrumbContext();
  const match = matchNav(pathname);
  if (!recordCrumb || !match) return [];
  return [{ label: match.item.label, href: match.item.route }, { label: recordCrumb }];
}

export function Breadcrumb() {
  const trail = useTrail();
  if (trail.length === 0) return null;

  const last = trail[trail.length - 1]!;
  const parent = trail.length > 1 ? trail[trail.length - 2] : undefined;

  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumb" className="mb-3 min-w-0">
      {/* ≤768: collapse to the last segment with a back chevron to the parent. */}
      <div className="flex items-center gap-1 text-[13px] text-muted-foreground md:hidden">
        {parent?.href && (
          <Link
            href={parent.href}
            aria-label={`Back to ${parent.label}`}
            className="grid h-6 w-6 place-items-center rounded-token hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
        )}
        <span className="truncate font-medium text-foreground">{last.label}</span>
      </div>

      {/* ≥768: the full trail. */}
      <ol className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-border-strong" aria-hidden />}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", isLast ? "font-medium text-foreground" : "text-muted-foreground")}
                  aria-current={isLast ? "page" : undefined}
                  title={crumb.label}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
