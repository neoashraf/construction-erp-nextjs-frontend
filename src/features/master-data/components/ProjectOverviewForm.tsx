"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { asApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { type Project } from "../types";
import { projectSchema, type ProjectFormValues } from "../schemas/project.schema";
import { toApiDate } from "../schemas/financial-year.schema";
import { useCreateProject, useUpdateProject } from "../hooks/useProjects";
import { usePartiesList } from "../hooks/useParties";
import { useUsers } from "../hooks/useUsers";
import { CustomerPicker, ProjectManagerPicker } from "./Pickers";

type Mode = { kind: "create" } | { kind: "edit"; project: Project };

/** Project overview create/edit (FR-MAS-005, spec §7). Code immutable once referenced. */
export function ProjectOverviewForm({
  mode,
  readOnly = false,
  onCreated,
  onUpdated,
  onCancel,
  onReload,
  onError,
}: {
  mode: Mode;
  readOnly?: boolean;
  onCreated: (id: string) => void;
  onUpdated: () => void;
  onCancel: () => void;
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.project : null;
  const codeLocked = isEdit; // referenced-code immutability; server is authoritative (IMMUTABLE_PROJECT_CODE)
  const create = useCreateProject();
  const update = useUpdateProject();
  const saving = create.isPending || update.isPending;
  const disabled = saving || readOnly;

  const customers =
    usePartiesList({ isCustomer: true, isActive: true, pageSize: 200 }).data?.data ?? [];
  const users = useUsers().data ?? [];

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: editing
      ? {
          projectCode: editing.projectCode,
          name: editing.name,
          location: editing.location ?? "",
          customerId: editing.customerId ?? "",
          projectManagerId: editing.projectManagerId ?? "",
          startDate: formatDate(editing.startDate),
          expectedEndDate: formatDate(editing.expectedEndDate),
        }
      : {
          projectCode: "",
          name: "",
          location: "",
          customerId: "",
          projectManagerId: "",
          startDate: "",
          expectedEndDate: "",
        },
  });

  function mapError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
      onError("This project was changed by someone else. Reload and try again.");
      onReload();
      return;
    }
    if (e.code === "NETWORK_ERROR") return onError("You're offline. Try again when reconnected.");
    if (e.code === "FORBIDDEN") return onError("You don't have permission to do that.");
    if (e.code === "IMMUTABLE_PROJECT_CODE") {
      onError("This project is referenced, so its code can't be changed.");
      onReload();
      return;
    }
    if (e.code === "DUPLICATE_CODE") {
      setError("projectCode", { message: "This project code is already used." });
      return;
    }
    if (e.code === "CROSS_COMPANY_REFERENCE") {
      setError("customerId", { message: "Customer/PM must belong to this company." });
      return;
    }
    if (e.isValidation && e.details) {
      const d = e.details as Record<string, string[] | string>;
      for (const f of [
        "projectCode",
        "name",
        "location",
        "customerId",
        "projectManagerId",
        "startDate",
        "expectedEndDate",
      ] as const) {
        const msg = Array.isArray(d[f]) ? (d[f] as string[])[0] : (d[f] as string | undefined);
        if (msg) setError(f, { message: String(msg) });
      }
      return;
    }
    onError(e.message || "Couldn't save the project.");
  }

  function onSubmit(values: ProjectFormValues) {
    const payload = {
      name: values.name.trim(),
      location: values.location || null,
      customerId: values.customerId,
      projectManagerId: values.projectManagerId,
      startDate: toApiDate(values.startDate),
      expectedEndDate: toApiDate(values.expectedEndDate),
    };
    if (editing) {
      update.mutate(
        { id: editing.id, input: { ...payload, version: editing.version } },
        { onSuccess: onUpdated, onError: mapError },
      );
    } else {
      create.mutate(
        { projectCode: values.projectCode.trim(), ...payload },
        { onSuccess: (res) => onCreated(res.id), onError: mapError },
      );
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate data-testid="project-form">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="pj-code" className="mb-1.5 block text-[10.5px]">
                Project code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pj-code"
                className="font-mono"
                invalid={!!errors.projectCode}
                disabled={disabled || codeLocked}
                {...register("projectCode")}
              />
              {errors.projectCode ? (
                <p
                  className="mt-1.5 text-[11.5px] text-destructive-ink"
                  data-testid="pj-code-error"
                >
                  {errors.projectCode.message}
                </p>
              ) : codeLocked ? (
                <p className="mt-1.5 text-[11.5px] text-faint">
                  Code can&apos;t change once created.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="pj-name" className="mb-1.5 block text-[10.5px]">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pj-name"
                invalid={!!errors.name}
                disabled={disabled}
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="pj-customer" className="mb-1.5 block text-[10.5px]">
                Customer <span className="text-destructive">*</span>
              </Label>
              <CustomerPicker
                id="pj-customer"
                customers={customers}
                invalid={!!errors.customerId}
                disabled={disabled}
                {...register("customerId")}
              />
              {errors.customerId && (
                <p
                  className="mt-1.5 text-[11.5px] text-destructive-ink"
                  data-testid="pj-customer-error"
                >
                  {errors.customerId.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="pj-pm" className="mb-1.5 block text-[10.5px]">
                Project manager <span className="text-destructive">*</span>
              </Label>
              <ProjectManagerPicker
                id="pj-pm"
                users={users}
                invalid={!!errors.projectManagerId}
                disabled={disabled}
                {...register("projectManagerId")}
              />
              {errors.projectManagerId && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  {errors.projectManagerId.message}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pj-location" className="mb-1.5 block text-[10.5px]">
                Location
              </Label>
              <Input id="pj-location" disabled={disabled} {...register("location")} />
            </div>
            <div>
              <Label htmlFor="pj-start" className="mb-1.5 block text-[10.5px]">
                Start date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pj-start"
                className="font-mono"
                placeholder="DD/MM/YYYY"
                inputMode="numeric"
                invalid={!!errors.startDate}
                disabled={disabled}
                {...register("startDate")}
              />
              {errors.startDate && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  {errors.startDate.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="pj-end" className="mb-1.5 block text-[10.5px]">
                Expected end date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pj-end"
                className="font-mono"
                placeholder="DD/MM/YYYY"
                inputMode="numeric"
                invalid={!!errors.expectedEndDate}
                disabled={disabled}
                {...register("expectedEndDate")}
              />
              {errors.expectedEndDate && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink" data-testid="pj-end-error">
                  {errors.expectedEndDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={saving}>
              {readOnly ? "Back to projects" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="submit" size="md" disabled={disabled} data-testid="project-save">
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create project"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
