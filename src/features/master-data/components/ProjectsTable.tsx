"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { type Project } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

/**
 * Projects list table (spec §5; design file `Projects.dc.html`). Desktop grid ≥768,
 * cards below. Columns mirror the design: Code (mono lime link) · Name (+ location
 * sub-line) · Customer (lime link) · PM · Status badge · Start · Expected end · kebab
 * (Open / Edit). Rows open the detail; the kebab's Edit is gated by `canManage`.
 */

// Matches the design's grid: Code · Name · Customer · PM · Status · Start · End · kebab.
const GRID = "grid-cols-[0.78fr_1.7fr_1.35fr_1.05fr_0.92fr_0.85fr_0.95fr_50px]";

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : "—");

function detailHref(id: string): string {
  return `/master-data/projects/${id}`;
}

export function ProjectsTable({
  projects,
  customerLabel,
  pmLabel,
  canManage = false,
}: {
  projects: Project[];
  customerLabel: (id: string | null) => string;
  pmLabel: (id: string | null) => string;
  /** Show the kebab's Edit action (UPDATE grant); Open is always available. */
  canManage?: boolean;
}) {
  const router = useRouter();

  return (
    <div>
      {/* Desktop / tablet grid (≥768) */}
      <div role="table" aria-label="Projects" className="hidden md:block" data-testid="projects-desktop">
        {/* header */}
        <div
          role="row"
          className={cn("grid rounded-t-card border-b border-border-strong bg-surface-2", GRID)}
        >
          <HeaderCell>Code</HeaderCell>
          <HeaderCell>Name</HeaderCell>
          <HeaderCell>Customer</HeaderCell>
          <HeaderCell>PM</HeaderCell>
          <HeaderCell>Status</HeaderCell>
          <HeaderCell>Start</HeaderCell>
          <HeaderCell>Expected end</HeaderCell>
          <div role="columnheader" className="h-11" />
        </div>

        {projects.map((p) => {
          const customer = customerLabel(p.customerId);
          const pm = pmLabel(p.projectManagerId);
          return (
            <div
              key={p.id}
              role="row"
              tabIndex={0}
              onClick={() => router.push(detailHref(p.id))}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  router.push(detailHref(p.id));
                }
              }}
              className={cn(
                "grid min-h-[54px] cursor-pointer items-center border-b border-border outline-none",
                "focus:bg-accent-soft hover:bg-surface-2",
                GRID,
              )}
              data-testid={`project-row-${p.id}`}
            >
              {/* code — mono lime link */}
              <div className="min-w-0 px-4 py-2">
                <Link
                  href={detailHref(p.id)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                >
                  {p.projectCode}
                </Link>
              </div>
              {/* name + location sub-line */}
              <div className="min-w-0 px-4 py-2">
                <Link
                  href={detailHref(p.id)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="block truncate text-[13.5px] font-semibold text-foreground hover:underline"
                  title={p.name}
                >
                  {p.name}
                </Link>
                {p.location && (
                  <span className="block truncate text-[11.5px] text-faint" title={p.location}>
                    {p.location}
                  </span>
                )}
              </div>
              {/* customer — lime link */}
              <div className="min-w-0 px-4 py-2">
                <span className="block truncate text-[13px] text-accent-ink" title={customer}>
                  {customer}
                </span>
              </div>
              {/* PM */}
              <div className="min-w-0 px-4 py-2">
                <span className="block truncate text-[13px] text-foreground" title={pm}>
                  {pm}
                </span>
              </div>
              {/* status */}
              <div className="px-4 py-2">
                <ProjectStatusBadge status={p.status} />
              </div>
              {/* start */}
              <div className="px-4 py-2 font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {formatDate(p.startDate)}
              </div>
              {/* expected end */}
              <div className="px-4 py-2 font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {dash(p.expectedEndDate && formatDate(p.expectedEndDate))}
              </div>
              {/* kebab — Open / Edit */}
              <div className="flex items-center justify-center px-1 py-2" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${p.projectCode}`}
                    className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`project-actions-${p.id}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[184px]">
                    <DropdownMenuItem onSelect={() => router.push(detailHref(p.id))}>
                      Open
                    </DropdownMenuItem>
                    {canManage && (
                      <DropdownMenuItem onSelect={() => router.push(detailHref(p.id))}>
                        Edit
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile cards (≤767) */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="projects-cards">
        {projects.map((p) => (
          <li
            key={p.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`project-card-${p.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={detailHref(p.id)}
                className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
              >
                {p.projectCode}
              </Link>
              <ProjectStatusBadge status={p.status} />
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">{p.name}</div>
            {p.location && <div className="text-[11.5px] text-faint">{p.location}</div>}
            <div className="mt-1 text-xs text-muted-foreground">
              {customerLabel(p.customerId)} · {pmLabel(p.projectManagerId)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="columnheader"
      className="flex h-11 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
    >
      {children}
    </div>
  );
}
