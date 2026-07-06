"use client";

import { formatMoney } from "@/lib/money";
import {
  PERMISSION_ACTION_LABEL,
  type PermissionCatalog,
  type PendingPermissionMap,
  type PermissionAction,
} from "../types";
import { cellKey } from "../schemas/permission-diff";

/**
 * Read-only mobile summary (spec §4 — "Desktop/tablet only… on mobile show a
 * read-only summary" · RBAC v2). Below 1024 the grid isn't editable; this lists
 * each module → its granted resources → granted actions, with an "Edit on a larger
 * screen" notice. Rows come from the catalogue (grouped by module).
 */
export function RolesMobileSummary({
  roleName,
  approvalLimit,
  catalog,
  pending,
}: {
  roleName: string;
  approvalLimit: string | null;
  catalog: PermissionCatalog;
  pending: PendingPermissionMap;
}) {
  const groups = catalog.modules
    .map((mod) => {
      const resources = mod.resources
        .map((res) => {
          const actions = res.actions.filter((a) => pending[cellKey(res.resource, a)]);
          return { resource: res.resource, label: res.label, actions };
        })
        .filter((r) => r.actions.length > 0);
      return { module: mod.module, label: mod.label, resources };
    })
    .filter((g) => g.resources.length > 0);

  const approvalText =
    approvalLimit == null
      ? "No approval authority — approvals escalate."
      : `Approval limit ${formatMoney(approvalLimit)}`;

  return (
    <div data-testid="roles-mobile-summary" className="p-4">
      <div className="flex items-start gap-2.5 rounded-token border border-warning/40 bg-warning-soft px-3.5 py-2.5">
        <span className="mt-0.5 text-warning-ink" aria-hidden>ⓘ</span>
        <span className="text-[12.5px] leading-relaxed text-warning-ink">
          Editing isn&rsquo;t supported on small screens. <strong>Edit on a larger screen.</strong> This is a read-only summary.
        </span>
      </div>

      <div className="mt-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">Role</div>
      <div className="mt-0.5 text-base font-bold text-foreground">{roleName}</div>
      <div className="mt-0.5 text-[12.5px] text-muted-foreground">{approvalText}</div>

      <div className="mt-4 flex flex-col gap-2.5">
        {groups.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground">This role has no permissions yet.</p>
        )}
        {groups.map((group) => (
          <div key={group.module} className="rounded-token border border-border p-3" data-testid={`mobile-row-${group.module}`}>
            <div className="flex items-center gap-2">
              <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-muted-foreground">{group.module}</span>
              <span className="text-[13.5px] font-semibold text-foreground">{group.label}</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {group.resources.map((res) => (
                <div key={res.resource} className="text-[12px] leading-relaxed">
                  <span className="font-medium text-foreground">{res.label}</span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {res.actions.map((a) => PERMISSION_ACTION_LABEL[a as PermissionAction] ?? a).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
