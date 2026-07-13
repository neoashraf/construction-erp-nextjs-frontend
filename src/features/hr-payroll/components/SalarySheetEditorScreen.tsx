"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Decimal from "decimal.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useSalaryRun } from "../hooks/useSalarySheets";
import { type DraftLine } from "../seed/salary-sheet";
import { displayMoney, displayMoneyBare } from "../lib";
import { SalaryStatusBadge } from "./SalaryStatusBadge";
import { PostRunDialog, ReverseRunDialog, BalancedPill } from "./SalaryDialogs";
import { SalaryBulkApply } from "./SalaryBulkApply";

const isBn = (s: string) => /[ঀ-৿]/.test(s);
const LIST_PATH = "/hr/salary-sheets";

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/** Editable deduction/allowance amounts, keyed by line id (the DRAFT working copy). */
type Edits = Record<string, Partial<Record<"allowances" | "tds" | "pf" | "advanceRecovery" | "otherDeductions", string>>>;

const D = (v: string) => new Decimal(v || "0");

function lineNet(l: DraftLine, e: Edits[string] | undefined): Decimal {
  const allow = D(e?.allowances ?? l.allowances);
  const tds = D(e?.tds ?? l.tds);
  const pf = D(e?.pf ?? l.pf);
  const adv = D(e?.advanceRecovery ?? l.advanceRecovery);
  const other = D(e?.otherDeductions ?? l.otherDeductions);
  return D(l.grossAmount).plus(allow).minus(tds).minus(pf).minus(adv).minus(other);
}

/**
 * Salary-sheet editor / viewer (FR-HR-014/015/018; Salary Sheet.dc.html). A DRAFT run
 * is fully editable (allowances · TDS · PF · advance · other per line), with a live
 * totals footer, KPI tiles, bulk-apply and a balanced posting preview → Post. A POSTED
 * run is read-only with a ledger link → View payslips / Reverse. Backed by the seed.
 */
