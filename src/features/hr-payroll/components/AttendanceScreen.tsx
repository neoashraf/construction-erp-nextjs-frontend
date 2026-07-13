"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Lock, Plus, Trash2, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import {
  ATTENDANCE_DATE,
  DEFAULT_PROJECT,
  PURPOSES,
  DAILY_LABOUR_SEED,
  OFFICE_SEED,
  SUBCONTRACTOR_SEED,
  DAY_STATUS_META,
  type DailyLabourRow,
  type OfficeRow,
  type SubcontractorRow,
} from "../seed/attendance";
import { displayMoney, displayMoneyBare } from "../lib";
import { HeadCountStepper } from "./HeadCountStepper";
import { ConfirmAccrualDialog, ReverseAccrualDialog } from "./AttendanceDialogs";

const isBn = (s: string) => /[ঀ-৿]/.test(s);

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

type Mode = "OFFICE" | "DAILY" | "SUB";

const TABS: { key: Mode; label: string }[] = [
  { key: "OFFICE", label: "Office staff" },
  { key: "DAILY", label: "Daily labour" },
  { key: "SUB", label: "Subcontractor" },
];

/**
 * Attendance — three capture modes on one shell (FR-HR-004/005/006; Attendance.dc.html).
 * Daily labour is the only mode that touches the ledger: per-row Confirm posts a
 * Dr Labour Cost / Cr Labour Payable accrual (locked once posted; corrections are
 * reverse-and-repost). Office is a roster save (no posting); Subcontractor is head-count
 * tracking only. Confirm/Reverse are HR/Accounts-only; Site Engineer captures but can't
 * confirm. Backed by the local seed.
 */
export function AttendanceScreen() {
  const session = useSession();
  const { toast } = useToast();
  // Confirm/reverse gated on the attendance:confirm-style grant; Site Engineer lacks it.
  const canConfirm = session ? hasGrant(session, "hr.attendance", "APPROVE") : false;

  const [mode, setMode] = useState<Mode>("DAILY");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]">Attendance</h1>
        <ModePill mode={mode} />
      </div>

      {/* mode tabs */}
      <div
        role="tablist"
        aria-label="Attendance mode"
        className="mt-3 flex items-end gap-6 border-b border-border-strong"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => setMode(t.key)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-[13.5px] transition-colors",
              mode === t.key
                ? "border-primary font-semibold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "SUB" && (
        <div className="mt-4">
          <Alert tone="info">
            Tracking only — subcontractor head count has no accounting impact.
          </Alert>
        </div>
      )}

      {/* filter bar */}
      <FilterBar canConfirm={canConfirm} />

      <div className="mt-4">
        {mode === "OFFICE" && <OfficeRoster onSave={() => toast("6 entries saved.", "success")} />}
        {mode === "DAILY" && <DailyLabourGrid canConfirm={canConfirm} />}
        {mode === "SUB" && <SubcontractorGrid onSave={() => toast("3 entries saved.", "success")} />}
      </div>
    </div>
  );
}

function ModePill({ mode }: { mode: Mode }) {
  const text =
    mode === "DAILY"
      ? `${DAILY_LABOUR_SEED.length} rows · ${DAILY_LABOUR_SEED.filter((r) => !r.confirmedEntryNo).length} unconfirmed`
      : mode === "OFFICE"
        ? `${OFFICE_SEED.length} on roster`
        : `${SUBCONTRACTOR_SEED.length} rows · tracking only`;
  return (
    <span className="inline-flex h-[23px] items-center whitespace-nowrap rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
      {text}
    </span>
  );
}

