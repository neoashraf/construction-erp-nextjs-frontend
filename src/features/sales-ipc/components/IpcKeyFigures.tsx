import Decimal from "decimal.js";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type Ipc } from "../types";

/**
 * IPC viewer key-figures strip (spec §4/§5, brief §5.3). Eight tiles: certified · output
 * VAT · AIT/TDS · retention (+ effective rate) · advance recovered (+ effective rate) ·
 * currently-due · outstanding · retention held. Every figure is `Decimal(18,4)` — the
 * viewer never client-rounds. Deductions render in the `destructive-ink` tone; the two
 * emphasised tiles (currently-due + outstanding) sit on the `accent-soft` background per
 * the design. Wraps to two rows on ≥768; on ≥1024 renders inline as an eight-wide strip.
 */
interface Figure {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
  deduction?: boolean;
}

function pct(part: string, total: string): string | undefined {
  try {
    const t = new Decimal(total);
    if (t.isZero()) return undefined;
    const p = new Decimal(part).div(t).mul(100);
    return `${p.toDecimalPlaces(2).toString()}%`;
  } catch {
    return undefined;
  }
}

export function IpcKeyFigures({ ipc }: { ipc: Ipc }) {
  const figures: Figure[] = [
    { label: "Certified", value: ipc.certifiedAmount },
    { label: "Output VAT", value: ipc.outputVatAmount },
    { label: "AIT / TDS", value: ipc.aitTdsAmount, deduction: true },
    {
      label: "Retention",
      value: ipc.retentionAmount,
      sub: ipc.retentionRatePct && ipc.retentionRatePct !== "0.0000"
        ? `${trimPct(ipc.retentionRatePct)}%`
        : pct(ipc.retentionAmount, ipc.certifiedAmount),
      deduction: true,
    },
    {
      label: "Advance recovered",
      value: ipc.advanceRecoveredAmount,
      sub: ipc.advanceRatePct && ipc.advanceRatePct !== "0.0000"
        ? `${trimPct(ipc.advanceRatePct)}%`
        : pct(ipc.advanceRecoveredAmount, ipc.certifiedAmount),
      deduction: true,
    },
    { label: "Currently-due", value: ipc.currentlyDueAmount, emphasis: true },
    { label: "Outstanding", value: ipc.outstandingAmount, emphasis: true },
    { label: "Retention held", value: ipc.retentionHeldAmount },
  ];

  return (
    <div
      className="mt-4 flex flex-wrap overflow-hidden rounded-card border border-border bg-surface shadow-sm md:grid md:grid-cols-4 lg:grid-cols-8"
      data-testid="ipc-key-figures"
    >
      {figures.map((f, i) => (
        <div
          key={f.label}
          className={cn(
            "min-w-[150px] flex-1 border-border p-4",
            i < figures.length - 1 && "border-b md:border-r",
            f.emphasis && "bg-accent-soft/40",
          )}
          data-testid={`ipc-fig-${slug(f.label)}`}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              {f.label}
            </span>
            {f.sub ? (
              <span className="rounded-pill bg-accent-soft px-1.5 py-[1px] text-[10px] font-semibold text-accent-ink">
                {f.sub}
              </span>
            ) : null}
          </div>
          <div
            className={cn(
              "mt-1.5 font-mono text-[16.5px] font-bold tabular-nums tracking-[-0.01em]",
              f.emphasis ? "text-primary" : f.deduction ? "text-destructive-ink" : "text-foreground",
            )}
            aria-label={`${f.label} ${formatMoney(f.value)}`}
          >
            {formatMoney(f.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function trimPct(v: string): string {
  if (!v.includes(".")) return v;
  const trimmed = v.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}
