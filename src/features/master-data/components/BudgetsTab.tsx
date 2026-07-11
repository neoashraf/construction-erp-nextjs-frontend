"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { asApiError } from "@/lib/api/errors";
import { formatMoney, parseMoney, toDecimal } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { type ProjectBudget } from "../types";
import { budgetSchema, type BudgetFormValues } from "../schemas/project.schema";
import { useProjectBudgets, useUpsertBudget, useRemoveBudget } from "../hooks/useProjectBudgets";
import { useCostCentres } from "../hooks/useCostCentres";
import { CostCentrePicker } from "./Pickers";

/** Budgets tab (FR-MAS-007/008; Projects.dc.html Budgets panel). Card + table + totals;
 * one row per cost centre; PUT upsert; ৳ Decimal. */
export function BudgetsTab({
  projectId,
  canManage,
  closed,
}: {
  projectId: string;
  canManage: boolean;
  closed: boolean;
}) {
  const { toast } = useToast();
  const budgetsQuery = useProjectBudgets(projectId);
  const centresQuery = useCostCentres({ pageSize: 200 });
  const upsert = useUpsertBudget(projectId);
  const remove = useRemoveBudget(projectId);
  const [removeTarget, setRemoveTarget] = useState<ProjectBudget | null>(null);
  const [editing, setEditing] = useState<ProjectBudget | null>(null);
  const [adding, setAdding] = useState(false);

  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const centreMap = useMemo(
    () => new Map((centresQuery.data?.data ?? []).map((c) => [c.id, c])),
    [centresQuery.data],
  );
  const activeCentres = centresQuery.data?.data ?? [];
  const total = useMemo(
    () => budgets.reduce((acc, b) => acc.plus(toDecimal(b.budgetedAmount)), toDecimal(0)),
    [budgets],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { costCentreId: "", budgetedAmount: "" },
  });

  // The add-form shows when explicitly adding, when editing a row, or (for a manager)
  // when the list is empty — so the empty state's CTA lands straight on the form.
  const showForm = canManage && !closed && !budgetsQuery.isError && (adding || !!editing || budgets.length === 0);

  function closeForm() {
    reset({ costCentreId: "", budgetedAmount: "" });
    setEditing(null);
    setAdding(false);
  }

  function onSubmit(values: BudgetFormValues) {
    upsert.mutate(
      {
        costCentreId: values.costCentreId,
        budgetedAmount: parseMoney(values.budgetedAmount).toFixed(4),
        version: editing?.version,
      },
      {
        onSuccess: () => {
          toast("Budget saved.", "success");
          closeForm();
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "CLOSED_PROJECT")
            toast("This project is closed — budgets can't be changed.", "error");
          else if (e.code === "CROSS_COMPANY_REFERENCE")
            setError("costCentreId", { message: "Cost centre must belong to this company." });
          else if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
            toast("This budget was changed by someone else. Reload and try again.", "error");
            budgetsQuery.refetch();
          } else if (e.isValidation)
            setError("budgetedAmount", {
              message: "Enter an amount of 0 or more (cost centre must be active).",
            });
          else if (e.code === "NETWORK_ERROR")
            toast("You're offline. Try again when reconnected.", "error");
          else toast(e.message || "Couldn't save the budget.", "error");
        },
      },
    );
  }

  function edit(b: ProjectBudget) {
    setAdding(false);
    setEditing(b);
    setValue("costCentreId", b.costCentreId);
    setValue("budgetedAmount", b.budgetedAmount);
  }

  function confirmRemove() {
    if (!removeTarget) return;
    remove.mutate(removeTarget.id, {
      onSuccess: () => {
        toast("Budget removed.", "success");
        setRemoveTarget(null);
      },
      onError: (err) => {
        const e = asApiError(err);
        toast(
          e.code === "REFERENCED_MASTER"
            ? "This budget is in use and can't be removed."
            : e.message || "Couldn't remove the budget.",
          "error",
        );
        setRemoveTarget(null);
      },
    });
  }

  const canAdd = canManage && !closed;

  return (
    <div data-testid="budgets-tab">
      {closed && (
        <div className="mb-3.5 flex items-center gap-2.5 rounded-[10px] border border-border-strong bg-muted px-3.5 py-3">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-faint" aria-hidden />
          <span className="text-[12.5px] text-muted-foreground">
            This project is closed. You can&apos;t add budgets or godowns.
          </span>
        </div>
      )}

      <div className="rounded-[11px] border border-border bg-surface shadow-sm">
        {/* card header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-[18px] py-3.5">
          <div className="flex items-baseline gap-[9px]">
            <span className="text-[14px] font-bold text-foreground">Budgets</span>
            <span className="text-[12px] text-faint">one budgeted amount per cost centre</span>
          </div>
          {canAdd && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setAdding(true);
              }}
              disabled={showForm}
              data-testid="budget-add"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add budget
            </Button>
          )}
        </div>

        {budgetsQuery.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="budgets-loading">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : budgetsQuery.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load budgets.">
              <Button size="sm" onClick={() => budgetsQuery.refetch()} data-testid="budgets-retry">
                Retry
              </Button>
            </Alert>
          </div>
        ) : budgets.length === 0 ? (
          <div className="p-[30px]" data-testid="budgets-empty">
            <div className="flex flex-col items-center rounded-[12px] border-[1.5px] border-dashed border-border-strong bg-surface-2 px-5 py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-[20px] text-accent-ink">
                ৳
              </div>
              <div className="mt-3.5 text-[14.5px] font-semibold text-foreground">
                No budgets set for this project.
              </div>
              <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                Add a budgeted amount for each cost centre to track spend.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* table header */}
            <div className="grid grid-cols-[1fr_220px_130px] border-b border-border-strong bg-surface-2">
              <div className="flex h-[42px] items-center px-[18px] text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Cost centre
              </div>
              <div className="flex h-[42px] items-center justify-end px-[18px] text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Budgeted ৳
              </div>
              <div className="h-[42px]" />
            </div>
            {/* rows */}
            {budgets.map((b) => {
              const centre = centreMap.get(b.costCentreId);
              const inactive = centre && !centre.isActive;
              return (
                <div
                  key={b.id}
                  className="grid min-h-[50px] grid-cols-[1fr_220px_130px] items-center border-b border-border hover:bg-surface-2"
                  data-testid={`budget-${b.id}`}
                >
                  <div className="flex items-center gap-2 px-[18px] py-[9px]">
                    <span
                      className={cn(
                        "text-[13.5px] font-medium",
                        inactive ? "text-faint" : "text-foreground",
                      )}
                    >
                      {centre ? `${centre.code} — ${centre.name}` : b.costCentreId}
                    </span>
                    {inactive && <span className="text-[11px] text-faint">(inactive)</span>}
                  </div>
                  <div className="px-[18px] py-[9px] text-right font-mono text-[13.5px] font-semibold tabular-nums text-foreground">
                    {formatMoney(b.budgetedAmount, { fractionDigits: 2 })}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 px-[18px] py-[9px]">
                    {canAdd && (
                      <>
                        <button
                          type="button"
                          onClick={() => edit(b)}
                          data-testid={`budget-edit-${b.id}`}
                          className="h-7 rounded-[7px] border border-border-strong bg-surface px-2.5 text-[12px] font-semibold text-foreground hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(b)}
                          data-testid={`budget-remove-${b.id}`}
                          className="h-7 rounded-[7px] border border-destructive-soft bg-surface px-2.5 text-[12px] font-semibold text-destructive-ink hover:bg-destructive-soft"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {/* totals */}
            <div className="grid min-h-[50px] grid-cols-[1fr_220px_130px] items-center rounded-b-[11px] bg-surface-2">
              <div className="px-[18px] py-[11px] text-[12px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
                Total budgeted
              </div>
              <div className="px-[18px] py-[11px] text-right font-mono text-[15px] font-bold tabular-nums text-foreground">
                {formatMoney(total, { fractionDigits: 2 })}
              </div>
              <div />
            </div>
          </>
        )}
      </div>

      {/* lime-bordered inline add/edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-3.5 rounded-[11px] border border-[#D8E8B0] bg-surface p-[18px] shadow-sm"
          data-testid="budget-form"
        >
          <div className="mb-3.5 text-[13px] font-bold text-foreground">
            {editing ? "Edit budget" : "Add budget"}
          </div>
          <div className="flex flex-wrap items-end gap-3.5">
            <div className="min-w-0 flex-[1_1_300px]">
              <Label htmlFor="budget-cc" className="mb-1.5 block text-[11px]">
                Cost centre <span className="text-destructive">*</span>
              </Label>
              <CostCentrePicker
                id="budget-cc"
                centres={activeCentres}
                invalid={!!errors.costCentreId}
                disabled={upsert.isPending || !!editing}
                {...register("costCentreId")}
              />
              <p className="mt-1.5 text-[11px] text-faint">
                Active cost centres only · duplicates upsert the existing row.
              </p>
            </div>
            <div className="min-w-0 flex-[1_1_240px]">
              <Label htmlFor="budget-amt" className="mb-1.5 block text-[11px]">
                Budgeted amount <span className="text-destructive">*</span>
              </Label>
              <MoneyInput
                id="budget-amt"
                invalid={!!errors.budgetedAmount}
                disabled={upsert.isPending}
                {...register("budgetedAmount")}
              />
            </div>
            <div className="flex flex-none gap-2.5">
              <Button type="button" variant="ghost" size="md" onClick={closeForm} disabled={upsert.isPending}>
                Cancel
              </Button>
              <Button type="submit" size="md" disabled={upsert.isPending} data-testid="budget-save">
                {upsert.isPending ? "Saving…" : editing ? "Save budget" : "Add budget"}
              </Button>
            </div>
          </div>
          {(errors.costCentreId || errors.budgetedAmount) && (
            <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="budget-error">
              {errors.costCentreId?.message ?? errors.budgetedAmount?.message}
            </p>
          )}
        </form>
      )}

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent hideClose data-testid="remove-budget-dialog">
          <DialogTitle>Remove this budget?</DialogTitle>
          <DialogDescription className="mt-2">This planning figure will be deleted.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => setRemoveTarget(null)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={confirmRemove}
              disabled={remove.isPending}
              data-testid="remove-budget-confirm"
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