function FilterBar({ canConfirm }: { canConfirm: boolean }) {
  return (
    <Card className="mt-4 p-3.5 sm:px-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-none flex-col gap-1.5">
          <FieldLabel>Date</FieldLabel>
          <div className="flex h-9 w-[150px] items-center gap-2 rounded-token border border-border-strong bg-surface px-3">
            <span className="flex-1 font-mono text-[13px] tabular-nums text-foreground">
              {safeDate(ATTENDANCE_DATE)}
            </span>
            <Calendar className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
          </div>
        </div>
        <div className="flex flex-none flex-col gap-1.5">
          <FieldLabel>Project</FieldLabel>
          <Select aria-label="Project" className="h-9 w-[200px]" defaultValue={DEFAULT_PROJECT}>
            <option>{DEFAULT_PROJECT}</option>
            <option>Tower-A — Gulshan</option>
            <option>Road-12 — Savar</option>
          </Select>
        </div>
        <div className="flex flex-none flex-col gap-1.5">
          <FieldLabel>Cost centre</FieldLabel>
          <Select aria-label="Cost centre" className="h-9 w-[160px]" defaultValue="ALL">
            <option value="ALL">All cost centres</option>
            <option>CC-01 · Earthwork</option>
            <option>CC-02 · Piling</option>
            <option>CC-05 · Deck girder</option>
          </Select>
        </div>
        {!canConfirm && (
          <span className="mb-0.5 inline-flex h-9 items-center rounded-pill bg-warning-soft px-3 text-[11.5px] font-semibold text-warning-ink">
            Assigned projects only
          </span>
        )}
        <div className="ml-auto flex items-end gap-2">
          <Button size="sm" className="h-9 px-4">
            Apply
          </Button>
          <Button size="sm" variant="ghost" className="h-9 px-2.5">
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
      {children}
    </span>
  );
}

// ── Daily labour ──────────────────────────────────────────────────────────────

