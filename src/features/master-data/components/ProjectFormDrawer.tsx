"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
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

/** Uppercase micro-label above a drawer field (Projects.dc.html drawer). */
function FieldLabel({
  htmlFor,
  required,
  invalid,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block text-[11px]", invalid && "text-destructive-ink")}
    >
      {children} {required && <span className="text-destructive">*</span>}
    </Label>
  );
}

/**
 * Project create/edit slide-over (FR-MAS-005, Projects.dc.html "CREATE / EDIT DRAWER").
 * A right-side Sheet — identity + dates + a "starts PLANNED" note. Code immutable on
 * edit; start date fixed at creation (the update DTO rejects it). Maps server errors.
 */
export function ProjectFormDrawer({
  mode,
  onClose,
  onCreated,
  onUpdated,
  onReload,
}: {
  mode: Mode;
  onClose: () => void;
  onCreated: (id: string) => void;
  onUpdated: () => void;
  onReload: () => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.project : null;
  const codeLocked = isEdit;
  const startDateLocked = isEdit;
  const create = useCreateProject();
  const update = useUpdateProject();
  const saving = create.isPending || update.isPending;

  const customers =
    usePartiesList({ isCustomer: true, isActive: true, pageSize: 200 }).data?.data ?? [];
  const users = useUsers().data ?? [];

  const {
    register,
    control,
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
      onReload();
      return;
    }
    if (e.code === "IMMUTABLE_PROJECT_CODE") {
      setError("projectCode", { message: "This project has transactions, so its code can't be changed." });
      onReload();
      return;
    }
    if (e.code === "DUPLICATE_CODE") {
      setError("projectCode", { message: "This project code is already used." });
      return;
    }
    if (e.code === "CROSS_COMPANY_REFERENCE") {
      setError("customerId", { message: "Customer or project manager must belong to this company." });
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
    }
  }

  function onSubmit(values: ProjectFormValues) {
    const common = {
      name: values.name.trim(),
      location: values.location || null,
      customerId: values.customerId,
      projectManagerId: values.projectManagerId,
      expectedEndDate: toApiDate(values.expectedEndDate),
    };
    if (editing) {
      update.mutate(
        { id: editing.id, input: { ...common, version: editing.version } },
        { onSuccess: onUpdated, onError: mapError },
      );
    } else {
      create.mutate(
        {
          projectCode: values.projectCode.trim(),
          ...common,
          startDate: toApiDate(values.startDate),
        },
        { onSuccess: (res) => onCreated(res.id), onError: mapError },
      );
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && !saving && onClose()}>
      <SheetContent className="w-[480px]" data-testid="project-form-drawer">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex h-full flex-col" data-testid="project-form">
          <SheetHeader
            kicker={isEdit ? "Edit" : "Create"}
            title={isEdit ? "Edit project" : "New project"}
          />
          <p className="border-b border-border px-6 pb-4 -mt-2 text-[12.5px] text-muted-foreground">
            Project is the primary posting dimension across vouchers.
          </p>

          <SheetBody className="flex flex-col gap-4 px-6 py-5">
            {/* code + name */}
            <div className="flex gap-3">
              <div className="w-[150px] flex-none">
                <FieldLabel htmlFor="pd-code" required invalid={!!errors.projectCode}>
                  Project code
                </FieldLabel>
                <Input
                  id="pd-code"
                  className="font-mono"
                  placeholder="PRJ-0042"
                  invalid={!!errors.projectCode}
                  disabled={saving || codeLocked}
                  {...register("projectCode")}
                />
              </div>
              <div className="min-w-0 flex-1">
                <FieldLabel htmlFor="pd-name" required invalid={!!errors.name}>
                  Name
                </FieldLabel>
                <Input
                  id="pd-name"
                  placeholder="Project name"
                  invalid={!!errors.name}
                  disabled={saving}
                  {...register("name")}
                />
              </div>
            </div>
            {errors.projectCode && (
              <p className="-mt-2 text-[12px] text-destructive-ink" data-testid="pd-code-error">
                {errors.projectCode.message}
              </p>
            )}
            {errors.name && (
              <p className="-mt-2 text-[12px] text-destructive-ink">{errors.name.message}</p>
            )}
            {codeLocked && !errors.projectCode && (
              <p className="-mt-2 text-[11.5px] text-faint">Code can&apos;t change once created.</p>
            )}

            {/* location */}
            <div>
              <FieldLabel htmlFor="pd-loc">Location</FieldLabel>
              <Textarea
                id="pd-loc"
                rows={2}
                placeholder="Site address (Bangla supported)"
                disabled={saving}
                {...register("location")}
              />
            </div>

            {/* customer + PM */}
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <FieldLabel htmlFor="pd-customer" required invalid={!!errors.customerId}>
                  Customer
                </FieldLabel>
                <CustomerPicker
                  id="pd-customer"
                  customers={customers}
                  invalid={!!errors.customerId}
                  disabled={saving}
                  {...register("customerId")}
                />
                {errors.customerId && (
                  <p className="mt-1.5 text-[12px] text-destructive-ink">{errors.customerId.message}</p>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <FieldLabel htmlFor="pd-pm" required invalid={!!errors.projectManagerId}>
                  Project manager
                </FieldLabel>
                <ProjectManagerPicker
                  id="pd-pm"
                  users={users}
                  invalid={!!errors.projectManagerId}
                  disabled={saving}
                  {...register("projectManagerId")}
                />
                {errors.projectManagerId && (
                  <p className="mt-1.5 text-[12px] text-destructive-ink">
                    {errors.projectManagerId.message}
                  </p>
                )}
              </div>
            </div>

            {/* dates */}
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <FieldLabel htmlFor="pd-start" required invalid={!!errors.startDate}>
                  Start date
                </FieldLabel>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePickerInput
                      id="pd-start"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      invalid={!!errors.startDate}
                      disabled={saving || startDateLocked}
                    />
                  )}
                />
                {startDateLocked && !errors.startDate && (
                  <p className="mt-1.5 text-[11.5px] text-faint">Fixed once created.</p>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <FieldLabel htmlFor="pd-end" required invalid={!!errors.expectedEndDate}>
                  Expected end date
                </FieldLabel>
                <Controller
                  control={control}
                  name="expectedEndDate"
                  render={({ field }) => (
                    <DatePickerInput
                      id="pd-end"
                      align="right"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      invalid={!!errors.expectedEndDate}
                      disabled={saving}
                    />
                  )}
                />
                {errors.expectedEndDate && (
                  <p className="mt-1.5 text-[12px] text-destructive-ink" data-testid="pd-end-error">
                    {errors.expectedEndDate.message}
                  </p>
                )}
              </div>
            </div>

            {!isEdit && (
              <Alert tone="info">
                New projects start as <strong className="font-semibold text-foreground">PLANNED</strong>.
                Move to ACTIVE from the detail header once work begins.
              </Alert>
            )}
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="project-save">
              {saving && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/45 border-t-primary-foreground"
                  aria-hidden
                />
              )}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create project"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
