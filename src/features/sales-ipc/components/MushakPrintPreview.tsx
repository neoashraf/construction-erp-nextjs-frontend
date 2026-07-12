"use client";

import Decimal from "decimal.js";
import { AlertTriangle, Download, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { type Ipc } from "../types";
import { type CompanyProfile, type PartyProfile } from "../api/mushak-refs";

/**
 * Mushak 6.3 print-preview surface (spec §4/§6, FR-SAL-024; brief §5.7, Open items 2/3).
 * Renders the RPT-produced document from the already-loaded IPC + ledger data — no
 * re-entry. Statutory: legal `entryNo`, company BIN/TIN, customer name/address/TIN/BIN
 * (Bangla-safe, never truncated), certified · output VAT · AIT/TDS · retention (+ rate)
 * · advance recovered (+ rate) · currently-due · bill/due dates · certification block.
 * A missing BIN/TIN shows **"Not on file"** on-screen (never fabricated on the
 * document); a CANCELLED IPC carries the diagonal watermark + the reference-only
 * caption ("This copy is for reference only and is not a valid tax invoice.").
 * The actual PDF endpoint doesn't yet exist (brief G2) — the on-screen preview ships
 * now, the toolbar's Download stays disabled behind the RPT dependency. Print is
 * `window.print()` — the CSS hides the toolbar/chrome so only the paper prints.
 */
export function MushakPrintPreview({
  ipc,
  company,
  party,
  companyLoading,
  partyLoading,
  error,
  onClose,
}: {
  ipc: Ipc;
  company: CompanyProfile | undefined;
  party: PartyProfile | undefined;
  companyLoading: boolean;
  partyLoading: boolean;
  error: string | null;
  onClose?: () => void;
}) {
  const cancelled = ipc.status === "CANCELLED";
  const cancelledOn = ipc.postedAt ? formatDate(ipc.postedAt) : "";

  const grossValue = safeSum(ipc.certifiedAmount, ipc.outputVatAmount);
  const retentionRate = trimPct(ipc.retentionRatePct);
  const advanceRate = trimPct(ipc.advanceRatePct);

  return (
    <div className="min-h-screen bg-sidebar-hover print:bg-white" data-testid="mushak-print">
      {/* Toolbar */}
      <div className="flex h-13 flex-wrap items-center gap-3 border-b border-sidebar-border bg-sidebar px-5 py-3 print:hidden" data-testid="mushak-toolbar">
        <span className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-white">
          <Printer className="h-4 w-4 text-accent" aria-hidden />
          IPC document — Mushak 6.3
        </span>
        <span className="text-[12px] text-sidebar-muted">
          {cancelled ? "Reference copy · not a valid tax invoice" : "Preview ready · Ctrl+P to print"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-active"
            disabled
            title="PDF download coming with the RPT exporter"
            data-testid="mushak-download"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download PDF
          </Button>
          <Button
            size="sm"
            className="h-9 bg-accent text-primary hover:opacity-90"
            onClick={() => window.print()}
            data-testid="mushak-print-btn"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print
          </Button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close print preview"
              className="grid h-9 w-9 place-items-center rounded-token border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-active"
              data-testid="mushak-close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {/* Paper */}
      <div className="flex justify-center px-6 py-8 print:p-0" data-testid="mushak-paper">
        <div
          className="relative w-full max-w-[720px] overflow-hidden bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.3)] sm:p-11 print:shadow-none"
          style={{ pageBreakInside: "avoid" }}
        >
          {/* Cancelled watermark + caption */}
          {cancelled ? (
            <>
              <div
                className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center"
                aria-hidden
              >
                <div
                  className="rounded-[14px] border-[6px] px-8 py-2 text-[110px] font-extrabold uppercase tracking-[0.06em]"
                  style={{
                    transform: "rotate(-28deg)",
                    color: "rgba(224,72,77,0.11)",
                    borderColor: "rgba(224,72,77,0.13)",
                  }}
                >
                  Cancelled
                </div>
              </div>
              <Alert
                tone="destructive"
                className="relative z-[4] mb-5"
                title=""
                data-testid="mushak-cancelled-caption"
              >
                <p className="flex items-start gap-2 text-[12px] font-medium text-destructive-ink">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                  This IPC was cancelled{cancelledOn ? ` on ${cancelledOn}` : ""}. This copy is for reference only
                  and is not a valid tax invoice.
                </p>
              </Alert>
            </>
          ) : null}

          {/* Document header */}
          <header className="relative z-[2] flex flex-wrap items-start justify-between gap-6 border-b-2 border-foreground pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="grid h-[34px] w-[34px] place-items-center rounded-[7px] bg-primary font-bold text-accent">
                  ZE
                </div>
                <div className="text-[17px] font-bold tracking-[-0.01em] text-foreground">
                  {companyLoading ? <Skeleton className="h-5 w-40" /> : company?.name ?? "—"}
                </div>
              </div>
              <div className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {companyLoading ? (
                  <Skeleton className="h-3 w-64" />
                ) : (
                  <>
                    <span className="bn whitespace-pre-wrap [overflow-wrap:anywhere]">{company?.address ?? "—"}</span>
                    <br />
                    BIN: <NotOnFile value={company?.bin} testId="mushak-company-bin" /> &nbsp;·&nbsp; TIN:{" "}
                    <NotOnFile value={company?.tin} testId="mushak-company-tin" />
                  </>
                )}
              </div>
            </div>
            <div className="flex-none text-right">
              <div className="bn text-[15px] font-bold text-foreground">মূসক-৬.৩</div>
              <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Tax Invoice (VAT Challan)
              </div>
              <div className="mt-3 text-right">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.4px] text-faint">Legal IPC number</div>
                <div className="mt-0.5 font-mono text-[18px] font-bold text-foreground" data-testid="mushak-legal-no">
                  {ipc.entryNo ?? "—"}
                </div>
              </div>
            </div>
          </header>

          {/* Customer + certificate meta */}
          <div className="relative z-[2] mt-5 grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.4px] text-faint">
                Invoiced to (buyer)
              </div>
              {partyLoading ? (
                <Skeleton className="h-5 w-3/4" />
              ) : (
                <div className="bn text-[14px] font-bold leading-snug text-foreground [overflow-wrap:anywhere]" data-testid="mushak-customer-name">
                  {party?.name ?? "—"}
                </div>
              )}
              <div className="bn mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]" data-testid="mushak-customer-address">
                {partyLoading ? <Skeleton className="h-3 w-full" /> : party?.address ?? "—"}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-5">
                <div>
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-faint">TIN</span>
                  <div className="mt-0.5 font-mono text-[12px] text-foreground">
                    <NotOnFile value={party?.tin} testId="mushak-customer-tin" />
                  </div>
                </div>
                <div>
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.3px] text-faint">BIN</span>
                  <div className="mt-0.5 font-mono text-[12px] text-foreground">
                    <NotOnFile value={party?.bin} testId="mushak-customer-bin" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-l border-border pl-0 md:pl-6">
              <MetaRow label="Bill date" value={formatDate(ipc.billDate)} />
              <MetaRow label="Due date" value={formatDate(ipc.dueDate)} />
              <MetaRow label="Work completed" value={`${trimPct(ipc.workCompletedPct)}%`} />
              <MetaRow label="IPC date" value={formatDate(ipc.ipcDate)} />
            </div>
          </div>

          {/* Amounts table */}
          <div className="relative z-[2] mt-5 overflow-hidden rounded-token border border-border">
            <div className="grid grid-cols-[1fr_130px] border-b border-border bg-surface-2">
              <div className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Particulars
              </div>
              <div className="px-3.5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Amount ৳
              </div>
            </div>
            <AmountRow label="Certified amount" hint="VAT base" value={ipc.certifiedAmount} />
            <AmountRow label="Output VAT (Mushak)" hint="7.5%" value={ipc.outputVatAmount} />
            <AmountRow label="Gross certificate value" value={grossValue} strong bg="bg-surface-2" />
            <AmountRow label="Less: AIT / TDS deducted" value={ipc.aitTdsAmount} deduction />
            <AmountRow
              label="Less: Retention withheld"
              hint={retentionRate ? `${retentionRate}%` : undefined}
              value={ipc.retentionAmount}
              deduction
            />
            <AmountRow
              label="Less: Advance recovered"
              hint={advanceRate ? `${advanceRate}%` : undefined}
              value={ipc.advanceRecoveredAmount}
              deduction
            />
            <div className="grid grid-cols-[1fr_130px] border-t-2 border-foreground bg-primary text-primary-foreground" data-testid="mushak-currently-due">
              <div className="px-3.5 py-3 text-[12.5px] font-bold tracking-[0.2px]">
                Currently-due (net payable)
              </div>
              <div className="px-3.5 py-3 text-right font-mono text-[15px] font-bold tabular-nums">
                {formatMoney(ipc.currentlyDueAmount, { withSymbol: false })}
              </div>
            </div>
          </div>

          {/* Certification + signatures */}
          <div className="relative z-[2] mt-5 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[320px]">
              <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.4px] text-faint">Certification</div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Certified that the works valued above have been executed and measured as per contract, and that the
                particulars in this certificate are correct.
              </p>
            </div>
            <div className="flex gap-8">
              <SignatureLine title="Prepared by" name={ipc.postedBy ?? "—"} />
              <SignatureLine title="Authorised signatory" name={company?.name ?? "—"} />
            </div>
          </div>

          {/* Footer */}
          <footer className="relative z-[2] mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
            <span className="text-[10px] text-faint">
              System-generated from posted entry {ipc.entryNo ?? "—"} · {company?.name ?? "Zakir Enterprise"} Construction ERP
            </span>
            <span className="font-mono text-[10px] text-faint">BDT (৳) · Decimal(18,4)</span>
          </footer>
        </div>
      </div>

      {/* Error banner (generation failure) */}
      {error ? (
        <div className="mx-auto mt-3 max-w-[720px] px-6 print:hidden">
          <Alert tone="destructive" title="Couldn't generate the IPC document." data-testid="mushak-generation-error">
            <p className="text-[12.5px]">{error}</p>
          </Alert>
        </div>
      ) : null}

      {/* Print CSS: hide chrome, print only the paper full-width */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[12.5px] font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function AmountRow({
  label,
  hint,
  value,
  deduction,
  strong,
  bg,
}: {
  label: string;
  hint?: string;
  value: string;
  deduction?: boolean;
  strong?: boolean;
  bg?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[1fr_130px] border-t border-border", bg)}>
      <div className={cn("px-3.5 py-2.5 text-[12.5px] text-foreground", strong && "font-bold")}>
        {label}
        {hint ? <span className="text-[10.5px] font-normal text-faint"> · {hint}</span> : null}
      </div>
      <div
        className={cn(
          "px-3.5 py-2.5 text-right font-mono text-[12.5px] tabular-nums",
          strong ? "font-bold text-foreground" : deduction ? "text-destructive-ink" : "text-foreground",
        )}
      >
        {deduction ? "− " : ""}
        {formatMoney(value, { withSymbol: false })}
      </div>
    </div>
  );
}

function SignatureLine({ title, name }: { title: string; name: string }) {
  return (
    <div className="text-center">
      <div className="w-[120px] border-t border-foreground pt-1.5 text-[11px] font-semibold text-foreground">
        {title}
      </div>
      <div className="bn mt-0.5 text-[10.5px] text-muted-foreground [overflow-wrap:anywhere]">{name}</div>
    </div>
  );
}

function NotOnFile({ value, testId }: { value: string | null | undefined; testId?: string }) {
  if (value && value.trim() !== "") {
    return (
      <span data-testid={testId} className="font-mono text-[12px] text-foreground">
        {value}
      </span>
    );
  }
  return (
    <span
      data-testid={testId}
      className="text-[11.5px] font-medium italic text-destructive-ink"
      aria-label="Not on file"
      title="Missing statutory identifier — fix on the master record before printing the final PDF"
    >
      Not on file
    </span>
  );
}

function safeSum(a: string, b: string): string {
  try {
    return new Decimal(a).plus(b).toFixed(4);
  } catch {
    return a;
  }
}

function trimPct(v: string | null | undefined): string {
  if (!v) return "";
  if (!v.includes(".")) return v;
  const trimmed = v.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}