function DailyLabourGrid({ canConfirm }: { canConfirm: boolean }) {
  const [rows, setRows] = useState<DailyLabourRow[]>(DAILY_LABOUR_SEED);
  const [confirmRow, setConfirmRow] = useState<DailyLabourRow | null>(null);
  const [reverseRow, setReverseRow] = useState<DailyLabourRow | null>(null);

  function setHead(id: string, head: number) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, headCount: head } : r)));
  }
  function setPurpose(id: string, purpose: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, purpose } : r)));
  }
  function markConfirmed(id: string, entryNo: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, confirmedEntryNo: entryNo } : r)));
  }
  function markReversed(id: string, reversalNo: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, reversedEntryNo: reversalNo } : r)));
  }

  const unconfirmed = rows.filter((r) => !r.confirmedEntryNo);
  const toAccrue = unconfirmed.reduce((acc, r) => acc + r.headCount * r.rate, 0);

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2">
            <tr className="border-b border-border-strong text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Th className="text-left">Cost centre</Th>
              <Th className="text-left">Labour category</Th>
              <Th className="hidden text-left lg:table-cell">Purpose</Th>
              <Th className="text-right">Head count</Th>
              <Th className="text-right">Daily rate ৳</Th>
              <Th className="text-right">Computed cost ৳</Th>
              <Th className="text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const locked = !!r.confirmedEntryNo;
              const cost = (r.headCount * r.rate).toFixed(4);
              return (
                <tr key={r.id} className={cn("border-b border-border", locked && "bg-surface-2")}>
                  <Td>
                    <span className="inline-flex items-center rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink">
                      {r.costCentre}
                    </span>
                  </Td>
                  <Td className={cn("text-[13px] text-foreground", isBn(r.category) && "font-sans")}>
                    {r.category}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    {locked ? (
                      <span className="text-[13px] text-muted-foreground">{r.purpose ?? "—"}</span>
                    ) : (
                      <PurposeSelect value={r.purpose} onChange={(p) => setPurpose(r.id, p)} />
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end">
                      <HeadCountStepper
                        value={r.headCount}
                        readOnly={locked}
                        onChange={(n) => setHead(r.id, n)}
                      />
                    </div>
                  </Td>
                  <Td className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                    {displayMoneyBare(r.rate.toFixed(4))}
                  </Td>
                  <Td className="text-right">
                    <div className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                      {displayMoneyBare(cost)}
                    </div>
                    {locked && <div className="text-[10.5px] text-faint">accrued</div>}
                  </Td>
                  <Td className="text-right">
                    {!locked ? (
                      <Button
                        size="sm"
                        onClick={() => setConfirmRow(r)}
                        disabled={!canConfirm}
                        title={
                          canConfirm ? undefined : "Only HR Manager or Accounts can confirm."
                        }
                      >
                        Confirm
                      </Button>
                    ) : r.reversedEntryNo ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge tone="neutral" dot>
                          Reversed
                        </Badge>
                        <Link
                          href="/ledger/entry-viewer"
                          className="font-mono text-[11px] text-accent-ink hover:underline"
                        >
                          {r.reversedEntryNo}
                        </Link>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-success-ink">
                          <Lock className="h-3 w-3" aria-hidden />
                          <Link href="/ledger/entry-viewer" className="font-mono hover:underline">
                            {r.confirmedEntryNo}
                          </Link>
                        </span>
                        {canConfirm && (
                          <button
                            type="button"
                            onClick={() => setReverseRow(r)}
                            className="text-[11.5px] font-semibold text-destructive-ink hover:underline"
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-[12px] text-muted-foreground">
          Confirm posts one accrual per row — Dr Labour Cost / Cr Labour Payable. Confirmed rows are
          corrected by reversal only.
        </span>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add row
        </Button>
      </div>

      {/* sticky-style summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3">
        <span className="text-[12.5px] text-muted-foreground">
          {unconfirmed.length} unconfirmed row{unconfirmed.length === 1 ? "" : "s"} ·{" "}
          <span className="font-mono tabular-nums">{displayMoney(toAccrue.toFixed(4))}</span> to
          accrue
        </span>
        <Button
          size="md"
          disabled={!canConfirm || unconfirmed.length === 0}
          title={canConfirm ? undefined : "Only HR Manager or Accounts can confirm."}
          onClick={() => unconfirmed[0] && setConfirmRow(unconfirmed[0])}
        >
          Confirm {unconfirmed.length} row{unconfirmed.length === 1 ? "" : "s"}
        </Button>
      </div>

      <ConfirmAccrualDialog
        row={confirmRow}
        onClose={() => setConfirmRow(null)}
        onConfirmed={markConfirmed}
      />
      <ReverseAccrualDialog
        row={reverseRow}
        onClose={() => setReverseRow(null)}
        onReversed={markReversed}
      />
    </Card>
  );
}

function PurposeSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <Select
      aria-label="Purpose"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-[190px] text-[12.5px]"
    >
      <option value="" disabled>
        Select purpose
      </option>
      {PURPOSES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </Select>
  );
}

// ── Office roster ─────────────────────────────────────────────────────────────

function OfficeRoster({ onSave }: { onSave: () => void }) {
  const [rows, setRows] = useState<OfficeRow[]>(OFFICE_SEED);
  const [source, setSource] = useState<"MANUAL" | "BIOMETRIC">("MANUAL");

  function cycleStatus(code: string) {
    const order: OfficeRow["dayStatus"][] = ["PRESENT", "PAID_LEAVE", "UNPAID_LEAVE", "ABSENT"];
    setRows((rs) =>
      rs.map((r) => {
        if (r.employeeCode !== code) return r;
        const next = order[(order.indexOf(r.dayStatus) + 1) % order.length]!;
        return { ...r, dayStatus: next };
      }),
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="text-[12.5px] text-muted-foreground">
          Roster — {DEFAULT_PROJECT} · {safeDate(ATTENDANCE_DATE)}
        </span>
        <div className="flex h-9 gap-0.5 rounded-token bg-muted p-0.5">
          {(["MANUAL", "BIOMETRIC"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={cn(
                "flex items-center rounded-sm px-3 text-[12.5px] font-semibold transition-colors",
                source === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "MANUAL" ? "Manual entry" : "Biometric import"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2">
            <tr className="border-b border-border-strong text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Th className="text-left">Employee</Th>
              <Th className="text-left">Check-in</Th>
              <Th className="text-left">Check-out</Th>
              <Th className="text-left">Day status</Th>
              <Th className="hidden text-right sm:table-cell">Overtime h</Th>
              <Th className="hidden text-left md:table-cell">Source</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = DAY_STATUS_META[r.dayStatus];
              const off = r.checkIn == null;
              return (
                <tr key={r.employeeCode} className="border-b border-border">
                  <Td>
                    <div className={cn("text-[13px] font-semibold text-foreground", isBn(r.name) && "font-sans")}>
                      {r.name}
                    </div>
                    <div className="font-mono text-[11px] text-faint">{r.employeeCode}</div>
                  </Td>
                  <Td>
                    <TimeChip value={r.checkIn} off={off} />
                  </Td>
                  <Td>
                    <TimeChip value={r.checkOut} off={off} />
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => cycleStatus(r.employeeCode)}
                      className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-2.5 py-1 text-[11.5px] font-semibold transition-colors hover:bg-border-strong/40"
                    >
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", {
                          "bg-success": meta.tone === "success",
                          "bg-info": meta.tone === "info",
                          "bg-warning": meta.tone === "warning",
                          "bg-destructive": meta.tone === "destructive",
                        })}
                        aria-hidden
                      />
                      <span
                        className={cn({
                          "text-success-ink": meta.tone === "success",
                          "text-info-ink": meta.tone === "info",
                          "text-warning-ink": meta.tone === "warning",
                          "text-destructive-ink": meta.tone === "destructive",
                        })}
                      >
                        {meta.label}
                      </span>
                      <ChevronDown className="h-3 w-3 text-faint" aria-hidden />
                    </button>
                  </Td>
                  <Td className="hidden text-right font-mono text-[13px] tabular-nums text-foreground sm:table-cell">
                    {r.overtimeHours}
                  </Td>
                  <Td className="hidden md:table-cell">
                    {r.source === "BIOMETRIC_IMPORT" ? (
                      <Badge tone="info">Biometric</Badge>
                    ) : (
                      <Badge tone="neutral">Manual</Badge>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-[12px] text-muted-foreground">
          Saving the roster does not post to the ledger — office attendance feeds the salary sheet.
        </span>
        <div className="flex gap-2.5">
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add row
          </Button>
          <Button size="sm" onClick={onSave} title="Bulk save — no ledger posting">
            Save entries
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TimeChip({ value, off }: { value: string | null; off?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-[64px] items-center justify-center rounded-token border px-2 font-mono text-[12px] tabular-nums",
        off ? "border-border bg-muted text-faint" : "border-border-strong bg-surface text-foreground",
      )}
    >
      {value ?? "—"}
    </span>
  );
}

// ── Subcontractor ─────────────────────────────────────────────────────────────

function SubcontractorGrid({ onSave }: { onSave: () => void }) {
  const [rows, setRows] = useState<SubcontractorRow[]>(SUBCONTRACTOR_SEED);

  function setHead(id: string, head: number) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, headCount: head } : r)));
  }
  function setPurpose(id: string, purpose: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, purpose } : r)));
  }
  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2">
            <tr className="border-b border-border-strong text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Th className="text-left">Subcontractor party</Th>
              <Th className="text-left">Cost centre</Th>
              <Th className="hidden text-left md:table-cell">Purpose</Th>
              <Th className="text-right">Head count</Th>
              <Th className="text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <Td>
                  <div className={cn("text-[13px] font-semibold text-foreground", isBn(r.partyName) && "font-sans")}>
                    {r.partyName}
                  </div>
                  <div className="font-mono text-[11px] text-faint">MAS Party · {r.partyCode}</div>
                </Td>
                <Td>
                  <span className="inline-flex items-center rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-ink">
                    {r.costCentre}
                  </span>
                </Td>
                <Td className="hidden md:table-cell">
                  <PurposeSelect value={r.purpose} onChange={(p) => setPurpose(r.id, p)} />
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end">
                    <HeadCountStepper value={r.headCount} onChange={(n) => setHead(r.id, n)} />
                  </div>
                </Td>
                <Td className="text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    aria-label={`Remove ${r.partyName}`}
                    className="grid h-7 w-7 place-items-center rounded-token text-faint transition-colors hover:bg-destructive-soft hover:text-destructive-ink"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-[12px] text-muted-foreground">
          No cost, no rate, no Confirm — head counts are saved for site records only.
        </span>
        <div className="flex gap-2.5">
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add row
          </Button>
          <Button size="sm" onClick={onSave} title="Bulk save — tracking only">
            Save entries
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── shared table cells ────────────────────────────────────────────────────────

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("h-11 px-3 align-middle", className)}>{children}</th>;
}
function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn("px-3 py-2.5 align-middle", className)}>{children}</td>;
}
