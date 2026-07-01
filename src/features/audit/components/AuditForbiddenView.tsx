import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Permission-denied view for the audit log (FR-AUD-027; spec §6/§11). Shown for
 * direct nav by a role lacking AUD READ (the nav slot itself is already hidden —
 * this is defence-in-depth) AND for a server `403 FORBIDDEN` returned anyway.
 * Exact copy per the screen spec §8 microcopy.
 */
export function AuditForbiddenView() {
  return (
    <Card className="mt-4 p-10" data-testid="audit-forbidden">
      <EmptyState
        icon={Lock}
        title="You don't have access to the audit log."
        description="The audit trail is restricted to Admins with the audit-log read permission. If you believe this is a mistake, ask an administrator to review your role."
      />
    </Card>
  );
}
