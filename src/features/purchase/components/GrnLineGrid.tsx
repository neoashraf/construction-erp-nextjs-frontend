"use client";

import { useMemo } from "react";
import { Package } from "lucide-react";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money, moneyWithSymbol } from "../format";
import { MatchStatusBadge } from "./MatchStatusBadge";
import { OnHandBadge } from "./OnHandBadge";
import {
  computeGrnTotals,
  previewMatch,
  type GrnFormValues,
  type GrnLineError,
} from "../schemas/grn.schema";
import {
  type CostCentreOption,
  type GodownOption,
  type ItemOption,
  type PurchaseMatchStatus,
  type PurposeOption,
} from "../types";

/**
 * GRN line grid (brief §Scope 4; spec §5). Lines pre-fill from the referenced
 * PO/Bill's **open** (unreceived) quantities and cannot be added/removed here —
 * the Store Keeper only edits the **received qty** (plus dimensions if they
 * differ). Layout matches the design file: item + godown heading, ordered/billed
 * reference at left, received qty input (large touch-friendly) in the middle,
 * rate + received value at right. Below each line: dimensions + on-hand badge +
 * a client-preview match delta pill ("−10 short", "Exact", "+200 over"). No
 * ordered/billed input — those are read-only reference values. Every input
 * shares the design-system focus + error states.
 */