export function SalarySheetEditorScreen({ id }: { id: string }) {
  const session = useSession();
  const { toast } = useToast();
  const canPost = session ? hasGrant(session, "hr.salary_sheets", "POST") : false;

  const { run, lines, reversedBy } = useSalaryRun(id);
  const [edits, setEdits] = useState<Edits>({});
  const [posting, setPosting] = useState(false);
  const [reversing, setReversing] = useState(false);

  const isDraft = run?.status === "DRAFT";
  const isPosted = run?.status === "POSTED";
  const isReversed = run?.status === "REVERSED";

  function setField(
    id: string,
    field: "allowances" | "tds" | "pf" | "advanceRecovery" | "otherDeductions",
    value: string,
  ) {
    const clean = value.replace(/[^\d.]/g, "");
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: clean } }));
  }

  function applyBulk(field: "allowances" | "tds" | "pf" | "advanceRecovery", value: string, scope: string) {
    const v = new Decimal(value || "0");
    let count = 0;
    setEdits((prev) => {
      const next = { ...prev };
      for (const l of lines) {
        if (scope !== "all" && l.projectName !== scope) continue;
        if (field === "pf" && !l.pfApplicable) continue;
        const amt =
          field === "tds"
            ? D(l.grossAmount).times(v).dividedBy(100).toDecimalPlaces(0).toFixed(4)
            : v.toFixed(4);
        next[l.id] = { ...next[l.id], [field]: amt };
        count += 1;
      }
      return next;
    });
    return count;
  }

  // Live aggregates.
  const totals = useMemo(() => {
    let gross = new Decimal(0), allow = new Decimal(0), tds = new Decimal(0);
    let pf = new Decimal(0), adv = new Decimal(0), other = new Decimal(0), net = new Decimal(0);
    for (const l of lines) {
      const e = edits[l.id];
      gross = gross.plus(l.grossAmount);
      allow = allow.plus(e?.allowances ?? l.allowances);
      tds = tds.plus(e?.tds ?? l.tds);
      pf = pf.plus(e?.pf ?? l.pf);
      adv = adv.plus(e?.advanceRecovery ?? l.advanceRecovery);
      other = other.plus(e?.otherDeductions ?? l.otherDeductions);
      net = net.plus(lineNet(l, e));
    }
    const earnings = gross.plus(allow);
    const deductions = tds.plus(pf).plus(adv).plus(other);
    return { gross, allow, tds, pf, adv, other, net, earnings, deductions };
  }, [lines, edits]);

  const postLines = useMemo(() => {
    const employerPf = totals.pf; // mirror employer PF = employee PF
    const lines_ = [
      { side: "DR" as const, account: "Gross Salary — Staff", amount: totals.earnings.toFixed(4) },
      { side: "DR" as const, account: "Employer PF Contribution", amount: employerPf.toFixed(4) },
      { side: "CR" as const, account: "Salary Payable", amount: totals.net.toFixed(4) },
      { side: "CR" as const, account: "TDS Payable", amount: totals.tds.toFixed(4) },
      { side: "CR" as const, account: "PF Payable", amount: totals.pf.plus(employerPf).toFixed(4) },
      { side: "CR" as const, account: "Advance Recovery", amount: totals.adv.toFixed(4) },
    ];
    if (totals.other.greaterThan(0))
      lines_.push({ side: "CR", account: "Other Deductions Payable", amount: totals.other.toFixed(4) });
    return lines_;
  }, [totals]);
  const postTotal = totals.earnings.plus(totals.pf).toFixed(4);

  if (!run) {
    return (
      <div className="mx-auto max-w-6xl">
        <Link href={LIST_PATH} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Salary sheet
        </Link>
        <div className="mt-4">
          <EmptyState
            title="Salary run not found."
            description="This period may not have a run yet."
            action={
              <Button asChild variant="outline">
                <Link href={LIST_PATH}>Back to salary sheet</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Salary sheet", href: LIST_PATH }, { label: run.periodLabel }]} />

      {/* header + tiles */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[23px] font-bold tracking-[-0.01em]">{run.periodLabel}</h1>
            <SalaryStatusBadge status={run.status} upper />
          </div>
          <div className="mt-1.5 text-[12.5px] text-muted-foreground">
            Salary run · {safeDate(run.periodStart)} – {safeDate(run.periodEnd)} · All projects
          </div>
          {run.salaryEntryNo && (
            <div className="mt-1 text-[12.5px] text-muted-foreground">
              Ledger entry{" "}
              <span className="font-mono font-semibold text-accent-ink">{run.salaryEntryNo}</span>
              {isReversed && reversedBy && (
                <>
                  {" · "}
                  <Badge tone="neutral">Reversed by</Badge>{" "}
                  <span className="font-mono font-semibold text-accent-ink">{reversedBy}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Tile label="Gross earnings" value={displayMoney(totals.earnings.toFixed(4))} />
          <Tile label="Deductions" value={`− ${displayMoney(totals.deductions.toFixed(4))}`} tone="red" />
          <Tile label="Net payable" value={displayMoney(totals.net.toFixed(4))} tone="accent" />
        </div>
      </div>

      {/* action bar */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] text-muted-foreground">
          {isDraft && "Editable draft — allowances & deductions per line, or apply in bulk below."}
          {isPosted && "Posted run — locked. Corrections require a reversal."}
          {isReversed && "This run has been reversed. Generate a corrected sheet fresh."}
        </span>
        <div className="ml-auto flex gap-2.5">
          {isDraft && canPost && (
            <>
              <Button variant="outline" size="md" onClick={() => toast("Changes saved.", "success")}>
                Save changes
              </Button>
              <Button size="md" onClick={() => setPosting(true)} data-testid="post-run">
                Post
              </Button>
            </>
          )}
          {(isPosted || isReversed) && (
            <>
              <Button
                variant="outline"
                size="md"
                asChild
              >
                <Link href="/hr/payslips">View payslips</Link>
              </Button>
              <Button
                variant="outline"
                size="md"
                className={cn(
                  "border-destructive/40 text-destructive-ink hover:bg-destructive-soft",
                  isReversed && "pointer-events-none opacity-50",
                )}
                title={isReversed ? "This salary run has already been reversed." : undefined}
                onClick={() => canPost && !isReversed && setReversing(true)}
                disabled={isReversed || !canPost}
              >
                Reverse
              </Button>
            </>
          )}
        </div>
      </div>

      {/* lines table */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface-2">
              <tr className="border-b border-border-strong text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Th className="text-left">Employee</Th>
                <Th className="hidden text-left lg:table-cell">Project</Th>
                <Th className="hidden text-left xl:table-cell">Cost ctr</Th>
                <Th className="text-right">Paid d</Th>
                <Th className="text-right">Gross ৳</Th>
                <Th className="text-right">Allow. ৳</Th>
                <Th className="text-right">TDS ৳</Th>
                <Th className="text-right">PF ৳</Th>
                <Th className="text-right">Adv. ৳</Th>
                <Th className="text-right">Other ৳</Th>
                <Th className="text-right">Net ৳</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const e = edits[l.id];
                return (
                  <tr key={l.id} className={cn("border-b border-border", !isDraft && "bg-surface-2")}>
                    <Td>
                      <Link
                        href={`/hr/employees/${l.employeeCode}`}
                        className={cn(
                          "text-[13px] font-semibold text-accent-ink hover:underline",
                          isBn(l.employeeName) && "font-sans",
                        )}
                      >
                        {l.employeeName}
                      </Link>
                      <div className="font-mono text-[11px] text-faint">{l.employeeCode}</div>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <span className="inline-flex items-center rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink">
                        {l.projectName}
                      </span>
                    </Td>
                    <Td className="hidden xl:table-cell">
                      <span className="inline-flex items-center rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink">
                        Labour
                      </span>
                    </Td>
                    <NumTd>{l.paidDays}</NumTd>
                    <NumTd>{displayMoneyBare(l.grossAmount)}</NumTd>
                    <EditCell
                      editable={isDraft}
                      focus={idx === 0}
                      value={e?.allowances ?? l.allowances}
                      onChange={(v) => setField(l.id, "allowances", v)}
                    />
                    <EditCell
                      editable={isDraft}
                      red
                      value={e?.tds ?? l.tds}
                      onChange={(v) => setField(l.id, "tds", v)}
                    />
                    {l.pfApplicable ? (
                      <EditCell
                        editable={isDraft}
                        red
                        value={e?.pf ?? l.pf}
                        onChange={(v) => setField(l.id, "pf", v)}
                      />
                    ) : (
                      <Td className="text-right">
                        <span className="text-[13px] text-border-strong" title="PF not applicable for this employee">
                          —
                        </span>
                      </Td>
                    )}
                    <EditCell
                      editable={isDraft}
                      red
                      value={e?.advanceRecovery ?? l.advanceRecovery}
                      onChange={(v) => setField(l.id, "advanceRecovery", v)}
                    />
                    <EditCell
                      editable={isDraft}
                      red
                      value={e?.otherDeductions ?? l.otherDeductions}
                      onChange={(v) => setField(l.id, "otherDeductions", v)}
                    />
                    <NumTd bold>{displayMoneyBare(lineNet(l, e).toFixed(4))}</NumTd>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 text-[12.5px]">
                <Td className="font-semibold text-foreground" colSpan={4}>
                  Totals · {run.employeeCount} employees
                </Td>
                <NumTd bold>{displayMoneyBare(totals.gross.toFixed(4))}</NumTd>
                <NumTd bold>{displayMoneyBare(totals.allow.toFixed(4))}</NumTd>
                <NumTd bold red>{displayMoneyBare(totals.tds.toFixed(4))}</NumTd>
                <NumTd bold red>{displayMoneyBare(totals.pf.toFixed(4))}</NumTd>
                <NumTd bold red>{displayMoneyBare(totals.adv.toFixed(4))}</NumTd>
                <NumTd bold red>{displayMoneyBare(totals.other.toFixed(4))}</NumTd>
                <NumTd bold>{displayMoneyBare(totals.net.toFixed(4))}</NumTd>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* draft-only bulk-apply + posting preview */}
      {isDraft && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SalaryBulkApply
            onApply={(field, value, scope) => {
              const n = applyBulk(field, value, scope);
              toast(`Changes saved — ${n} line(s) updated.`, "success");
            }}
          />
          <Card className="p-[18px]">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
                Posting preview
              </span>
              <BalancedPill />
            </div>
            <div className="overflow-hidden rounded-token border border-border">
              {postLines.map((l, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0">
                  <Badge tone={l.side === "DR" ? "success" : "destructive"}>{l.side}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                    {l.account}
                  </span>
                  <span className="font-mono text-[12.5px] tabular-nums text-foreground">
                    {displayMoneyBare(l.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-surface-2 px-3 py-2">
                <span className="text-[12px] font-semibold text-success-ink">Σ Debit = Σ Credit</span>
                <span className="font-mono text-[12.5px] font-bold tabular-nums text-success-ink">
                  {displayMoneyBare(postTotal)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-faint">
              Payslips will be available once this run is posted.
            </p>
          </Card>
        </div>
      )}

      {isDraft && (
        <div className="mt-4">
          <Alert tone="info">Inactive employees are excluded automatically.</Alert>
        </div>
      )}

      <PostRunDialog
        open={posting}
        onClose={() => setPosting(false)}
        postLines={postLines}
        postTotal={postTotal}
        grossTotal={totals.earnings.toFixed(4)}
      />
      <ReverseRunDialog
        open={reversing}
        onClose={() => setReversing(false)}
        entryNo={run.salaryEntryNo ?? ""}
      />
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "red" | "accent" }) {
  return (
    <div
      className={cn(
        "flex min-w-[120px] flex-col gap-1 rounded-card border px-3.5 py-2.5",
        tone === "accent" ? "border-[color:var(--color-accent-soft)] bg-accent-soft/50" : "border-border bg-surface",
      )}
    >
      <span
        className={cn(
          "text-[10.5px] font-semibold uppercase tracking-[0.4px]",
          tone === "accent" ? "text-accent-ink" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[18px] font-bold tabular-nums",
          tone === "red" ? "text-destructive-ink" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("h-11 px-3 align-middle", className)}>{children}</th>;
}
function Td({
  className,
  colSpan,
  children,
}: {
  className?: string;
  colSpan?: number;
  children?: React.ReactNode;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}
function NumTd({ children, bold, red }: { children: React.ReactNode; bold?: boolean; red?: boolean }) {
  return (
    <Td
      className={cn(
        "text-right font-mono text-[13px] tabular-nums",
        bold ? "font-semibold" : "font-medium",
        red ? "text-destructive-ink" : "text-foreground",
      )}
    >
      {children}
    </Td>
  );
}

function EditCell({
  editable,
  value,
  onChange,
  focus,
  red,
}: {
  editable: boolean;
  value: string;
  onChange: (v: string) => void;
  focus?: boolean;
  red?: boolean;
}) {
  if (!editable) {
    return <NumTd red={red}>{displayMoneyBare(value)}</NumTd>;
  }
  return (
    <Td className="text-right">
      <input
        value={Number(value) === 0 ? "" : String(Math.round(Number(value)))}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        inputMode="decimal"
        autoFocus={focus}
        className={cn(
          "h-8 w-[76px] rounded-token border border-border-strong bg-surface px-2 text-right font-mono text-[12.5px] tabular-nums outline-none transition-colors focus:border-accent focus:shadow-focus",
          red ? "text-destructive-ink" : "text-foreground",
        )}
      />
    </Td>
  );
}
