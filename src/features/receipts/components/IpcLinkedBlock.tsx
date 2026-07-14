"use client";

import { AlertTriangle, FileText, Lock, User, Zap } from "lucide-react";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { type CustomerOption } from "../types";
import { type IpcDetail, type IpcSummaryForCustomer } from "../api/sales";
import { type FieldErrors, type ReceiptFormValues } from "../schemas/receipt.schema";

/**
 * §A IPC-linked block (spec §5/§7; design "Reference"). Customer is chosen first and
 * scopes the posted-IPC picker to that customer (`GET /api/sales/ipc?status=POSTED&
 * customerId=…`); picking an IPC **auto-resolves and locks** project/cost-centre/purpose
 * as read-only chips inherited from the IPC (server-confirmed, FR-REC-002/006). Empty
 * state ("No posted IPCs for this customer.") matches the design copy exactly.
 */
export function IpcLinkedBlock({
  values,
  errors,
  customers,
  postedIpcs,
  ipcsLoading,
  ipcDetail,
  ipcDetailLoading,
  projectName,
  costCentreName,
  purposeName,
  disabled,
  onChange,
}: {
  values: ReceiptFormValues;
  errors: FieldErrors;
  customers: CustomerOption[];
  postedIpcs: IpcSummaryForCustomer[];
  ipcsLoading: boolean;
  ipcDetail: IpcDetail | undefined;
  ipcDetailLoading: boolean;
  projectName: string;
  costCentreName: string;
  purposeName: string;
  disabled: boolean;
  onChange: (patch: Partial<ReceiptFormValues>) => void;
}) {
  const customerErr = errors.customerId;
  const ipcErr = errors.ipcId;

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Customer"
        required
        hint="scopes the IPC picker"
        error={customerErr}
        htmlFor="receipt-customer"
      >
        <Select
          id="receipt-customer"
          value={values.customerId}
          onChange={(e) => onChange({ customerId: e.target.value, ipcId: "" })}
          invalid={!!customerErr}
          disabled={disabled}
          data-testid="receipt-customer"
        >
          <option value="">Choose a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="Posted IPC"
        required
        hint="posted IPCs of this customer only"
        error={ipcErr}
        htmlFor="receipt-ipc"
      >
        {!values.customerId ? (
          <div
            className="rounded-card border border-dashed border-border-strong bg-surface-2 px-4 py-3 text-[12.5px] text-muted-foreground"
            data-testid="receipt-ipc-hint"
          >
            Pick a customer to see their posted IPCs.
          </div>
        ) : ipcsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : postedIpcs.length === 0 ? (
          <div data-testid="receipt-ipc-empty">
            <EmptyState
              icon={FileText}
              title="No posted IPCs for this customer."
              description="IPCs must be posted before a receipt can reference them."
            />
          </div>
        ) : (
          <Select
            id="receipt-ipc"
            value={values.ipcId}
            onChange={(e) => onChange({ ipcId: e.target.value })}
            invalid={!!ipcErr}
            disabled={disabled}
            aria-describedby={ipcErr ? "receipt-ipc-err" : undefined}
            data-testid="receipt-ipc"
          >
            <option value="">Choose a posted IPC…</option>
            {postedIpcs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.entryNo ?? `IPC #${r.ipcSeqNo}`} · currently due {formatMoneyShort(r.outstandingAmount)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {values.ipcId && (
        <div
          className="rounded-card border border-border bg-surface-2 p-3"
          data-testid="receipt-ipc-inherited"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            <Zap className="h-3 w-3" aria-hidden />
            Inherited from the selected IPC
          </div>
          {ipcDetailLoading && !ipcDetail ? (
            <div className="flex gap-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-7 w-32" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2" aria-live="polite">
              <InheritedChip label="Project" value={projectName || partialName(ipcDetail?.projectId)} />
              <InheritedChip label="Cost centre" value={costCentreName || partialName(ipcDetail?.costCentreId)} />
              <InheritedChip label="Purpose" value={purposeName || partialName(ipcDetail?.purposeId)} />
            </div>
          )}
        </div>
      )}

      {values.customerId && !ipcErr && postedIpcs.length > 0 && !values.ipcId && (
        <p className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Post is disabled until an IPC is picked.
        </p>
      )}
      {values.customerId && !values.ipcId && (
        <p className="sr-only" role="status">Waiting for IPC selection.</p>
      )}
      {values.customerId && values.ipcId && (
        <p className="sr-only" aria-live="polite">
          <User className="hidden" aria-hidden />
          {/* announced via aria-live only; keep concise */}
          IPC selected — dimensions inherited.
          <Lock className="hidden" aria-hidden />
        </p>
      )}
    </div>
  );
}

function InheritedChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      aria-readonly
      aria-label={`${label} — inherited from the selected IPC`}
      className="inline-flex items-center gap-1.5 rounded-token bg-accent-soft px-2.5 py-1 text-accent-ink"
    >
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.3px] opacity-70">{label}</span>
      <span className="text-[12px] font-semibold">{value || "—"}</span>
    </span>
  );
}

function partialName(id: string | null | undefined): string {
  return id ? `${id.slice(0, 8)} (name unavailable)` : "";
}

function formatMoneyShort(v: string): string {
  return formatMoney(v);
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 font-normal normal-case tracking-normal text-faint">· {hint}</span>}
      </label>
      {children}
      {error && (
        <p
          id={htmlFor ? `${htmlFor}-err` : undefined}
          role={error.startsWith("This IPC") ? "alert" : undefined}
          className="text-[12px] font-medium text-destructive"
          data-testid={htmlFor ? `${htmlFor}-err` : undefined}
        >
          {error}
        </p>
      )}
    </div>
  );
}
