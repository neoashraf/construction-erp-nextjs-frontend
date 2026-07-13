"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { asApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { usePurchaseBill } from "../hooks/useBill";
import { BillEditor } from "./BillEditor";
import { BillViewer } from "./BillViewer";
import type { BillFormValues } from "../schemas/bill.schema";
import type { PurchaseBill } from "../types";

function isoToUi(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDate(iso);
  } catch {
    return "";
  }
}

/**
 * Build the editor-shape form from a saved bill (used by the viewer's Repost path —
 * an identity repost of the posted figures with a reason; the user can cancel then
 * re-enter with different figures if they need a true correction).
 */
function billToForm(bill: PurchaseBill): BillFormValues {
  return {
    projectId: bill.projectId,
    supplierId: bill.supplierId,
    purchaseOrderId: bill.purchaseOrderId ?? "",
    supplierInvoiceRef: bill.supplierInvoiceRef ?? "",
    billDate: isoToUi(bill.billDate),
    dueDate: isoToUi(bill.dueDate),
    narration: bill.narration ?? "",
    lines: bill.lines.map((l) => ({
      isStockLine: l.isStockLine,
      itemId: l.itemId ?? "",
      expenseAccountId: l.expenseAccountId ?? "",
      billedQty: l.billedQty ?? "",
      rate: l.rate ?? "",
      vatInputAmount: l.vatInputAmount ?? "0",
      tdsAmount: l.tdsAmount ?? "0",
      aitAmount: l.aitAmount ?? "0",
      godownId: l.godownId ?? "",
      costCentreId: l.costCentreId ?? "",
      purposeId: l.purposeId ?? "",
      receivedQty: l.receivedQty,
      matchStatus: l.matchStatus,
    })),
  };
}

/**
 * Client dispatch for `/purchase/bills/{id}` — the shared query decides which surface
 * renders: the editor while `DRAFT` (or `id="new"`), the viewer once `POSTED`/`CANCELLED`
 * (brief §Scope 1; FR-PUR-024). The Repost form (viewer) is built by re-opening the
 * saved bill's fields in the same shape the editor uses — the ref bridges the two
 * without a second network read.
 */
export function BillDetailDispatch({ billId }: { billId: string | null }) {
  const router = useRouter();
  const isNew = billId === null;
  const query = usePurchaseBill(billId);

  if (isNew) {
    return <BillEditor billId={null} />;
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="flex flex-col gap-4 p-5" data-testid="bill-dispatch-loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      </div>
    );
  }

  if (query.isError) {
    const e = asApiError(query.error);
    const msg =
      e.code === "FORBIDDEN"
        ? "You don't have access to this bill."
        : e.code === "NOT_FOUND"
          ? "This bill doesn't exist or isn't in your company."
          : "This bill could not be loaded.";
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb
          items={[
            { label: "Purchase" },
            { label: "Purchase bills", href: "/purchase/bills" },
            { label: "Bill" },
          ]}
        />
        <Alert tone="destructive" title={msg} className="mt-4" data-testid="bill-dispatch-error">
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push("/purchase/bills")}>
              Back to bills
            </Button>
            <Button size="sm" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!query.data) return null;

  if (query.data.status === "DRAFT") {
    return <BillEditor billId={billId} />;
  }

  return (
    <BillViewer
      bill={query.data}
      repostFormBuilder={() => billToForm(query.data)}
    />
  );
}
