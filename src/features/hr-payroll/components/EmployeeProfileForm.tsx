"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { type Employee } from "../types";
import {
  WAGE_TYPE_LABEL,
  WORK_BASE_LABEL,
  displayMoneyBare,
  projectResolves,
  projectText,
  wageAmountLabel,
} from "../lib";

const isBn = (s: string) => /[ঀ-৿]/.test(s);

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/** Uppercase micro-label above a read-field. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="mb-1.5 block text-[11px]">{children}</Label>;
}

/** A read-only value shown in an input-styled box (matches the design's disabled look). */
function ReadField({
  value,
  mono,
  bn,
  muted,
  locked,
  helper,
}: {
  value: string;
  mono?: boolean;
  bn?: boolean;
  muted?: boolean;
  locked?: boolean;
  helper?: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-token border border-border-strong bg-muted px-3",
        )}
      >
        <span
          className={cn(
            "flex-1 truncate text-[13.5px]",
            mono && "font-mono tabular-nums",
            bn && "font-sans",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {value}
        </span>
        {locked && <Lock className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />}
      </div>
      {helper && <p className="mt-1.5 text-[11.5px] leading-snug text-faint">{helper}</p>}
    </div>
  );
}

/** A two-option segmented display (Work base / Wage type) — the active side highlighted. */
function Segment({ options, active }: { options: string[]; active: string }) {
  return (
    <div className="flex h-9 gap-0.5 rounded-token bg-muted p-0.5">
      {options.map((o) => (
        <span
          key={o}
          className={cn(
            "flex flex-1 items-center justify-center rounded-sm text-[12.5px] font-semibold",
            o === active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o}
        </span>
      ))}
    </div>
  );
}

/** A read-only statutory toggle reflecting the stored flag. */
function StatToggle({ label, on, description }: { label: string; on: boolean; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "relative mt-0.5 h-5 w-[34px] flex-none rounded-pill",
          on ? "bg-success" : "bg-border-strong",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm",
            on ? "right-0.5" : "left-0.5",
          )}
        />
      </span>
      <div className="min-w-0">
        <span className="text-[13.5px] font-medium text-foreground">{label}</span>
        {description && <div className="mt-0.5 text-[11.5px] leading-snug text-faint">{description}</div>}
      </div>
    </div>
  );
}

/**
 * Employee profile — the read view of the two-card form (Identity & wage · Bank &
 * statutory) from Employees.dc.html. Fields render in their disabled/locked look;
 * editing happens through the shared create/edit drawer. The bank account name/number
 * are masked on read (NFR-002); managers can reveal (mockup: local toggle only).
 */
export function EmployeeProfileForm({
  employee,
  canManage,
}: {
  employee: Employee;
  canManage: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const canReveal = canManage;
  const acctName = employee.bankAccountNameMasked ?? "—";
  const acctNo = employee.bankAccountNoMasked ?? "—";
  const shownName = revealed ? "Farzana Akter" : acctName;
  const shownNo = revealed ? "2051 0384 1177 4821" : acctNo;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* LEFT — Identity & wage */}
      <Card className="p-[18px]">
        <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
          Identity &amp; wage
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Employee code <span className="text-destructive">*</span>
              </FieldLabel>
              <ReadField
                value={employee.employeeCode}
                mono
                muted
                locked
                helper="Locked — already used in attendance or salary."
              />
            </div>
            <div>
              <FieldLabel>
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <ReadField
                value={employee.name}
                bn={isBn(employee.name)}
                helper="Bangla or English — shown on salary sheets."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Designation <span className="text-destructive">*</span>
              </FieldLabel>
              <ReadField value={employee.designation} />
            </div>
            <div>
              <FieldLabel>Department</FieldLabel>
              <ReadField value={employee.department ?? "—"} muted={!employee.department} />
            </div>
          </div>
          <div>
            <FieldLabel>Default project</FieldLabel>
            <ReadField
              value={projectText(employee.defaultProjectId)}
              muted={!projectResolves(employee.defaultProjectId)}
              helper="A default-tagging convenience only — change it with Reassign so the assignment history is kept. Never posts to the ledger."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Work base <span className="text-destructive">*</span>
              </FieldLabel>
              <Segment
                options={[WORK_BASE_LABEL.HEAD_OFFICE, WORK_BASE_LABEL.SITE]}
                active={WORK_BASE_LABEL[employee.workBase]}
              />
            </div>
            <div>
              <FieldLabel>
                Wage type <span className="text-destructive">*</span>
              </FieldLabel>
              <Segment
                options={[WAGE_TYPE_LABEL.MONTHLY, WAGE_TYPE_LABEL.DAILY]}
                active={WAGE_TYPE_LABEL[employee.wageType]}
              />
            </div>
          </div>
          <div>
            <FieldLabel>
              {wageAmountLabel(employee.wageType)} <span className="text-destructive">*</span>
            </FieldLabel>
            <div className="flex h-9 max-w-[240px] items-center rounded-token border border-border-strong bg-surface">
              <span className="flex-none border-r border-border px-2.5 text-sm font-medium text-muted-foreground">
                ৳
              </span>
              <span className="flex-1 px-3 text-right font-mono text-sm tabular-nums text-foreground">
                {displayMoneyBare(employee.wageAmount)}
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-faint">
              Label follows the wage type — “Daily rate” for daily-paid staff.
            </p>
          </div>
        </div>
      </Card>

      {/* RIGHT — Bank & statutory */}
      <Card className="p-[18px]">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
            Bank &amp; statutory
          </span>
          {canReveal ? (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="ml-auto flex h-[26px] items-center gap-1.5 rounded-token border border-border-strong bg-surface px-2.5 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {revealed ? (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              ) : (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              )}
              {revealed ? "Hide" : "Reveal"}
            </button>
          ) : (
            <span className="ml-auto text-[11px] text-faint">Masked — no reveal for your role</span>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Bank name</FieldLabel>
            <ReadField value={employee.bankName ?? "—"} muted={!employee.bankName} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Bank account name</FieldLabel>
              <ReadField value={shownName} bn={isBn(shownName)} mono={revealed} />
            </div>
            <div>
              <FieldLabel>Bank account number</FieldLabel>
              <ReadField value={shownNo} mono />
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-3">
            <StatToggle label="PF applicable" on={employee.pfApplicable} />
            <StatToggle label="Gratuity applicable" on={employee.gratuityApplicable} />
            <StatToggle
              label="WPPF applicable"
              on={employee.wppfApplicable}
              description="Applicability is pending confirmation — safe to leave off until finance confirms."
            />
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>TIN</FieldLabel>
              <ReadField value={employee.tin ?? "—"} mono muted={!employee.tin} helper="12 digits." />
            </div>
            <div>
              <FieldLabel>Joining date</FieldLabel>
              <div className="flex h-9 items-center gap-2 rounded-token border border-border-strong bg-surface px-3">
                <span className="flex-1 font-mono text-[13.5px] tabular-nums text-foreground">
                  {safeDate(employee.joiningDate)}
                </span>
                <Calendar className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
