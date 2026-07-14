"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui/select";
import { usePurchaseOrders } from "../hooks/usePoList";
import { type PurchaseOrderStatus } from "../types";

/**
 * Shared "from PO" picker (brief §Scope 2). Lists APPROVED / PARTIALLY_BILLED /
 * PARTIALLY_RECEIVED POs — the states a Bill or GRN can be raised against. Consumed by
 * `fe-purchase-bills` (from-PO defaulting) + `fe-grn-matching` (link a GRN to its PO).
 * Scoped by an optional `projectId` / `supplierId` filter (defaults to the whole company,
 * server re-checks PM scope). This is intentionally a plain native select — no combobox
 * dependency; the picker sits inside the shared field states via `components/ui/select`.
 */
export function PoPicker({
  value,
  onChange,
  projectId,
  supplierId,
  disabled,
  invalid,
  id,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  projectId?: string;
  supplierId?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const RECEIVABLE: readonly PurchaseOrderStatus[] = ["APPROVED", "PARTIALLY_BILLED", "PARTIALLY_RECEIVED"];
  const query = usePurchaseOrders({
    projectId: projectId || undefined,
    supplierId: supplierId || undefined,
    status: RECEIVABLE.join(","),
    pageSize: 500,
  });
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);

  return (
    <Select
      id={id}
      value={value}
      disabled={disabled || query.isLoading}
      invalid={invalid}
      aria-label={ariaLabel ?? "Purchase order"}
      data-testid="po-picker"
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">
        {query.isLoading ? "Loading…" : (placeholder ?? "Select a purchase order…")}
      </option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.poRefNo ?? "Draft"} · {r.status}
        </option>
      ))}
    </Select>
  );
}
