"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Inbox, Plus, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { parseDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canReadVoucher, canWriteVoucher } from "../access";
import { useVoucherList, type UnifiedListFilter } from "../hooks/useVoucherList";
import {
  EMPTY_VOUCHER_FILTER,
  isFiltered,
  type VoucherFilterValues,
} from "../schemas/voucher-list-filter.schema";
import { VoucherListFilterBar } from "./VoucherListFilterBar";
import { VoucherList } from "./VoucherList";

/**
 * Contra & Journal — voucher list surface (brief FE-48; spec §4/§6/§9/§11). One page
 * over two API roots, filtered by the type chip. Read-only — never posts, reverses, or
 * edits (all lifecycle actions live on the sibling editor/opening/viewer screens).
 * "New contra" / "New journal" CTAs are hidden without `contra:write` / `journal:write`;
 * "New opening" is intentionally never offered here (the opening journal has its own
 * one-shot wizard).
 */
export function VoucherListScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const canRead = canReadVoucher(user);
  const canWrite = canWriteVoucher(user);

  const [applied, setApplied] = useState<VoucherFilterValues>(EMPTY_VOUCHER_FILTER);
  const [page, setPage] = useState(1);

  const listQuery = useVoucherList(toApi(applied, page));
  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);

  if (!canRead) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 mt-1 flex items-center gap-3">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Contra & Journal vouchers</h1>
        </div>
        <Card className="p-10" data-testid="voucher-list-403">
          <EmptyState
            icon={AlertCircle}
            title="You don't have access to Contra & Journal vouchers."
            description="This screen is visible to Accounts Manager and Admin only."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Vouchers" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="voucher-list-title">
          Contra & Journal vouchers
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {canWrite && (
            <>
              <Button variant="outline" asChild data-testid="voucher-new-contra">
                <Link href="/contra-journal/vouchers/new?type=contra">
                  <Plus className="h-4 w-4" aria-hidden />
                  New contra
                </Link>
              </Button>
              <Button asChild data-testid="voucher-new-journal">
                <Link href="/contra-journal/vouchers/new?type=journal">
                  <Plus className="h-4 w-4" aria-hidden />
                  New journal
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="voucher-offline">
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Showing the last loaded results. Apply and New are disabled until you reconnect.
          </span>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <VoucherListFilterBar
          applied={applied}
          offline={!online}
          onApply={(v) => {
            setApplied(v);
            setPage(1);
          }}
          onClear={() => {
            setApplied(EMPTY_VOUCHER_FILTER);
            setPage(1);
          }}
        />

        {listQuery.isError ? (
          <Card className="p-8" data-testid="voucher-list-error">
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load vouchers. Please try again."
              action={
                <Button size="md" onClick={() => listQuery.refetch()} data-testid="voucher-list-retry">
                  Retry
                </Button>
              }
            />
          </Card>
        ) : rows.length === 0 && !listQuery.isLoading ? (
          <Card className="p-8" data-testid="voucher-list-empty">
            <EmptyState
              icon={Inbox}
              title={isFiltered(applied) ? "No vouchers match these filters." : "No contra or journal vouchers yet."}
              description={
                isFiltered(applied)
                  ? undefined
                  : "New contra or journal vouchers will appear here once you record them."
              }
              action={
                isFiltered(applied) ? (
                  <Button
                    size="md"
                    variant="outline"
                    onClick={() => {
                      setApplied(EMPTY_VOUCHER_FILTER);
                      setPage(1);
                    }}
                    data-testid="voucher-list-clear-filters"
                  >
                    Clear filters
                  </Button>
                ) : canWrite ? (
                  <div className="flex gap-2">
                    <Button size="md" variant="outline" asChild>
                      <Link href="/contra-journal/vouchers/new?type=contra">New contra</Link>
                    </Button>
                    <Button size="md" asChild>
                      <Link href="/contra-journal/vouchers/new?type=journal">New journal</Link>
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <VoucherList rows={rows} isLoading={listQuery.isLoading} />
        )}
      </div>
    </div>
  );
}

function apiDate(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const d = parseDate(v);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return undefined;
  }
}

function toApi(f: VoucherFilterValues, page: number): UnifiedListFilter {
  return {
    type: f.type,
    status: f.status.length > 0 ? f.status.join(",") : undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    entryNo: f.entryNo || undefined,
    accountId: f.accountId || undefined,
    partyId: f.partyId || undefined,
    projectId: f.projectId || undefined,
    page,
  };
}
