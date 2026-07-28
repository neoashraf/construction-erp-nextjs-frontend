"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Plus, Search, WifiOff } from "lucide-react";
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
import { canReadOpenPayables, canReadPayment, canWritePayment } from "../access";
import { usePaymentList } from "../hooks/usePaymentList";
import { usePaymentMutations } from "../hooks/usePaymentMutations";
import { listAccountOptions, listPartyOptions } from "../api/masters";
import { queryKeys } from "@/lib/query/keys";
import { EMPTY_PAYMENT_FILTER, isFiltered, type PaymentFilterValues } from "../schemas/payment-filters.schema";
import { type PaymentListFilter } from "../api/payment";
import { type PayableType } from "../types";
import { PaymentList, type PartyMap } from "./PaymentList";
import { PaymentListFilterBar } from "./PaymentListFilterBar";
import { PaymentsSegmentedControl, type PaymentsView } from "./PaymentsSegmentedControl";
import { OutstandingView } from "./OutstandingView";
import { DeleteDraftDialog } from "./DeleteDraftDialog";

/** Each view's own route — the route selects the view, not local state (spec §3). */
const ROUTE_FOR: Record<PaymentsView, string> = {
  PAYMENTS: "/payments",
  OUTSTANDING: "/payments/open-payables",
};

/**
 * Payments screen — ONE screen behind TWO nav entries / two routes (spec §3): `/payments`
 * opens the Payments list, `/payments/open-payables` opens the Outstanding view. The
 * segmented control navigates between them, so the sidebar rail and the H1 follow the
 * selected view and either view can be deep-linked, bookmarked or reloaded (FE-63).
 * Read/navigate surface; the only write is a hard-delete on a DRAFT row (FR-PAY-020).
 * PM never sees this screen — server re-checks regardless (spec §11). The three PAY
 * briefs share `features/payments/api/payment.ts` + types + badges + this money helper.
 */
export function PaymentListScreen({ initialView = "PAYMENTS" }: { initialView?: PaymentsView } = {}) {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fyLabel = "FY 2025–26";
  const canRead = canReadPayment(user);
  const canDelete = canWritePayment(user);
  const canReadOutstanding = canReadOpenPayables(user);

  // The route decides the view; state only tracks it so a tab click can render
  // immediately while the client-side navigation settles.
  const [view, setView] = useState<PaymentsView>(initialView);
  const [applied, setApplied] = useState<PaymentFilterValues>(EMPTY_PAYMENT_FILTER);
  const [page, setPage] = useState(1);
  const [outstandingCount, setOutstandingCount] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { remove } = usePaymentMutations();

  // Outstanding deep link (spec §9): `…/open-payables?partyId=&payableType=&payableId=`.
  // An unresolvable id is never an error — the view just renders unfiltered.
  const deepLink = {
    partyId: searchParams?.get("partyId") ?? "",
    payableType: (searchParams?.get("payableType") ?? "") as "" | PayableType,
    payableId: searchParams?.get("payableId") ?? "",
  };

  /** Selecting a tab NAVIGATES — the URL, the sidebar rail and the H1 all follow. */
  function changeView(next: PaymentsView) {
    if (next === view) return;
    setView(next);
    router.replace(ROUTE_FOR[next]);
  }

  const listQuery = usePaymentList(toApi(applied, page));
  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? rows.length;

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
    () => ({ byId: new Map(parties?.map((p) => [p.id, p.name])) }),
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
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          {/*
            The H1 is the page identity and it changes with the route, so announce it:
            a tab click swaps the URL under the user, and a screen reader would otherwise
            report nothing at all (spec §10).
          */}
          <h1
            className="text-[23px] font-bold tracking-[-0.02em]"
            data-testid="payment-list-title"
            aria-live="polite"
          >
            {view === "PAYMENTS" ? "Payments" : "Open payables"}
          </h1>
          <span
            className="inline-flex items-center rounded-pill bg-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground"
            data-testid="payment-list-count"
          >
            {view === "PAYMENTS"
              ? `${total} payment${total === 1 ? "" : "s"}`
              : outstandingCount === null
                ? "Outstanding"
                : `${outstandingCount} open payable${outstandingCount === 1 ? "" : "s"}`}
          </span>
        </div>
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
      <div className="mb-4">
        <PaymentsSegmentedControl
          value={view}
          onChange={changeView}
          showOutstanding={canReadOutstanding}
        />
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="payment-offline-banner">
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Showing the last loaded payments.
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
            fyLabel={fyLabel}
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
                icon={Search}
                title={isFiltered(applied) ? "No payments match the selected filters." : "No payments yet."}
                description={
                  isFiltered(applied)
                    ? "Try a wider date range or a different status."
                    : "New payments will appear here once you record them."
                }
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
        <OutstandingView
          parties={parties}
          onCount={setOutstandingCount}
          initialPartyId={deepLink.partyId}
          initialPayableType={deepLink.payableType}
          focusPayableId={deepLink.payableId}
        />
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
