"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
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
  projectSelected,
  onLineChange,
  onAddPurpose,
}: {
  lines: GrnFormValues["lines"];
  items: ItemOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  purposesLoading: boolean;
  errors: GrnLineError[];
  disabled: boolean;
  projectSelected: boolean;
  onLineChange: (index: number, patch: Partial<GrnFormValues["lines"][number]>) => void;
  onAddPurpose: (name: string) => void;
}) {
  const totals = useMemo(() => computeGrnTotals(lines), [lines]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const godownById = useMemo(() => new Map(godowns.map((g) => [g.id, g])), [godowns]);

  if (lines.length === 0) {
    return (
      <div
        className="rounded-card border-2 border-dashed border-border bg-surface-2/50 p-8 text-center"
        data-testid="grn-lines-empty"
      >
        <p className="text-[15px] font-semibold text-foreground">
          Nothing left to receive on this reference.
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every line on this PO/Bill has already been fully received.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="grn-line-grid">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Received lines
        </h2>
        <span className="text-[11.5px] text-faint">
          {lines.length} line{lines.length === 1 ? "" : "s"} · received quantity may be less
          than, equal to, or greater than the reference — never blocked.
        </span>
      </div>

      {/* ≥lg data grid — one row per line, expandable dimension footer */}
      <div className="hidden overflow-hidden rounded-card border border-border lg:block">
        <div
          role="row"
          className="grid gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          style={{
            gridTemplateColumns: "minmax(200px,1.6fr) 130px 160px 110px 130px",
          }}
        >
          <div className="py-3">Item</div>
          <div className="py-3 text-right">Ordered / Billed</div>
          <div className="py-3 text-right">Received qty</div>
          <div className="py-3 text-right">Rate</div>
          <div className="py-3 text-right">Value ↓</div>
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
            projectSelected={projectSelected}
            receivedValue={totals.perLine[i] ?? "0.0000"}
            onChange={(patch) => onLineChange(i, patch)}
            onAddPurpose={onAddPurpose}
          />
        ))}
        <div
          className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-3 text-[12.5px]"
          data-testid="grn-line-total"
        >
          <span className="text-muted-foreground">
            {lines.length} line{lines.length === 1 ? "" : "s"} · received quantity may differ from ordered
          </span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            Total received value {formatMoney(totals.total)}
          </span>
        </div>
      </div>

      {/* <lg stacked per-line cards — warehouse-floor / mobile use */}
      <div className="flex flex-col gap-3 lg:hidden">
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
            projectSelected={projectSelected}
            receivedValue={totals.perLine[i] ?? "0.0000"}
            onChange={(patch) => onLineChange(i, patch)}
            onAddPurpose={onAddPurpose}
          />
        ))}
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
    projectSelected,
    receivedValue,
    onChange,
    onAddPurpose,
  } = props;
  const reference = line.orderedQty || line.billedQty || "0";
  const preview = previewMatch(reference, line.receivedQty);

  return (
    <div className="border-b border-muted last:border-b-0">
      <div
        className="grid items-start gap-2 px-4 py-3"
        style={{ gridTemplateColumns: "minmax(200px,1.6fr) 130px 160px 110px 130px" }}
      >
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
            {item ? `${item.name}` : line.itemId || "(item unavailable)"}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
            {godown ? godown.name : "Godown pending"}
            {item?.uom ? ` · Unit: ${item.uom}` : ""}
          </div>
        </div>

        <div className="py-1 text-right">
          <div className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
            {reference}
          </div>
          <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">reference</div>
        </div>

        <div>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={line.receivedQty}
            disabled={disabled}
            invalid={!!error.receivedQty}
            onChange={(e) => onChange({ receivedQty: e.target.value })}
            className="h-10 text-right font-mono text-[15px] font-bold tabular-nums"
            data-testid={`grn-line-received-${index}`}
            aria-label={`Received quantity, line ${index + 1}`}
          />
          {error.receivedQty && (
            <p className="mt-1 text-[11.5px] text-destructive-ink" data-testid={`grn-line-received-error-${index}`}>
              {error.receivedQty}
            </p>
          )}
        </div>

        <div className="py-1 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
          {line.rate ? formatMoney(line.rate, { withSymbol: false }) : "—"}
        </div>

        <div className="py-1 text-right">
          <div
            className="font-mono text-[14px] font-semibold tabular-nums text-foreground"
            data-testid={`grn-line-value-${index}`}
          >
            {formatMoney(receivedValue)}
          </div>
        </div>
      </div>

      {/* Dimension footer — godown / cost centre / purpose + on-hand + match preview */}
      <div className="grid items-end gap-2 border-t border-muted/60 bg-surface-2/50 px-4 py-2 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto_auto]">
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
        <OnHandBadge godownId={line.godownId} itemId={line.itemId} uom={item?.uom} />
        <MatchPreview preview={preview} status={line.matchStatus} reference={reference} />
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
    projectSelected,
    receivedValue,
    onChange,
    onAddPurpose,
  } = props;
  const reference = line.orderedQty || line.billedQty || "0";
  const preview = previewMatch(reference, line.receivedQty);

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
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={line.receivedQty}
            disabled={disabled}
            invalid={!!error.receivedQty}
            onChange={(e) => onChange({ receivedQty: e.target.value })}
            className="h-12 text-right font-mono text-[18px] font-bold tabular-nums"
            data-testid={`grn-line-received-mobile-${index}`}
            aria-label={`Received quantity, line ${index + 1}`}
          />
          {error.receivedQty && (
            <p className="mt-1 text-right text-[11.5px] text-destructive-ink">{error.receivedQty}</p>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
        <div>
          <dt className="text-faint">Rate</dt>
          <dd className="font-mono tabular-nums text-foreground">
            {line.rate ? formatMoney(line.rate) : "—"}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-faint">Received value</dt>
          <dd className="font-mono font-semibold tabular-nums text-foreground">
            {formatMoney(receivedValue)}
          </dd>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <span className="text-faint">On-hand now</span>
          <OnHandBadge godownId={line.godownId} itemId={line.itemId} uom={item?.uom} />
        </div>
      </dl>

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
  projectSelected: boolean;
  receivedValue: string;
  onChange: (patch: Partial<GrnFormValues["lines"][number]>) => void;
  onAddPurpose: (name: string) => void;
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
