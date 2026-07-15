import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type AssignedProjectsScope } from "../types";

/**
 * FE-52 assigned-projects block (spec §4/§5 — advisory display). Unscoped roles
 * render "All projects"; empty list renders "No projects assigned"; otherwise a
 * wrapping list of project-name chips (Bangla-safe, never clipped).
 */
export function AssignedProjects({ assigned }: { assigned: AssignedProjectsScope }) {
  if (!Array.isArray(assigned)) {
    return (
      <Card className="p-5" data-testid="profile-assigned-projects">
        <SectionHeader />
        <p className="mt-2 text-[13.5px] text-foreground" data-testid="profile-projects-all">
          All projects
        </p>
        <AdvisoryNote />
      </Card>
    );
  }
  if (assigned.length === 0) {
    return (
      <Card className="p-5" data-testid="profile-assigned-projects">
        <SectionHeader />
        <p className="mt-2 text-[13.5px] text-muted-foreground" data-testid="profile-projects-empty">
          No projects assigned
        </p>
        <AdvisoryNote />
      </Card>
    );
  }
  return (
    <Card className="p-5" data-testid="profile-assigned-projects">
      <SectionHeader />
      <ul className="mt-3 flex flex-wrap gap-1.5" data-testid="profile-projects-list">
        {assigned.map((p) => (
          <li key={p.projectId}>
            <Badge tone="accent" className="max-w-full break-words">
              {p.projectName}
            </Badge>
          </li>
        ))}
      </ul>
      <AdvisoryNote />
    </Card>
  );
}

function SectionHeader() {
  return (
    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
      Assigned projects
    </h3>
  );
}

function AdvisoryNote() {
  return (
    <p className="mt-3 text-[11.5px] text-muted-foreground">
      Advisory only — an admin manages project scope.
    </p>
  );
}
