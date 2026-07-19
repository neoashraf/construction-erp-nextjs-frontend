"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useCreatePurpose } from "../hooks/useInventoryOptions";
import { DimensionChip } from "./DimensionChip";
import { DimensionSelectChip, type DimensionOption } from "./DimensionSelectChip";
import { type CostCentreOption, type GodownOption, type ProjectOption, type PurposeOption } from "../types";
import { type SideValues, type SideField } from "./SideDimensionBlock";

/** grid columns per the design (mvCols): SIDE · GODOWN · DIMENSIONS · RATE · VALUE. */
const GRID = "grid-cols-[90px_minmax(0,1.1fr)_minmax(0,2.1fr)_130px_150px]";

interface SideData {
  side: "OUT" | "IN";
  values: SideValues;
  godowns: GodownOption[];
  purposes: PurposeOption[];
  onChange: (field: SideField, val: string) => void;
}

/**
 * The movement lines table (design: "Stock Journal.dc.html" editor). One card holding a
 * header row (SIDE · GODOWN · DIMENSIONS — project · cost centre · purpose · godown ·
 * RATE read-only · VALUE read-only), one row per side (OUT always; IN only for TRANSFER),
 * and a balance readout footer ("Out total = In total  ৳…  ● OUT = IN · value-neutral
 * Estimated — finalised at posting."). Dimensions render as the design's chips; project /
 * cost centre / purpose are editable through a transparent native select over each chip
 * (preserving the `sj-{side}-{dim}` test hooks), the godown chip mirrors the row's Godown
 * column select. Rate/Value are the server-computed estimate (FR-INV-003), finalised at post.
 */
export function MovementLinesTable({
  sides,
  errors,
  projects,
  costCentres,
  rate,
  value,
  balanced,
  totalLabel,
  disabled,
}: {
  sides: SideData[];
  errors: Record<string, string | undefined>;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  rate: string | null;
  value: string | null;
  /** true = TRANSFER (OUT = IN, value-neutral); false = ISSUE/ADJUSTMENT (single side). */
  balanced: boolean;
  totalLabel: string;
  disabled: boolean;
}) {
  const money = (v: string | null) => (v ? formatMoney(v, { grouping: "lakh" }) : "—");

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm" data-testid="sj-movements">
      {/* header — desktop grid only; on tablet/mobile the rows become labelled cards */}
      <div className={cn("hidden items-center border-b border-border-strong bg-surface-2 lg:grid", GRID)}>
        <HeadCell>Side</HeadCell>
        <HeadCell>Godown</HeadCell>
        <HeadCell>Dimensions — project · cost centre · purpose · godown</HeadCell>
        <HeadCell align="right">
          Rate ৳ <span className="ml-1 font-normal normal-case tracking-normal text-faint">read-only</span>
        </HeadCell>
        <HeadCell align="right">
          Value ৳ <span className="ml-1 font-normal normal-case tracking-normal text-faint">read-only</span>
        </HeadCell>
      </div>

      {/* rows */}
      {sides.map((s) => (
        <MovementRow
          key={s.side}
          data={s}
          errors={errors}
          projects={projects}
          costCentres={costCentres}
          rate={money(rate)}
          value={money(value)}
          disabled={disabled}
        />
      ))}

      {/* balance readout */}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 bg-surface-2 px-3.5 py-3" data-testid="sj-balance">
        <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{totalLabel}</span>
        <span className="text-[16px] font-bold tabular-nums text-foreground">{money(value)}</span>
        {balanced && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-success-soft px-2.5 text-[11.5px] font-semibold text-success-ink" data-testid="sj-balance-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            OUT = IN · value-neutral
          </span>
        )}
        <span className="text-[11.5px] text-faint">Estimated — finalised at posting.</span>
      </div>
    </div>
  );
}

function HeadCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      className={cn(
        "flex h-[42px] items-center whitespace-nowrap px-3.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "justify-end text-right",
      )}
    >
      {children}
    </div>
  );
}

