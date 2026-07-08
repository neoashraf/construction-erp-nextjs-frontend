"use client";

import { useState } from "react";
import { Hash, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { SeriesTable } from "./SeriesTable";
import { SeriesEditorDrawer } from "./SeriesEditorDrawer";
import { useNumberingSeries } from "../hooks/useNumberingSeries";
import { fyLabelFromPreview } from "../schemas/numbering-series.schema";
import { type NumberingSeries } from "../types";

type DrawerState = { series: NumberingSeries; tab: "edit" | "audit" } | null;

/**
 * Numbering series admin screen (FR-NUM-001/002/013/018/019/020/021/022; spec).
 * Admin-only: non-Admins see the 403 view (spec §11) — the nav item is also hidden
 * for them, and the server re-checks every write. Read-only `lastSequence`; no
 * "Add series" CTA (auto-provision/seed, SRS §16). Full state matrix (spec §6).
 */
export function NumberingSeriesScreen() {
  const session = useSession();
  const { toast } = useToast();
  const [drawer, setDrawer] = useState<DrawerState>(null);

  // Permission-driven (FE-21): the `numbering` READ grant admits viewing; UPDATE admits
  // editing a series. Admin always has both (hasGrant special-cases ADMIN); a custom role
  // granted `numbering:READ`/`:UPDATE` in Roles & permissions gets in too. Falls back to
  // Admin-only when the session has no permission projection. Backend re-checks every call.
  const canView = session ? hasGrant(session, "numbering", "READ") : false;
  const canManage = session ? hasGrant(session, "numbering", "UPDATE") : false;

  const query = useNumberingSeries();
  const rows = query.data?.data ?? [];

  // A viewer without the numbering READ grant who reaches the URL sees the 403 view.
  if (!canView) {
    return (
      <div className="mx-auto max-w-5xl" data-testid="numbering-forbidden">
        <Breadcrumb items={[{ label: "Master Data" }, { label: "Numbering series" }]} />
        <Card className="mt-4 p-8">
          <EmptyState
            icon={Lock}
            title="You don't have permission to view numbering series."
            description="This screen is available to Admins only."
          />
        </Card>
      </div>
    );
  }

  // FY short label (e.g. "2526") from any row's server-composed preview (spec §12/§14).
  const fyShort = rows[0] ? fyLabelFromPreview(rows[0].nextNumberPreview) : "";

  async function copyNext(s: NumberingSeries) {
    try {
      await navigator.clipboard?.writeText(s.nextNumberPreview);
      toast(`Copied ${s.nextNumberPreview}.`, "success");
    } catch {
      toast("Couldn't copy the number.", "error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: "Master Data" }, { label: "Numbering series" }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Numbering series</h1>
          <p className="mt-1.5 max-w-[74ch] text-[12.5px] leading-relaxed text-muted-foreground">
            One series per company, financial year and voucher type. You can change the{" "}
            <strong className="font-semibold text-foreground">prefix</strong> and{" "}
            <strong className="font-semibold text-foreground">padding width</strong> — these
            apply to future numbers only. The last sequence and existing numbers can&rsquo;t
            be changed here, and numbers are never renumbered.
          </p>
        </div>
        {/* Active company + FY context (shell switcher scopes the list) */}
        <div className="flex flex-none items-center gap-2 rounded-token border border-border-strong bg-surface px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.4px] text-faint">
            Co
          </span>
          <span className="text-[12.5px] font-semibold text-foreground">Active company</span>
          {fyShort && (
            <>
              <span className="h-4 w-px bg-border" />
              <span className="font-mono text-[11px] font-semibold text-accent-ink">
                {fyShort}
              </span>
            </>
          )}
        </div>
      </div>

      <Card className="mt-4 flex flex-col overflow-hidden">
        <div className="min-h-0 overflow-auto">
          {query.isLoading ? (
            <div className="flex flex-col gap-2 p-4" data-testid="series-loading">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="p-4">
              <Alert tone="destructive" title="Couldn't load numbering series.">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="series-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Hash}
                title="No numbering series for this company and financial year yet."
                description="A series is created automatically the first time a voucher of each type is posted, and when a new financial year starts — you don't need to add one by hand."
              />
            </div>
          ) : (
            <SeriesTable
              series={rows}
              canManage={canManage}
              onEdit={(s) => setDrawer({ series: s, tab: "edit" })}
              onAudit={(s) => setDrawer({ series: s, tab: "audit" })}
              onCopyNext={copyNext}
            />
          )}
        </div>

        {rows.length > 0 && !query.isError && (
          <div className="flex flex-none items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12.5px] text-muted-foreground">
              {rows.length} series · FY {fyShort || "—"}
            </span>
            <span className="text-[11.5px] text-faint">
              Series auto-provision on first post · FY rollover seeds known types
            </span>
          </div>
        )}
      </Card>

      {drawer && (
        <SeriesEditorDrawer
          series={drawer.series}
          fyLabelText={fyShort ? `FY (${fyShort})` : "—"}
          initialTab={drawer.tab}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            toast("Numbering series saved. This change has been recorded in the audit log.", "success");
            query.refetch();
          }}
          onError={(m) => toast(m, "error")}
        />
      )}
    </div>
  );
}
