"use client";

import Link from "next/link";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { type Project } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : "—");

/** Projects list table (spec §5). Desktop table; ≤767px cards. */
export function ProjectsTable({
  projects,
  customerLabel,
  pmLabel,
}: {
  projects: Project[];
  customerLabel: (id: string | null) => string;
  pmLabel: (id: string | null) => string;
}) {
  return (
    <div>
      <div className="hidden md:block" data-testid="projects-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden lg:table-cell">Customer</TableHead>
              <TableHead className="hidden lg:table-cell">PM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Expected end</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id} data-testid={`project-row-${p.id}`}>
                <TableCell>
                  <Link
                    href={`/master-data/projects/${p.id}`}
                    className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                  >
                    {p.projectCode}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{p.name}</TableCell>
                <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                  {customerLabel(p.customerId)}
                </TableCell>
                <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                  {pmLabel(p.projectManagerId)}
                </TableCell>
                <TableCell>
                  <ProjectStatusBadge status={p.status} />
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {formatDate(p.startDate)}
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {dash(p.expectedEndDate && formatDate(p.expectedEndDate))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" data-testid="projects-cards">
        {projects.map((p) => (
          <li
            key={p.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`project-card-${p.id}`}
          >
            <Link
              href={`/master-data/projects/${p.id}`}
              className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
            >
              {p.projectCode}
            </Link>
            <div className="mt-1 text-sm">{p.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {customerLabel(p.customerId)} · {pmLabel(p.projectManagerId)}
            </div>
            <div className="mt-1.5">
              <ProjectStatusBadge status={p.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
