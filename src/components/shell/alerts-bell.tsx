"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { showsAlertsBell, costControlBuilt, type Role } from "@/lib/nav/nav-tree";
import { useAlertCount } from "@/lib/shell/shell-data";

/**
 * Over-budget alerts bell (screen spec §5/§6/§14-2). Rendered for CC roles only
 * (Accounts, Admin, PM). The badge shows the open-alert count from
 * `GET /api/cost-control/alerts` `meta.total`; the fetch is lazy + cached and
 * **degrades silently to a plain bell** (no badge) on error or while the CC module is
 * unbuilt (`built:false`) — it never blocks the shell. Links to `/cost-control/alerts`.
 */
export function AlertsBell({ role }: { role: Role }) {
  const visible = showsAlertsBell(role);
  const ccBuilt = costControlBuilt();
  // Only hit the endpoint when the bell is shown AND the CC module has shipped.
  const { count } = useAlertCount(visible && ccBuilt);

  if (!visible) return null;

  const showBadge = ccBuilt && typeof count === "number" && count > 0;

  return (
    <Link
      href="/cost-control/alerts"
      data-testid="alerts-bell"
      aria-label={showBadge ? `Over-budget alerts (${count})` : "Over-budget alerts"}
      className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-border-strong hover:bg-canvas hover:text-foreground"
    >
      <Bell className="h-[17px] w-[17px]" aria-hidden />
      {showBadge && (
        <span
          data-testid="alerts-badge"
          className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
