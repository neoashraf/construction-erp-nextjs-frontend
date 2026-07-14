"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Inbox, Plus, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useQuery } from "@tanstack/react-query";
import { parseDate } from "@/lib/format";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canReadPayment, canWritePayment } from "../access";
import { usePaymentList } from "../hooks/usePaymentList";
import { usePaymentMutations } from "../hooks/usePaymentMutations";
import { listAccountOptions, listPartyOptions } from "../api/masters";
import { queryKeys } from "@/lib/query/keys";
import { EMPTY_PAYMENT_FILTER, isFiltered, type PaymentFilterValues } from "../schemas/payment-filters.schema";
import { type PaymentListFilter } from "../api/payment";
import { PaymentList, type PartyMap } from "./PaymentList";
import { PaymentListFilterBar } from "./PaymentListFilterBar";
import { PaymentsSegmentedControl, type PaymentsView } from "./PaymentsSegmentedControl";
import { OutstandingView } from "./OutstandingView";
import { DeleteDraftDialog } from "./DeleteDraftDialog";

/**
 * Payments screen — one page with a segmented control over the Payments list + the
 * Outstanding view (brief §Scope; spec §4/§6/§9/§11). Read/navigate surface; the only
 * write is a hard-delete on a DRAFT row (FR-PAY-020). PM never sees this screen —
 * server re-checks regardless (spec §11). The three PAY briefs share
 * `features/payments/api/payment.ts` + types + badges + this money helper.
 */
export function PaymentListScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const { toast } = useToast();
  const canRead = canReadPayment(user);
  const canDelete = canWritePayment(user);

  const [view, setView] = useState<PaymentsView>("PAYMENTS");
  const [applied, setApplied] = useState<PaymentFilterValues>(EMPTY_PAYMENT_FILTER);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { remove } = usePaymentMutations();

  const listQuery = usePaymentList(toApi(applied, page));
  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);

  const partiesQ = useQuery({
    queryKey: queryKeys.list(
      "payments",
      "parties",
      { companyId: user.companyId, financialYearId: user.financialYearId },
      {},
    ),
    queryFn: () => listPartyOptions(),
    staleTime: 60_000,
  });
  const accountsQ = useQuery({
    queryKey: queryKeys.list(
      "payments",
      "accounts",
      { companyId: user.companyId, financialYearId: user.financialYearId },
      {},
    ),
    queryFn: () => listAccountOptions(),
    staleTime: 60_000,
  });
  const parties = useMemo(() => partiesQ.data ?? [], [partiesQ.data]);
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);

  const partyMap: PartyMap = useMemo(
    () => ({ byId: new Map(parties.map((p) => [p.id, p.name])) }),
    [parties],
  );

  if (!canRead) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 mt-1 flex items-center gap-3">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Payments</h1>
        </div>
        <Card className="p-10">
          <EmptyState
            icon={AlertCircle}
            title="You don't have access to Payments."
            description="Payments are visible to Accounts Manager and Admin only."
          />
        </Card>
      </div>
    );
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove.mutateAsync({ id: deleteTarget });
      toast("Draft payment deleted.", "success");
      setDeleteTarget(null);
    } catch (err) {
      const code = asApiError(err).code;
      const msg =
        code === "VOUCHER_POSTED_IMMUTABLE"
          ? "This payment has been posted and can no longer be deleted."
          : "Couldn't delete this draft. Please try again.";
      toast(msg, "error");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="payment-list-title">
          Payments
        </h1>
        <PaymentsSegmentedControl value={view} onChange={setView} />
        <div className="ml-auto flex items-center gap-2">
          {canDelete && (
            <Button asChild data-testid="payment-new">
              <Link href="/payments/new">
                <Plus className="h-4 w-4" aria-hidden />
                New payment
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="payment-offline-banner">
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Showing the last loaded results. Filters and New payment are disabled until you reconnect.
          </span>
        </Alert>
      )}

      {view === "PAYMENTS" ? (
        <div className="flex flex-col gap-4">
          <PaymentListFilterBar
            applied={applied}
            parties={parties}
            accounts={accounts}
            offline={!online}
            onApply={(v) => {
              setApplied(v);
              setPage(1);
            }}
            onClear={() => {
              setApplied(EMPTY_PAYMENT_FILTER);
              setPage(1);
            }}
          />

          {listQuery.isError ? (
            <Card className="p-8" data-testid="payment-list-error">
              <EmptyState
                icon={AlertCircle}
                title="Couldn't load payments. Please try again."
                action={
                  <Button size="md" onClick={() => listQuery.refetch()} data-testid="payment-list-retry">
                    Retry
                  </Button>
                }
              />
            </Card>
          ) : rows.length === 0 && !listQuery.isLoading ? (
            <Card className="p-8" data-testid="payment-list-empty">
              <EmptyState
                icon={Inbox}
                title={isFiltered(applied) ? "No payments match the selected filters." : "No payments yet."}
                description={isFiltered(applied) ? undefined : "New payments will appear here once you record them."}
                action={
                  isFiltered(applied) ? (
                    <Button
                      size="md"
                      variant="outline"
                      onClick={() => {
                        setApplied(EMPTY_PAYMENT_FILTER);
                        setPage(1);
                      }}
                      data-testid="payment-list-clear-filters"
                    >
                      Clear filters
                    </Button>
                  ) : canDelete ? (
                    <Button size="md" asChild>
                      <Link href="/payments/new">
                        <Plus className="h-4 w-4" aria-hidden />
                        New payment
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <PaymentList
              rows={rows}
              isLoading={listQuery.isLoading}
              parties={partyMap}
              canDelete={canDelete}
              onDelete={(id) => setDeleteTarget(id)}
              deletingId={deleting ? deleteTarget : null}
            />
          )}
        </div>
      ) : (
        <OutstandingView parties={parties} />
      )}

      <DeleteDraftDialog
        open={!!deleteTarget}
        busy={deleting}
        onConfirm={onDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
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

function toApi(f: PaymentFilterValues, page: number): PaymentListFilter {
  return {
    entryNo: f.entryNo || undefined,
    partyId: f.partyId || undefined,
    paymentAccountId: f.paymentAccountId || undefined,
    payableType: f.payableType || undefined,
    status: f.status.length > 0 ? f.status.join(",") : undefined,
    paymentMode: f.paymentMode.length > 0 ? f.paymentMode.join(",") : undefined,
    dateFrom: apiDate(f.dateFrom),
    dateTo: apiDate(f.dateTo),
    page,
  };
}
