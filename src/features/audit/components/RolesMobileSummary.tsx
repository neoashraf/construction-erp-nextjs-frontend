"use client";

import { formatMoney } from "@/lib/money";
import {
  PERMISSION_MODULES,
  PERMISSION_MODULE_LABEL,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABEL,
  type PendingPermissionMap,
} from "../types";
import { cellKey } from "../schemas/permission-diff";

/**
 * Read-only mobile summary (spec §4 — "Desktop/tablet only... on mobile, show a
 * read-only summary"). Below 1024 the grid is not editable; this renders each
 * granted module's action list with an "Edit on a larger screen" notice.
 */
export function RolesMobileSummary({
  roleName,
  approvalLimit,
  pending,
}: {
  roleName: string;
  approvalLimit: string | null;
  pending: PendingPermissionMap;
}) {
  const rows = PERMISSION_MODULES.map((module) => {
    const actions = PERMISSION_ACTIONS.filter((a) => pending[cellKey(module, a)]).map(
      (a) => PERMISSION_ACTION_LABEL[a],
    );
    return { module, actions };
  }).filter((r) => r.actions.length > 0);

  const approvalText =
    approvalLimit == null
      ? "No approval authority — approvals escalate."
      : `Approval limit ${formatMoney(approvalLimit)}`;

  return (
    <div data-testid="roles-mobile-summary" className="p-4">
      <div className="flex items-start gap-2.5 rounded-token border border-warning/40 bg-warning-soft px-3.5 py-2.5">
        <span className="mt-0.5 text-warning-ink" aria-hidden>
          ⓘ
        </span>
        <span className="text-[12.5px] leading-relaxed text-warning-ink">
          Editing isn&rsquo;t supported on small screens. <strong>Edit on a larger screen.</strong>{" "}
          This is a read-only summary.
        </span>
      </div>

      <div className="mt-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Role
      </div>
      <div className="mt-0.5 text-base font-bold text-foreground">{roleName}</div>
      <div className="mt-0.5 text-[12.5px] text-muted-foreground">{approvalText}</div>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground">This role has no permissions yet.</p>
        )}
        {rows.map((row) => (
          <div
            key={row.module}
            className="rounded-token border border-border p-3"
            data-testid={`mobile-row-${row.module}`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-muted-foreground">
                {row.module}
              </span>
              <span className="text-[13.5px] font-semibold text-foreground">
                {PERMISSION_MODULE_LABEL[row.module]}
              </span>
            </div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {row.actions.join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
