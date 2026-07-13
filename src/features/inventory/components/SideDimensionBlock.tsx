"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useCreatePurpose } from "../hooks/useInventoryOptions";
import { type CostCentreOption, type GodownOption, type ProjectOption, type PurposeOption } from "../types";

/** The four posting dimensions of one OUT/IN side (§5.1 matrix) + its read-only rate/value. */
export interface SideValues {
  godownId: string;
  projectId: string;
  costCentreId: string;
  purposeId: string;
}
export type SideField = keyof SideValues;

const SIDE_PILL: Record<"OUT" | "IN", string> = {
  OUT: "bg-destructive-soft text-destructive-ink",
  IN: "bg-success-soft text-success-ink",
};

/**
 * One OUT/IN side of the journal (spec §4.B/§5/§7). Four required dimensions — project,
 * cost centre, godown, purpose (Purpose supports inline-create under the side's project,
 * FR-CC-003). Godowns + purposes are filtered to the side's project. Rate/Value are the
 * server-computed estimate, shown read-only + labelled "estimated — finalised at posting"
 * (FR-INV-003). Fully read-only once the journal is past DRAFT.
 */
export function SideDimensionBlock({
  side,
  values,
  errors,
  projects,
  godowns,
  costCentres,
  purposes,
  rate,
  value,
  disabled,
  onChange,
}: {
  side: "OUT" | "IN";
  values: SideValues;
  errors: Record<string, string | undefined>;
  projects: ProjectOption[];
  godowns: GodownOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  rate: string | null;
  value: string | null;
  disabled: boolean;
  onChange: (field: SideField, val: string) => void;
}) {
  const prefix = side === "OUT" ? "out" : "in";
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

  const err = (f: SideField) => errors[`${prefix}${f.charAt(0).toUpperCase()}${f.slice(1)}`];

  return (
    <div className="rounded-card border border-border p-4" data-testid={`sj-side-${side}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={cn("inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.5px]", SIDE_PILL[side])}>
          {side}
        </span>
        <div className="text-right text-[12px] text-muted-foreground">
          <span className="mr-3">
            Rate <span className="font-mono tabular-nums text-foreground">{rate ? formatMoney(rate) : "—"}</span>
          </span>
          <span>
            Value <span className="font-mono font-semibold tabular-nums text-foreground">{value ? formatMoney(value) : "—"}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Project" error={err("projectId")}>
          <Select
            invalid={!!err("projectId")}
            disabled={disabled}
            value={values.projectId}
            data-testid={`sj-${prefix}-project`}
            onChange={(e) => onChange("projectId", e.target.value)}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Cost centre" error={err("costCentreId")}>
          <Select
            invalid={!!err("costCentreId")}
            disabled={disabled}
            value={values.costCentreId}
            data-testid={`sj-${prefix}-cost-centre`}
            onChange={(e) => onChange("costCentreId", e.target.value)}
          >
            <option value="">Select a cost centre…</option>
            {costCentres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
                {c.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={side === "OUT" ? "Godown (source)" : "Godown (destination)"} error={err("godownId")}>
          <Select
            invalid={!!err("godownId")}
            disabled={disabled || !values.projectId}
            value={values.godownId}
            data-testid={`sj-${prefix}-godown`}
            onChange={(e) => onChange("godownId", e.target.value)}
          >
            <option value="">{values.projectId ? "Select a godown…" : "Pick a project first"}</option>
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Purpose" error={err("purposeId")}>
          {creatingPurpose ? (
            <div className="flex gap-2">
              <Input
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                placeholder="New purpose name"
                data-testid={`sj-${prefix}-purpose-new`}
                autoFocus
              />
              <Button type="button" size="md" onClick={addPurpose} disabled={createPurpose.isPending || !newPurpose.trim()} data-testid={`sj-${prefix}-purpose-add`}>
                {createPurpose.isPending ? "…" : "Add"}
              </Button>
              <Button type="button" size="md" variant="ghost" onClick={() => setCreatingPurpose(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                invalid={!!err("purposeId")}
                disabled={disabled || !values.projectId}
                value={values.purposeId}
                data-testid={`sj-${prefix}-purpose`}
                onChange={(e) => onChange("purposeId", e.target.value)}
              >
                <option value="">{values.projectId ? "Select a purpose…" : "Pick a project first"}</option>
                {purposes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </Select>
              {!disabled && values.projectId && (
                <Button type="button" size="md" variant="outline" className="flex-none gap-1" onClick={() => setCreatingPurpose(true)} data-testid={`sj-${prefix}-purpose-newbtn`} aria-label="Create purpose">
                  <Plus className="h-4 w-4" aria-hidden />
                  New
                </Button>
              )}
            </div>
          )}
        </Field>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-[11.5px] text-destructive-ink">{error}</p>}
    </div>
  );
}
