"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { asApiError } from "@/lib/api/errors";
import { formatMoney, parseMoney } from "@/lib/money";
import { useToast } from "@/components/ui/toast";
import { type ProjectBudget } from "../types";
import { budgetSchema, type BudgetFormValues } from "../schemas/project.schema";
import { useProjectBudgets, useUpsertBudget, useRemoveBudget } from "../hooks/useProjectBudgets";
import { useCostCentres } from "../hooks/useCostCentres";
import { CostCentrePicker } from "./Pickers";

/** Budgets tab (FR-MAS-007/008). One row per cost centre; PUT upsert; ৳ Decimal. */
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

  const budgets = budgetsQuery.data ?? [];
  const centreMap = useMemo(() => {
    const m = new Map((centresQuery.data?.data ?? []).map((c) => [c.id, c]));
    return m;
  }, [centresQuery.data]);
  const activeCentres = centresQuery.data?.data ?? [];

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
          reset({ costCentreId: "", budgetedAmount: "" });
          setEditing(null);
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

  return (
    <div className="flex flex-col gap-4" data-testid="budgets-tab">
      {closed && <Alert tone="warning">This project is closed — budgets are read-only.</Alert>}

      {budgetsQuery.isLoading ? (
        <div className="flex flex-col gap-2" data-testid="budgets-loading">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : budgetsQuery.isError ? (
        <Alert tone="destructive" title="Couldn't load budgets.">
          <Button size="sm" onClick={() => budgetsQuery.refetch()} data-testid="budgets-retry">
            Retry
          </Button>
        </Alert>
      ) : budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="budgets-empty">
          No budgets set for this project yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" data-testid="budgets-list">
          {budgets.map((b) => {
            const centre = centreMap.get(b.costCentreId);
            return (
              <li
                key={b.id}
                className="flex items-center justify-between py-2"
                data-testid={`budget-${b.id}`}
              >
                <span className="text-sm">
                  {centre ? `${centre.code} — ${centre.name}` : b.costCentreId}
                  {centre && !centre.isActive && (
                    <span className="ml-2 text-xs text-faint">(inactive)</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm tabular-nums">
                    {formatMoney(b.budgetedAmount)}
                  </span>
                  {canManage && !closed && (
                    <>
                      <button
                        type="button"
                        onClick={() => edit(b)}
                        className="text-xs font-semibold text-accent-ink hover:underline"
                        data-testid={`budget-edit-${b.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(b)}
                        aria-label="Remove budget"
                        data-testid={`budget-remove-${b.id}`}
                        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canManage && !closed && !budgetsQuery.isError && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
          data-testid="budget-form"
        >
          <div className="w-64">
            <Label htmlFor="budget-cc" className="mb-1.5 block text-[10.5px]">
              Cost centre <span className="text-destructive">*</span>
            </Label>
            <CostCentrePicker
              id="budget-cc"
              centres={activeCentres}
              invalid={!!errors.costCentreId}
              disabled={upsert.isPending || !!editing}
              {...register("costCentreId")}
            />
          </div>
          <div className="w-44">
            <Label htmlFor="budget-amt" className="mb-1.5 block text-[10.5px]">
              Budgeted amount <span className="text-destructive">*</span>
            </Label>
            <MoneyInput
              id="budget-amt"
              invalid={!!errors.budgetedAmount}
              disabled={upsert.isPending}
              {...register("budgetedAmount")}
            />
          </div>
          <Button type="submit" size="md" disabled={upsert.isPending} data-testid="budget-save">
            {upsert.isPending ? "Saving…" : editing ? "Update" : "Add budget"}
          </Button>
          {(errors.costCentreId || errors.budgetedAmount) && (
            <p className="w-full text-[11.5px] text-destructive-ink" data-testid="budget-error">
              {errors.costCentreId?.message ?? errors.budgetedAmount?.message}
            </p>
          )}
        </form>
      )}

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent hideClose data-testid="remove-budget-dialog">
          <DialogTitle>Remove this budget?</DialogTitle>
          <DialogDescription className="mt-2">
            The budgeted figure for this cost centre will be removed.
          </DialogDescription>
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