export function GrnLineGrid({
  lines,
  items,
  costCentres,
  purposes,
  godowns,
  purposesLoading,
  errors,
  disabled,
  readOnly = false,
  projectSelected,
  onLineChange,
  onAddPurpose,
  onChooseAnother,
}: {
  lines: GrnFormValues["lines"];
  items: ItemOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  purposesLoading: boolean;
  errors: GrnLineError[];
  disabled: boolean;
  /**
   * Posted / read-only presentation: received qty renders as a static value box
   * and the dimensions as static chips (matching the posted-GRN artboard), instead
   * of a live input + native selects. The editable draft path ignores this.
   */
  readOnly?: boolean;
  projectSelected: boolean;
  onLineChange: (index: number, patch: Partial<GrnFormValues["lines"][number]>) => void;
  onAddPurpose: (name: string) => void;
  onChooseAnother?: () => void;
}) {
  const totals = useMemo(() => computeGrnTotals(lines), [lines]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const godownById = useMemo(() => new Map(godowns.map((g) => [g.id, g])), [godowns]);

  if (lines.length === 0) {
    return (
      <div
        className="flex flex-col items-center rounded-card border-2 border-dashed border-border bg-surface-2/50 p-8 text-center"
        data-testid="grn-lines-empty"
      >
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Package className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-[15px] font-semibold text-foreground">
          Nothing left to receive on this reference.
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every line on this PO/Bill has already been fully received.
        </p>
        {onChooseAnother && (
          <Button
            size="md"
            className="mt-4"
            onClick={onChooseAnother}
            data-testid="grn-lines-empty-choose"
          >
            Choose a different PO or Bill
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="grn-line-grid">
      {/* ≥lg data grid — one row per line, expandable dimension footer */}
      <div className="hidden overflow-hidden rounded-card border border-border bg-surface shadow-sm lg:block">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border bg-surface px-4 py-3">
          <span className="text-[13px] font-semibold text-foreground">Received lines</span>
          <span className="text-[12px] text-faint">
            pre-filled from the PO&apos;s open / unreceived quantities
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden />
            On-hand = live stock read · context only
          </span>
        </div>
        <div
          role="row"
          className="grid gap-2 border-b border-border-strong bg-surface-2 px-4 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          style={{
            gridTemplateColumns: "30px minmax(200px,1.7fr) 118px 172px 104px 138px",
          }}
        >
          <div className="py-3" aria-hidden />
          <div className="py-3">Item</div>
          <div className="py-3 text-right">Ordered / Billed</div>
          <div className="py-3 text-success-ink">Received qty</div>
          <div className="py-3 text-right">Rate ৳</div>
          <div className="py-3 text-right">Received value ৳</div>
        </div>
        {lines.map((line, i) => (
          <GrnLineRowDesktop
            key={i}
            index={i}
            line={line}
            item={itemById.get(line.itemId)}
            godown={godownById.get(line.godownId)}
            costCentres={costCentres}
            purposes={purposes}
            godowns={godowns}
            purposesLoading={purposesLoading}
            error={errors[i] ?? {}}
            disabled={disabled}
            readOnly={readOnly}
            projectSelected={projectSelected}
            receivedValue={totals.perLine[i] ?? "0.0000"}
            onChange={(patch) => onLineChange(i, patch)}
            onAddPurpose={onAddPurpose}
          />
        ))}
        <div
          className="flex items-center justify-between bg-surface-2 px-4 py-3 text-[12px]"
          data-testid="grn-line-total"
        >
          <span className="text-faint">
            {lines.length} line{lines.length === 1 ? "" : "s"} · received quantity may be less than,
            equal to, or greater than the reference — never blocked.
          </span>
          <span className="text-muted-foreground">
            Total received value{" "}
            <span className="font-mono font-bold tabular-nums text-foreground">
              {moneyWithSymbol(totals.total)}
            </span>
          </span>
        </div>
      </div>

      {/* <lg stacked per-line cards — warehouse-floor / mobile use */}
      <div className="lg:hidden">
        <div className="mb-2 mt-0.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Received lines · {lines.length}
        </div>
        <div className="flex flex-col gap-3">
        {lines.map((line, i) => (
          <GrnLineCardMobile
            key={i}
            index={i}
            line={line}
            item={itemById.get(line.itemId)}
            godown={godownById.get(line.godownId)}
            costCentres={costCentres}
            purposes={purposes}
            godowns={godowns}
            purposesLoading={purposesLoading}
            error={errors[i] ?? {}}
            disabled={disabled}
            readOnly={readOnly}
            projectSelected={projectSelected}
            receivedValue={totals.perLine[i] ?? "0.0000"}
            onChange={(patch) => onLineChange(i, patch)}
            onAddPurpose={onAddPurpose}
          />
        ))}
        </div>
      </div>
    </div>
  );
}

// ── Per-line row (desktop) ────────────────────────────────────────────────────
function GrnLineRowDesktop(props: LineRowProps) {
  const {
    index,
    line,
    item,
    godown,
    costCentres,
    purposes,
    godowns,
    purposesLoading,
    error,
    disabled,
    readOnly,
    projectSelected,
    receivedValue,
    onChange,
    onAddPurpose,
  } = props;
  const reference = line.orderedQty || line.billedQty || "0";
  const preview = previewMatch(reference, line.receivedQty);
  const costCentreName = costCentres.find((c) => c.id === line.costCentreId)?.name ?? "—";
  const purposeName = purposes.find((p) => p.id === line.purposeId)?.name ?? "—";
  const poLineNote = item?.uom
    ? `Unit: ${item.uom} · from PO line ${index + 1}`
    : `from PO line ${index + 1}`;

  return (
    <div className="border-b border-muted bg-surface last:border-b-0">
      <div
        className="grid items-start gap-2 px-4 pb-1 pt-3.5"
        style={{ gridTemplateColumns: "30px minmax(200px,1.7fr) 118px 172px 104px 138px" }}
      >
        {/* leading row index */}
        <div className="pt-2.5 text-[12px] font-semibold text-faint tabular-nums">{index + 1}</div>

        <div className="min-w-0 px-2 py-1">
          <div className="text-[13.5px] font-semibold leading-[1.35] text-foreground [overflow-wrap:anywhere]">
            {item ? `${item.name}` : line.itemId || "(item unavailable)"}
          </div>
          <div className="mt-0.5 text-[11.5px] text-faint [overflow-wrap:anywhere]">
            {poLineNote}
          </div>
        </div>

        {/* ordered / billed reference (boxed) */}
        <div className="px-2 py-1 text-right">
          <div className="flex h-[38px] items-center justify-end rounded-token border border-dashed border-border-strong bg-surface-2 px-2.5 font-mono text-[13px] tabular-nums text-muted-foreground">
            {reference}
          </div>
          <div className="mt-[3px] text-[10px] text-faint">reference</div>
        </div>

        <div className="px-2 py-1">
          {readOnly ? (
            <div
              className={cn(
                "flex h-[46px] items-center justify-between rounded-[9px] border-[1.5px] px-3",
                RECV_TONE[line.matchStatus ?? preview.status ?? "MATCHED"],
              )}
              data-testid={`grn-line-received-${index}`}
            >
              <span className="font-mono text-[16px] font-bold tabular-nums text-foreground">
                {line.receivedQty || "0"}
              </span>
              {item?.uom && <span className="text-[11px] text-faint">{item.uom}</span>}
            </div>
          ) : (
            <NumericInput
              mode="decimal"
              decimalPlaces={3}
              min="0"
              value={line.receivedQty}
              disabled={disabled}
              invalid={!!error.receivedQty}
              onChange={(e) => onChange({ receivedQty: e.target.value })}
              className="h-[46px] text-right font-mono text-[16px] font-bold tabular-nums"
              data-testid={`grn-line-received-${index}`}
              aria-label={`Received quantity, line ${index + 1}`}
            />
          )}
          {/* variance delta pill under the received box (design posted + draft) */}
          <div className="mt-[5px]">
            <DeltaPill preview={preview} status={line.matchStatus} />
          </div>
          {!readOnly && error.receivedQty && (
            <p className="mt-1 text-[11.5px] text-destructive-ink" data-testid={`grn-line-received-error-${index}`}>
              {error.receivedQty}
            </p>
          )}
        </div>

        {/* rate (boxed) */}
        <div className="px-2 py-1 text-right">
          <div className="flex h-[38px] items-center justify-end rounded-token border border-dashed border-border-strong bg-surface-2 px-2.5 font-mono text-[13px] tabular-nums text-muted-foreground">
            {line.rate ? money(line.rate) : "—"}
          </div>
        </div>

        <div className="px-2 py-1 text-right">
          <div
            className="flex h-[38px] items-center justify-end whitespace-nowrap font-mono text-[14px] font-semibold tabular-nums text-foreground"
            data-testid={`grn-line-value-${index}`}
          >
            {moneyWithSymbol(receivedValue)}
          </div>
          <div className="mt-px text-[10px] text-faint">&rarr; receiveIn</div>
        </div>
      </div>

      {/* Dimension strip — godown / cost centre / purpose + on-hand + match badge.
          Left-indented to clear the 30px index column (design posted-GRN artboard). */}
      <div className="flex flex-wrap items-center gap-2 pb-3.5 pl-[38px] pr-4 pt-0.5">
        {readOnly ? (
          <>
            <DimensionChip label="Godown" value={godown?.name ?? "—"} testid={`grn-line-godown-${index}`} />
            <DimensionChip label="Cost centre" value={costCentreName} testid={`grn-line-cc-${index}`} />
            <DimensionChip label="Purpose" value={purposeName} testid={`grn-line-purpose-${index}`} />
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          </>
        ) : (
          <>
            <LineSelect
              label="Godown"
              value={line.godownId}
              onChange={(v) => onChange({ godownId: v })}
              disabled={disabled || !projectSelected}
              invalid={!!error.godownId}
              options={godowns.filter((g) => g.isActive || g.id === line.godownId).map((g) => ({ id: g.id, label: g.name }))}
              placeholder={projectSelected ? "Select…" : "Select a project first"}
              testid={`grn-line-godown-${index}`}
              error={error.godownId}
            />
            <LineSelect
              label="Cost centre"
              value={line.costCentreId}
              onChange={(v) => onChange({ costCentreId: v })}
              disabled={disabled}
              invalid={!!error.costCentreId}
              options={costCentres.filter((c) => c.isActive || c.id === line.costCentreId).map((c) => ({ id: c.id, label: c.name }))}
              placeholder="Select…"
              testid={`grn-line-cc-${index}`}
              error={error.costCentreId}
            />
            <LineSelect
              label="Purpose"
              value={line.purposeId}
              onChange={(v) => onChange({ purposeId: v })}
              disabled={disabled || !projectSelected || purposesLoading}
              invalid={!!error.purposeId}
              options={purposes.filter((p) => p.isActive || p.id === line.purposeId).map((p) => ({ id: p.id, label: p.name }))}
              placeholder={projectSelected ? "Select…" : "Select a project first"}
              testid={`grn-line-purpose-${index}`}
              error={error.purposeId}
              onCreate={(name) => onAddPurpose(name)}
            />
          </>
        )}
        <OnHandBadge godownId={line.godownId} itemId={line.itemId} uom={item?.uom} />
        {readOnly ? (
          // Posted line: the definitive match badge flows inline after on-hand
          // (design posted-GRN artboard), wrapping below when the row is tight.
          line.matchStatus && <MatchStatusBadge status={line.matchStatus} />
        ) : (
          <div className="ml-auto flex items-center justify-end gap-2">
            {!line.matchStatus && (
              <Badge tone="neutral" className="text-[11px]" data-testid={`grn-match-resolves-${index}`}>
                Match resolves on post
              </Badge>
            )}
            <MatchPreview preview={preview} status={line.matchStatus} reference={reference} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-line card (mobile / tablet) ───────────────────────────────────────────
function GrnLineCardMobile(props: LineRowProps) {
  const {
    index,
    line,
    item,
    godown,
    costCentres,
    purposes,
    godowns,
    purposesLoading,
    error,
    disabled,
    readOnly,
    projectSelected,
    receivedValue,
    onChange,
    onAddPurpose,
  } = props;
  const reference = line.orderedQty || line.billedQty || "0";
  const preview = previewMatch(reference, line.receivedQty);
  const costCentreName = costCentres.find((c) => c.id === line.costCentreId)?.name ?? "—";
  const purposeName = purposes.find((p) => p.id === line.purposeId)?.name ?? "—";

  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3" data-testid={`grn-line-card-${index}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-foreground [overflow-wrap:anywhere]">
            {item ? item.name : line.itemId || "(item unavailable)"}
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
            {godown ? godown.name : "Godown pending"}
          </div>
        </div>
        <MatchPreview preview={preview} status={line.matchStatus} reference={reference} />
      </div>

      <div className="mt-3 grid grid-cols-[1fr_minmax(160px,auto)] gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">Received qty</div>
          <div className="text-[11px] text-muted-foreground">
            Ordered {reference} {item?.uom ?? ""}
          </div>
        </div>
        <div>
          {readOnly ? (
            <div
              className={cn(
                "flex h-12 items-center justify-between rounded-token border-[1.5px] px-3",
                RECV_TONE[line.matchStatus ?? preview.status ?? "MATCHED"],
              )}
              data-testid={`grn-line-received-mobile-${index}`}
            >
              <span className="font-mono text-[18px] font-bold tabular-nums text-foreground">
                {line.receivedQty || "0"}
              </span>
              {item?.uom && <span className="text-[11px] text-faint">{item.uom}</span>}
            </div>
          ) : (
            <NumericInput
              mode="decimal"
              decimalPlaces={3}
              min="0"
              value={line.receivedQty}
              disabled={disabled}
              invalid={!!error.receivedQty}
              onChange={(e) => onChange({ receivedQty: e.target.value })}
              className="h-12 text-right font-mono text-[18px] font-bold tabular-nums"
              data-testid={`grn-line-received-mobile-${index}`}
              aria-label={`Received quantity, line ${index + 1}`}
            />
          )}
          <div className="mt-1.5 flex justify-end">
            <DeltaPill preview={preview} status={line.matchStatus} />
          </div>
          {!readOnly && error.receivedQty && (
            <p className="mt-1 text-right text-[11.5px] text-destructive-ink">{error.receivedQty}</p>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
        <div>
          <dt className="text-faint">Rate</dt>
          <dd className="font-mono tabular-nums text-foreground">
            {line.rate ? moneyWithSymbol(line.rate) : "—"}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-faint">Received value</dt>
          <dd className="font-mono font-semibold tabular-nums text-foreground">
            {moneyWithSymbol(receivedValue)}
          </dd>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <span className="text-faint">On-hand now</span>
          <OnHandBadge godownId={line.godownId} itemId={line.itemId} uom={item?.uom} />
        </div>
      </dl>

      {!readOnly && !line.matchStatus && (
        <div className="mt-3">
          <Badge tone="neutral" className="text-[11px]" data-testid={`grn-match-resolves-mobile-${index}`}>
            Match resolves on post
          </Badge>
        </div>
      )}

      {readOnly ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <DimensionChip label="Godown" value={godown?.name ?? "—"} testid={`grn-line-godown-mobile-${index}`} />
          <DimensionChip label="Cost centre" value={costCentreName} testid={`grn-line-cc-mobile-${index}`} />
          <DimensionChip label="Purpose" value={purposeName} testid={`grn-line-purpose-mobile-${index}`} />
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          <LineSelect
            label="Godown"
            value={line.godownId}
            onChange={(v) => onChange({ godownId: v })}
            disabled={disabled || !projectSelected}
            invalid={!!error.godownId}
            options={godowns.filter((g) => g.isActive || g.id === line.godownId).map((g) => ({ id: g.id, label: g.name }))}
            placeholder={projectSelected ? "Select…" : "Select a project first"}
            testid={`grn-line-godown-mobile-${index}`}
            error={error.godownId}
          />
          <LineSelect
            label="Cost centre"
            value={line.costCentreId}
            onChange={(v) => onChange({ costCentreId: v })}
            disabled={disabled}
            invalid={!!error.costCentreId}
            options={costCentres.filter((c) => c.isActive || c.id === line.costCentreId).map((c) => ({ id: c.id, label: c.name }))}
            placeholder="Select…"
            testid={`grn-line-cc-mobile-${index}`}
            error={error.costCentreId}
          />
          <LineSelect
            label="Purpose"
            value={line.purposeId}
            onChange={(v) => onChange({ purposeId: v })}
            disabled={disabled || !projectSelected || purposesLoading}
            invalid={!!error.purposeId}
            options={purposes.filter((p) => p.isActive || p.id === line.purposeId).map((p) => ({ id: p.id, label: p.name }))}
            placeholder={projectSelected ? "Select…" : "Select a project first"}
            testid={`grn-line-purpose-mobile-${index}`}
            error={error.purposeId}
            onCreate={(name) => onAddPurpose(name)}
          />
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

interface LineRowProps {
  index: number;
  line: GrnFormValues["lines"][number];
  item: ItemOption | undefined;
  godown: GodownOption | undefined;
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  purposesLoading: boolean;
  error: GrnLineError;
  disabled: boolean;
  readOnly?: boolean;
  projectSelected: boolean;
  receivedValue: string;
  onChange: (patch: Partial<GrnFormValues["lines"][number]>) => void;
  onAddPurpose: (name: string) => void;
}

/**
 * Variance-toned border for the read-only received-qty box (design posted artboard):
 * a white box with a solid colour-toned 1.5px border — under=warning, exact=success,
 * over=info — never a tinted fill.
 */
const RECV_TONE: Record<PurchaseMatchStatus, string> = {
  MATCHED: "border-success bg-surface",
  OVER_RECEIVED: "border-info bg-surface",
  UNDER_RECEIVED: "border-warning bg-surface",
  PENDING_RECEIPT: "border-border-strong bg-surface",
};

/**
 * Static dimension chip for the posted read-only line (design posted-GRN artboard):
 * a bordered pill with an uppercase micro-label + the resolved value. No dropdown.
 */
function DimensionChip({
  label,
  value,
  testid,
}: {
  label: string;
  value: string;
  testid: string;
}) {
  return (
    <span
      className="inline-flex h-8 items-center gap-[7px] rounded-[7px] border border-border-strong bg-surface px-[9px]"
      data-testid={testid}
    >
      <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.4px] text-faint">
        {label}
      </span>
      <span className="whitespace-nowrap text-[12.5px] text-foreground">{value}</span>
    </span>
  );
}

/**
 * Variance delta pill shown under the received-qty box (design posted + draft
 * artboards): "−10 short" (warning), "Exact" (success), "+200 over" (info). Uses
 * the committed match status on a posted line, else the live client preview. Renders
 * nothing until there's a valid received qty to compare.
 */
function DeltaPill({
  preview,
  status,
}: {
  preview: ReturnType<typeof previewMatch>;
  status: GrnFormValues["lines"][number]["matchStatus"];
}) {
  // Resolve the effective variance (posted status wins over the live preview).
  const effective =
    status === "MATCHED" || preview.status === "MATCHED"
      ? "MATCHED"
      : status === "OVER_RECEIVED" || preview.status === "OVER_RECEIVED"
        ? "OVER_RECEIVED"
        : status === "UNDER_RECEIVED" || preview.status === "UNDER_RECEIVED"
          ? "UNDER_RECEIVED"
          : null;
  if (!effective) return null;
  if (effective === "MATCHED") {
    return (
      <Badge tone="success" dot className="h-[19px] px-2 text-[10.5px]" data-testid="grn-delta-pill">
        Exact
      </Badge>
    );
  }
  const sign = preview.delta > 0 ? "+" : "";
  const magnitude = preview.delta ? Math.abs(preview.delta).toFixed(3).replace(/\.?0+$/, "") : "";
  const label =
    effective === "OVER_RECEIVED"
      ? `${sign || "+"}${magnitude} over`
      : `−${magnitude} short`;
  return (
    <Badge
      tone={effective === "OVER_RECEIVED" ? "info" : "warning"}
      dot
      className="h-[19px] px-2 text-[10.5px]"
      data-testid="grn-delta-pill"
    >
      {label}
    </Badge>
  );
}

function LineSelect({
  label,
  value,
  onChange,
  disabled,
  invalid,
  options,
  placeholder,
  testid,
  error,
  onCreate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  invalid: boolean;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
  testid: string;
  error?: string;
  onCreate?: (name: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</div>
      <Select
        value={value}
        disabled={disabled}
        invalid={invalid}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__create__" && onCreate) {
            const name = window.prompt(`Create new ${label.toLowerCase()}`);
            if (name?.trim()) onCreate(name.trim());
            return;
          }
          onChange(v);
        }}
        data-testid={testid}
        aria-label={label}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        {onCreate && !disabled && <option value="__create__">+ Create new…</option>}
      </Select>
      {error && (
        <p className="mt-1 text-[11.5px] text-destructive-ink">{error}</p>
      )}
    </div>
  );
}

function MatchPreview({
  preview,
  status,
  reference,
}: {
  preview: ReturnType<typeof previewMatch>;
  status: GrnFormValues["lines"][number]["matchStatus"];
  reference: string;
}) {
  // If the server has committed a status (posted GRN), show the definitive badge.
  if (status) return <MatchStatusBadge status={status} />;
  // Otherwise show the live client preview delta if there's a valid received qty.
  if (preview.status === null) {
    return (
      <Badge tone="neutral" className={cn("text-[11.5px]")} data-testid="grn-match-preview">
        Pending receipt
      </Badge>
    );
  }
  if (preview.status === "MATCHED") {
    return (
      <Badge tone="success" dot data-testid="grn-match-preview">
        Exact
      </Badge>
    );
  }
  const sign = preview.delta > 0 ? "+" : "";
  const label = `${sign}${preview.delta.toFixed(3).replace(/\.?0+$/, "")} ${preview.status === "OVER_RECEIVED" ? "over" : "short"}`;
  return (
    <Badge tone={preview.status === "OVER_RECEIVED" ? "info" : "warning"} dot data-testid="grn-match-preview">
      {label}
    </Badge>
  );
  // reference kept for callers/testing intent; not directly rendered here.
  void reference;
}
