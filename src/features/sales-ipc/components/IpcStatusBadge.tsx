import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "../schemas/ipc.schema";
import { type IpcStatus } from "../types";

/**
 * IPC status badge covering the draft → posted → cancelled lifecycle (FR-SAL-023; spec §5).
 * Text + dot, never colour-only (§10; carries an `aria-label`). Shared with `fe-ipc-viewer` +
 * `fe-ipc-register-retention`.
 */
const TONE: Record<IpcStatus, "warning" | "success" | "neutral"> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "neutral",
};

export function IpcStatusBadge({ status, className }: { status: IpcStatus; className?: string }) {
  return (
    <Badge tone={TONE[status]} dot className={className} aria-label={`Status: ${STATUS_LABEL[status]}`} data-testid={`ipc-status-${status}`}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
