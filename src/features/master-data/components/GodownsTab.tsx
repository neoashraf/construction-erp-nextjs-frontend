"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { asApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { type Godown } from "../types";
import { godownSchema, type GodownFormValues } from "../schemas/project.schema";
import {
  useProjectGodowns,
  useCreateGodown,
  useUpdateGodown,
  useDeactivateGodown,
  useReactivateGodown,
} from "../hooks/useProjectGodowns";

/** Godowns tab (FR-MAS-014/015/016/033; Projects.dc.html Godowns panel). Card + table;
 * add/edit; deactivate/reactivate; ≥1-active-for-inventory hint in the header. */
export function GodownsTab({
  projectId,
  canManage,
  closed,
}: {
  projectId: string;
  canManage: boolean;
  closed: boolean;
}) {
  const { toast } = useToast();
  const query = useProjectGodowns(projectId);
  const create = useCreateGodown(projectId);
  const update = useUpdateGodown(projectId);
  const deactivate = useDeactivateGodown(projectId);
  const reactivate = useReactivateGodown(projectId);
  const [editing, setEditing] = useState<Godown | null>(null);
  const [adding, setAdding] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{
    godown: Godown;
    mode: "deactivate" | "reactivate";
  } | null>(null);
  const saving = create.isPending || update.isPending;

  const godowns = query.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<GodownFormValues>({
    resolver: zodResolver(godownSchema),
    defaultValues: { name: "", location: "" },
  });

  // Add-form shows when adding, editing, or (for a manager) when the list is empty.
  const showForm = canManage && !closed && !query.isError && (adding || !!editing || godowns.length === 0);

  function closeForm() {
    reset({ name: "", location: "" });
    setEditing(null);
    setAdding(false);
  }

  function onSubmit(values: GodownFormValues) {
    const onErr = (err: unknown) => {
      const e = asApiError(err);
      if (e.code === "DUPLICATE_NAME")
        setError("name", { message: "A godown with this name already exists for this project." });
      else if (e.code === "CLOSED_PROJECT")
        toast("This project is closed — godowns can't be added.", "error");
      else if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
        toast("This godown was changed by someone else. Reload and try again.", "error");
        query.refetch();
      } else if (e.code === "NETWORK_ERROR")
        toast("You're offline. Try again when reconnected.", "error");
      else toast(e.message || "Couldn't save the godown.", "error");
    };
    const done = () => {
      toast("Godown saved.", "success");
      closeForm();
    };
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          input: {
            name: values.name.trim(),
            location: values.location || null,
            version: editing.version,
          },
        },
        { onSuccess: done, onError: onErr },
      );
    } else {
      create.mutate(
        { name: values.name.trim(), location: values.location || null },
        { onSuccess: done, onError: onErr },
      );
    }
  }

  function edit(g: Godown) {
    setAdding(false);
    setEditing(g);
    setValue("name", g.name);
    setValue("location", g.location ?? "");
  }

  function confirmStatus() {
    if (!statusTarget) return;
    const { godown, mode } = statusTarget;
    const m = mode === "deactivate" ? deactivate : reactivate;
    m.mutate(
      { id: godown.id, version: godown.version },
      {
        onSuccess: () => {
          toast(`‘${godown.name}’ ${mode}d.`, "success");
          setStatusTarget(null);
        },
        onError: (err) => {
          const e = asApiError(err);
          toast(
            e.code === "OPTIMISTIC_LOCK_CONFLICT"
              ? "This godown was changed by someone else. Reload and try again."
              : e.message || "Couldn't update the godown.",
            "error",
          );
          if (e.code === "OPTIMISTIC_LOCK_CONFLICT") query.refetch();
          setStatusTarget(null);
        },
      },
    );
  }

  const canAdd = canManage && !closed;

  return (
    <div data-testid="godowns-tab">
      {closed && (
        <div className="mb-3.5 flex items-center gap-2.5 rounded-[10px] border border-border-strong bg-muted px-3.5 py-3">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-faint" aria-hidden />
          <span className="text-[12.5px] text-muted-foreground">
            This project is closed. You can&apos;t add budgets or godowns.
          </span>
        </div>
      )}

      <div className="rounded-[11px] border border-border bg-surface shadow-sm">
        {/* card header — the subtitle IS the ≥1-godown inventory hint */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-[18px] py-3.5">
          <div className="flex items-baseline gap-[9px]">
            <span className="text-[14px] font-bold text-foreground">Godowns</span>
            <span className="text-[12px] text-faint">
              project-scoped stores · ≥1 active required to transact inventory
            </span>
          </div>
          {canAdd && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setAdding(true);
              }}
              disabled={showForm}
              data-testid="godown-add"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add godown
            </Button>
          )}
        </div>

        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="godowns-loading">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load godowns.">
              <Button size="sm" onClick={() => query.refetch()} data-testid="godowns-retry">
                Retry
              </Button>
            </Alert>
          </div>
        ) : godowns.length === 0 ? (
          <div className="p-[30px]" data-testid="godowns-empty">
            <div className="flex flex-col items-center rounded-[12px] border-[1.5px] border-dashed border-border-strong bg-surface-2 px-5 py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-warning-soft text-[20px] text-warning-ink">
                ▣
              </div>
              <div className="mt-3.5 text-[14.5px] font-semibold text-foreground">
                No godowns yet. Add at least one before this project can hold inventory.
              </div>
              <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                Inventory vouchers need a project-scoped store to post against.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* table header */}
            <div className="grid grid-cols-[1.1fr_1.4fr_0.7fr_130px] border-b border-border-strong bg-surface-2">
              {["Name", "Location", "Status"].map((h) => (
                <div
                  key={h}
                  className="flex h-[42px] items-center px-[18px] text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
                >
                  {h}
                </div>
              ))}
              <div className="h-[42px]" />
            </div>
            {/* rows */}
            {godowns.map((g) => (
              <div
                key={g.id}
                className={cn(
                  "grid min-h-[52px] grid-cols-[1.1fr_1.4fr_0.7fr_130px] items-center border-b border-border hover:bg-surface-2",
                  !g.isActive && "opacity-60",
                )}
                data-testid={`godown-${g.id}`}
              >
                <div className="break-words px-[18px] py-2.5 text-[13.5px] font-semibold text-foreground">
                  {g.name}
                </div>
                <div className="break-words px-[18px] py-2.5 text-[12.5px] text-muted-foreground">
                  {g.location || "—"}
                </div>
                <div className="px-[18px] py-2.5">
                  {g.isActive ? (
                    <span
                      className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-success-soft px-2.5"
                      aria-label="Active godown"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                      <span className="text-[11px] font-semibold text-success-ink">Active</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-muted px-2.5"
                      aria-label="Inactive godown"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-faint" aria-hidden />
                      <span className="text-[11px] font-semibold text-muted-foreground">Inactive</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end px-[18px] py-2.5">
                  {canAdd && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => edit(g)}
                        data-testid={`godown-edit-${g.id}`}
                        className="h-7 rounded-[7px] border border-border-strong bg-surface px-2.5 text-[12px] font-semibold text-foreground hover:bg-muted"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setStatusTarget({
                            godown: g,
                            mode: g.isActive ? "deactivate" : "reactivate",
                          })
                        }
                        data-testid={`godown-toggle-${g.id}`}
                        className="h-7 rounded-[7px] border border-border-strong bg-surface px-2.5 text-[12px] font-semibold text-warning-ink hover:bg-muted"
                      >
                        {g.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* lime-bordered inline add/edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-3.5 rounded-[11px] border border-[#D8E8B0] bg-surface p-[18px] shadow-sm"
          data-testid="godown-form"
        >
          <div className="mb-3.5 text-[13px] font-bold text-foreground">
            {editing ? "Edit godown" : "Add godown"}
          </div>
          <div className="flex flex-wrap gap-3.5">
            <div className="min-w-0 flex-[1_1_260px]">
              <Label htmlFor="godown-name" className="mb-1.5 block text-[11px]">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="godown-name"
                placeholder="Store name (unique per project)"
                invalid={!!errors.name}
                disabled={saving}
                {...register("name")}
              />
              <p className="mt-1.5 text-[11px] text-faint">Must be unique within this project.</p>
            </div>
            <div className="min-w-0 flex-[1_1_300px]">
              <Label htmlFor="godown-loc" className="mb-1.5 block text-[11px]">
                Location
              </Label>
              <Textarea
                id="godown-loc"
                rows={2}
                placeholder="ঠিকানা / location (Bangla supported)"
                disabled={saving}
                {...register("location")}
              />
            </div>
          </div>
          <div className="mt-3.5 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="md" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="godown-save">
              {saving ? "Saving…" : editing ? "Save godown" : "Add godown"}
            </Button>
          </div>
          {errors.name && (
            <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="godown-error">
              {errors.name.message}
            </p>
          )}
        </form>
      )}

      <Dialog open={statusTarget !== null} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent hideClose data-testid="godown-status-dialog">
          <DialogTitle>
            {statusTarget?.mode === "deactivate"
              ? "Deactivate this godown?"
              : "Reactivate this godown?"}
          </DialogTitle>
          <DialogDescription className="mt-2">
            {statusTarget?.mode === "deactivate"
              ? "It stays on past stock movements but won't appear for new transactions."
              : "It will appear again in movement pickers."}
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => setStatusTarget(null)}
              disabled={deactivate.isPending || reactivate.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={statusTarget?.mode === "deactivate" ? "destructive" : "primary"}
              size="md"
              onClick={confirmStatus}
              disabled={deactivate.isPending || reactivate.isPending}
              data-testid="godown-status-confirm"
            >
              {statusTarget?.mode === "deactivate" ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
