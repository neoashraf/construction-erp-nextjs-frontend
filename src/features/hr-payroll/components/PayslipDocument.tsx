import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { type Payslip } from "../types";
import { displayMoney } from "../lib";
import { PAYROLL_PERIOD } from "../seed/payroll";

const isBn = (s: string) => /[ঀ-৿]/.test(s);

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/** One earnings/deductions line: label left, amount right (tabular). */
function LineItem({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "green" | "red";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-1.5",
        strong && "mt-1 border-t border-border pt-2.5",
      )}
    >
      <span
        className={cn(
          "text-[12.5px]",
          strong ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[13px] tabular-nums",
          strong ? "font-bold" : "font-medium",
          tone === "green" && strong && "text-success-ink",
          tone === "red" && strong && "text-destructive-ink",
          !tone && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The printable payslip "paper" (FR-HR-017; Payslip.dc.html). System-generated from
 * the immutable salary lines captured at posting — masthead, employee block, a
 * two-column earnings / deductions grid, the net-pay band, and a footer note. Pure
 * presentational; the surrounding screen supplies the record + actions.
 */
export function PayslipDocument({ payslip }: { payslip: Payslip }) {
  const totalEarnings = displayMoney(
    (Number(payslip.grossAmount) + Number(payslip.allowances)).toFixed(4),
  );
  return (
    <div
      className="mx-auto w-full max-w-[780px] rounded-[6px] border border-border-strong bg-surface px-8 py-9 shadow-sm sm:px-11"
      data-testid="payslip-document"
    >
      {/* A. Masthead */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary pb-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-11 w-11 flex-none place-items-center rounded-[8px] bg-accent text-[13px] font-bold text-accent-foreground">
            ZE
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">Zakir Enterprise</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Construction ERP · Dhaka, Bangladesh
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[1.5px] text-muted-foreground">Payslip</div>
          <div className="text-[15px] font-bold text-foreground">{payslip.periodLabel}</div>
          <div className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
            {safeDate(PAYROLL_PERIOD.periodStart)} – {safeDate(PAYROLL_PERIOD.periodEnd)}
          </div>
        </div>
      </div>

      {/* B. Employee identity */}
      <div className="grid grid-cols-1 gap-4 border-b border-border py-4 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Employee
          </div>
          <div
            className={cn(
              "mt-0.5 text-[16px] font-bold text-foreground",
              isBn(payslip.name) && "font-sans",
            )}
          >
            {payslip.name}
          </div>
          <div className="text-[12.5px] text-muted-foreground">{payslip.designation}</div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:justify-items-end">
          <Meta label="Employee code" value={payslip.employeeCode} mono />
          <Meta label="Paid days" value={`${payslip.paidDays} / ${payslip.workingDays}`} mono />
        </div>
      </div>

      {/* C. Earnings / deductions */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 py-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-success-ink">
            Earnings
          </div>
          <LineItem label="Gross salary" value={displayMoney(payslip.grossAmount)} />
          <LineItem label="Allowances" value={displayMoney(payslip.allowances)} />
          <LineItem label="Total earnings" value={totalEarnings} strong tone="green" />
        </div>
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-destructive-ink">
            Deductions
          </div>
          <LineItem label="TDS" value={displayMoney(payslip.tds)} />
          <LineItem label="Provident Fund (PF)" value={displayMoney(payslip.pf)} />
          <LineItem label="Advance recovery" value={displayMoney(payslip.advanceRecovery)} />
          <LineItem label="Other deductions" value={displayMoney(payslip.otherDeductions)} />
          <LineItem
            label="Total deductions"
            value={displayMoney(payslip.totalDeductions)}
            strong
            tone="red"
          />
        </div>
      </div>

      {/* D. Net pay band */}
      <div className="rounded-[10px] border border-[color:var(--color-accent-soft)] bg-accent-soft px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-accent-ink">
              Net pay
            </div>
            <div className="mt-0.5 text-[12.5px] text-accent-ink/80">{payslip.netInWords}</div>
          </div>
          <div className="font-mono text-[27px] font-bold tabular-nums text-accent-ink">
            {displayMoney(payslip.netAmount)}
          </div>
        </div>
      </div>

      {/* E. Footer note */}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-3 border-t border-dashed border-border-strong pt-3.5">
        <p className="max-w-[80%] text-[11px] leading-relaxed text-faint">
          System-generated from the posted {payslip.periodLabel} salary sheet. Figures reflect the
          salary lines captured at posting and match the general ledger to the same precision.
        </p>
        <span className="font-mono text-[10.5px] tabular-nums text-faint">
          Posted {safeDate(PAYROLL_PERIOD.postedOn)}
        </span>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 text-[13.5px] text-foreground", mono && "font-mono tabular-nums")}>
        {value}
      </div>
    </div>
  );
}
