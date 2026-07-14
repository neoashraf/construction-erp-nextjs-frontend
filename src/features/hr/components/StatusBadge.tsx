import { Badge } from "@/components/ui/badge";
import { type EmployeeStatus } from "../types";

/**
 * Employee status pill (spec §4/§6). ACTIVE = success; INACTIVE = neutral with an explicit
 * text label — never colour-only (spec §10). Used both in the list row and the detail header.
 */
export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  if (status === "ACTIVE") {
    return (
      <Badge tone="success" dot data-testid={`employee-status-${status}`}>
        Active
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" dot data-testid={`employee-status-${status}`}>
      Inactive
    </Badge>
  );
}