function MovementRow({
  data,
  errors,
  projects,
  costCentres,
  rate,
  value,
  disabled,
}: {
  data: SideData;
  errors: Record<string, string | undefined>;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  rate: string;
  value: string;
  disabled: boolean;
}) {
  const { side, values, godowns, purposes, onChange } = data;
  const prefix = side === "OUT" ? "out" : "in";
  const err = (f: SideField) => errors[`${prefix}${f.charAt(0).toUpperCase()}${f.slice(1)}`];

  const createPurpose = useCreatePurpose();
  const [creatingPurpose, setCreatingPurpose] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");

  function addPurpose() {
    const name = newPurpose.trim();
    if (!name || !values.projectId) return;
    createPurpose.mutate(
      { projectId: values.projectId, name },
      {
        onSuccess: (p) => {
          onChange("purposeId", p.id);
          setCreatingPurpose(false);
          setNewPurpose("");
        },
      },
    );
  }

  // Select option labels carry the code for disambiguation while picking; the on-chip
  // display uses the design's terser form (project shows "code — name"; cost centre and
  // purpose show the name only, matching the "Stock Journal.dc.html" chip artboards).
  const projectOpts: DimensionOption[] = projects.map((p) => ({ id: p.id, label: p.projectCode ? `${p.projectCode} — ${p.name}` : p.name }));
  const ccOpts: DimensionOption[] = costCentres.map((c) => ({ id: c.id, label: c.isActive ? `${c.code} — ${c.name}` : `${c.code} — ${c.name} (inactive)` }));
  const purposeOpts: DimensionOption[] = purposes.map((p) => ({ id: p.id, label: p.isActive ? p.name : `${p.name} (inactive)` }));

  const project = projects.find((p) => p.id === values.projectId);
  const cc = costCentres.find((c) => c.id === values.costCentreId);
  const purpose = purposes.find((p) => p.id === values.purposeId);
  const godown = godowns.find((g) => g.id === values.godownId);

  const projectChip = project ? (project.projectCode ? `${project.projectCode} — ${project.name}` : project.name) : "";
  const ccChip = cc ? cc.name : "";
  const purposeChip = purpose ? purpose.name : "";

  const sidePill = (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-token px-2 text-[11px] font-bold uppercase tracking-[0.5px]",
        side === "OUT" ? "bg-destructive-soft text-destructive-ink" : "bg-success-soft text-success-ink",
      )}
    >
      {side}
    </span>
  );

  const godownSelect = (
    <Select
      className="h-[34px] text-[12.5px]"
      invalid={!!err("godownId")}
      disabled={disabled || !values.projectId}
      value={values.godownId}
      data-testid={`sj-${prefix}-godown`}
      aria-label={side === "OUT" ? "Source godown" : "Destination godown"}
      onChange={(e) => onChange("godownId", e.target.value)}
    >
      <option value="">{values.projectId ? "Select a godown…" : "Pick a project first"}</option>
      {godowns.map((g) => (
        <option key={g.id} value={g.id}>
          {g.code} — {g.name}
        </option>
      ))}
    </Select>
  );

  return (
    <div
      className={cn("flex flex-col gap-2 border-b border-border p-3.5 lg:grid lg:min-h-[64px] lg:items-center lg:gap-0 lg:p-0", GRID)}
      data-testid={`sj-side-${side}`}
    >
      {/* <lg: header line — side pill + rate/value. lg+: side pill cell. */}
      <div className="flex items-center justify-between lg:block lg:px-3.5 lg:py-2.5">
        {sidePill}
        <span className="text-[12.5px] font-semibold tabular-nums text-foreground lg:hidden">{value}</span>
      </div>

      {/* godown — labelled on small, plain cell on lg */}
      <div className="min-w-0 lg:px-3.5 lg:py-2.5">
        <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground lg:hidden">Godown</span>
        {godownSelect}
        {err("godownId") && (
          <p role="alert" className="mt-1 text-[11.5px] font-medium text-destructive-ink" data-testid={`sj-${prefix}-godown-error`}>
            {err("godownId")}
          </p>
        )}
      </div>

      {/* dimensions chips */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:px-3.5 lg:py-2.5">
        <span className="mb-1 block w-full text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground lg:hidden">
          Dimensions
        </span>
        <DimensionSelectChip
          value={values.projectId}
          displayLabel={projectChip}
          fieldLabel="Project"
          options={projectOpts}
          disabled={disabled}
          invalid={!!err("projectId")}
          testId={`sj-${prefix}-project`}
          ariaLabel="Project"
          onChange={(id) => onChange("projectId", id)}
        />
        <DimensionSelectChip
          value={values.costCentreId}
          displayLabel={ccChip}
          fieldLabel="Cost centre"
          options={ccOpts}
          disabled={disabled}
          invalid={!!err("costCentreId")}
          testId={`sj-${prefix}-cost-centre`}
          ariaLabel="Cost centre"
          onChange={(id) => onChange("costCentreId", id)}
        />
        {creatingPurpose ? (
          <span className="inline-flex items-center gap-1">
            <Input
              value={newPurpose}
              onChange={(e) => setNewPurpose(e.target.value)}
              placeholder="New purpose"
              className="h-[26px] w-32 text-[12px]"
              data-testid={`sj-${prefix}-purpose-new`}
              autoFocus
            />
            <Button type="button" size="sm" className="h-[26px] px-2" onClick={addPurpose} disabled={createPurpose.isPending || !newPurpose.trim()} data-testid={`sj-${prefix}-purpose-add`}>
              {createPurpose.isPending ? "…" : "Add"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-[26px] px-1.5" onClick={() => setCreatingPurpose(false)}>
              ✕
            </Button>
          </span>
        ) : (
          <DimensionSelectChip
            value={values.purposeId}
            displayLabel={purposeChip}
            fieldLabel="Purpose"
            options={purposeOpts}
            disabled={disabled}
            invalid={!!err("purposeId")}
            placeholderHint={values.projectId ? undefined : "Pick a project first"}
            testId={`sj-${prefix}-purpose`}
            ariaLabel="Purpose"
            allowCreate={!disabled && !!values.projectId}
            onChange={(id) => onChange("purposeId", id)}
            onRequestCreate={() => setCreatingPurpose(true)}
          />
        )}
        {/* godown mirrors the column select (display-only) — shown once a godown is picked */}
        {godown && <DimensionChip value={godown.code} label="Godown" />}
      </div>

      {/* <lg: rate line under the chips. lg+: dedicated rate + value cells. */}
      <div className="flex items-baseline justify-between lg:hidden">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Rate ৳ · Value ৳ read-only</span>
        <span className="whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-muted-foreground">{rate}</span>
      </div>
      <div className="hidden whitespace-nowrap px-3.5 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-muted-foreground lg:block">{rate}</div>
      <div className="hidden whitespace-nowrap px-3.5 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-foreground lg:block">{value}</div>
    </div>
  );
}
