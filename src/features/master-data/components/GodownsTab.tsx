"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { asApiError } from "@/lib/api/errors";
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

/** Godowns tab (FR-MAS-014/015/016/033). Add/edit; deactivate/reactivate; ≥1-for-inventory hint. */
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
      reset({ name: "", location: "" });
      setEditing(null);
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

  return (
    <div className="flex flex-col gap-4" data-testid="godowns-tab">
      <Alert tone="info">A project needs at least one godown before it can hold inventory.</Alert>
      {closed && <Alert tone="warning">This project is closed — godowns are read-only.</Alert>}

      {query.isLoading ? (
        <div className="flex flex-col gap-2" data-testid="godowns-loading">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <Alert tone="destructive" title="Couldn't load godowns.">
          <Button size="sm" onClick={() => query.refetch()} data-testid="godowns-retry">
            Retry
          </Button>
        </Alert>
      ) : godowns.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="godowns-empty">
          No godowns yet. Add at least one before this project can hold inventory.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" data-testid="godowns-list">
          {godowns.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between py-2"
              data-testid={`godown-${g.id}`}
            >
              <div className="min-w-0">
                <div className="text-sm">{g.name}</div>
                <div className="text-xs text-muted-foreground">{g.location || "—"}</div>
              </div>
              <div className="flex items-center gap-3">
                {g.isActive ? (
                  <Badge tone="success" dot aria-label="Active godown">
                    Active
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot aria-label="Inactive godown">
                    Inactive
                  </Badge>
                )}
                {canManage && !closed && (
                  <>
                    <button
                      type="button"
                      onClick={() => edit(g)}
                      className="text-xs font-semibold text-accent-ink hover:underline"
                      data-testid={`godown-edit-${g.id}`}
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
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                      data-testid={`godown-toggle-${g.id}`}
                    >
                      {g.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && !closed && !query.isError && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
          data-testid="godown-form"
        >
          <div className="w-48">
            <Label htmlFor="godown-name" className="mb-1.5 block text-[10.5px]">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="godown-name"
              invalid={!!errors.name}
              disabled={saving}
              {...register("name")}
            />
          </div>
          <div className="w-48">
            <Label htmlFor="godown-loc" className="mb-1.5 block text-[10.5px]">
              Location
            </Label>
            <Input id="godown-loc" disabled={saving} {...register("location")} />
          </div>
          <Button type="submit" size="md" disabled={saving} data-testid="godown-save">
            {saving ? "Saving…" : editing ? "Update" : "Add godown"}
          </Button>
          {errors.name && (
            <p className="w-full text-[11.5px] text-destructive-ink" data-testid="godown-error">
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
              ? "It stays on stock history but won't appear in new movement pickers."
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
