import { Badge, type BadgeProps } from "@/components/ui/badge";
import { type ProjectStatus } from "../types";

const TONE: Record<ProjectStatus, NonNullable<BadgeProps["tone"]>> = {
  PLANNED: "info",
  ACTIVE: "success",
  ON_HOLD: "warning",
  CLOSED: "neutral",
};
const LABEL: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

/** Project status badge (FR-MAS-006). Colour + text; aria-labelled. */
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={TONE[status]} dot aria-label={`Status: ${LABEL[status]}`}>
      {LABEL[status]}
    </Badge>
  );
}
