"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { asApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { useCreateUser, useUpdateUser, useFinancialYearOptions } from "../hooks/use-users";
import { useRoles } from "../hooks/use-roles";
import { createUserSchema, editUserSchema, mapUserFormError } from "../schemas/user";
import { userRoleLabel, type UserDetail } from "../types";

type Mode = { kind: "create" } | { kind: "edit"; user: UserDetail };

/**
 * Create / edit user drawer (spec §5/§7/§8, design file: side sheet). Create posts
 * `{ email, name, roleId, financialYearId, phone?, temporaryPassword, isActive? }`;
 * edit posts `{ name?, roleId?, financialYearId?, phone?, version }` — no email or
 * password field in edit mode (spec §5). `version` conflicts surface the reload
 * banner (FR-AUD-019); email-taken surfaces inline on the email field (spec §6/§8).
 */
export function UserDrawer({
  mode,
  onClose,
  onSaved,
  onReloadRequested,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: (message: string) => void;
  onReloadRequested: () => void;
}) {
  const isEdit = mode.kind === "edit";
  const create = useCreateUser();
  const update = useUpdateUser();
  const fyOptions = useFinancialYearOptions();
  const roles = useRoles();
  const [pwVisible, setPwVisible] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const schema = isEdit ? editUserSchema : createUserSchema;
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema as never),
    defaultValues: isEdit
      ? {
          name: mode.user.name,
          roleId: "",
          financialYearId: mode.user.financialYearId,
          phone: mode.user.phone ?? "",
        }
      : {
          email: "",
          name: "",
          roleId: "",
          financialYearId: "",
          phone: "",
          temporaryPassword: "",
        },
  });

  // Edit mode: `UserDetail.role` is the role NAME (e.g. "HR_MANAGER"), but the form
  // field/API need the role's UUID (`POST`/`PATCH` look it up via `roles.findById`).
  // Roles load async, so resolve + fill the select once the list arrives.
  useEffect(() => {
    if (!isEdit || !roles.data) return;
    const match = roles.data.find((r) => r.name === mode.user.role);
    if (match) setValue("roleId" as never, match.id as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, roles.data]);

  const saving = create.isPending || update.isPending;

  function onSubmit(values: Record<string, unknown>) {
    setFormMessage(null);
    const phone = typeof values.phone === "string" && values.phone.trim() ? values.phone.trim() : undefined;

    if (isEdit) {
      update.mutate(
        {
          id: mode.user.id,
          input: {
            name: values.name as string,
            roleId: values.roleId as string,
            financialYearId: values.financialYearId as string,
            phone,
            version: mode.user.version,
          },
        },
        {
          onSuccess: () => onSaved("Changes saved."),
          onError: (err) => handleError(err),
        },
      );
    } else {
      create.mutate(
        {
          email: values.email as string,
          name: values.name as string,
          roleId: values.roleId as string,
          financialYearId: values.financialYearId as string,
          phone,
          temporaryPassword: values.temporaryPassword as string,
        },
        {
          onSuccess: () => onSaved("User created."),
          onError: (err) => handleError(err),
        },
      );
    }
  }

  function handleError(err: unknown) {
    const apiErr = asApiError(err);
    const mapped = mapUserFormError(apiErr);
    let pinned = false;
    for (const [field, message] of Object.entries(mapped.fieldErrors)) {
      if (message) {
        setError(field as never, { message });
        pinned = true;
      }
    }
    if (mapped.isOptimisticLockConflict) {
      setConflict(true);
    } else if (mapped.formMessage && !pinned) {
      setFormMessage(mapped.formMessage);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[468px]" data-testid="user-drawer">
        <SheetHeader
          kicker={isEdit ? "Edit user" : "Create"}
          title={isEdit ? mode.user.name : "New user"}
        />
        <SheetBody>
          <form id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {conflict && (
              <Alert tone="destructive" data-testid="user-conflict-banner">
                <div className="flex flex-col items-start gap-2">
                  <span>
                    This user was changed by someone else. Reload to see the latest, then reapply
                    your changes.
                  </span>
                  <Button size="sm" type="button" onClick={onReloadRequested} data-testid="user-conflict-reload">
                    Reload
                  </Button>
                </div>
              </Alert>
            )}
            {formMessage && !conflict && (
              <Alert tone="destructive" data-testid="user-form-message">
                {formMessage}
              </Alert>
            )}

            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="user-email"
                  type="email"
                  className="font-mono"
                  invalid={!!errors.email}
                  disabled={saving}
                  placeholder="name@zakirent.com"
                  aria-describedby="user-email-help"
                  {...register("email")}
                />
                {errors.email ? (
                  <p id="user-email-help" className="text-[12px] text-destructive-ink" data-testid="user-email-error">
                    {String(errors.email.message)}
                  </p>
                ) : (
                  <p id="user-email-help" className="text-[11px] text-faint">
                    Company-unique login identifier.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-name"
                invalid={!!errors.name}
                disabled={saving}
                placeholder="e.g. Ashraf Uddin"
                aria-describedby="user-name-help"
                {...register("name")}
              />
              {errors.name && (
                <p id="user-name-help" className="text-[12px] text-destructive-ink">
                  {String(errors.name.message)}
                </p>
              )}
            </div>

            <div className="flex gap-3.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="user-role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="user-role"
                  invalid={!!errors.roleId}
                  disabled={saving || roles.isLoading}
                  {...register("roleId")}
                >
                  <option value="">Select a role</option>
                  {(roles.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {userRoleLabel(r.name)}
                    </option>
                  ))}
                </Select>
                {errors.roleId ? (
                  <p className="text-[12px] text-destructive-ink">{String(errors.roleId.message)}</p>
                ) : (
                  <p className="text-[11px] text-faint">One role per user.</p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="user-fy">
                  Financial year <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="user-fy"
                  invalid={!!errors.financialYearId}
                  disabled={saving}
                  {...register("financialYearId")}
                >
                  <option value="">Select a financial year</option>
                  {(fyOptions.data ?? []).map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      {fy.label}
                    </option>
                  ))}
                </Select>
                {errors.financialYearId && (
                  <p className="text-[12px] text-destructive-ink">
                    {String(errors.financialYearId.message)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-phone">Phone</Label>
              <Input
                id="user-phone"
                className="font-mono"
                invalid={!!errors.phone}
                disabled={saving}
                placeholder="+8801XXXXXXXXX"
                aria-describedby="user-phone-help"
                {...register("phone")}
              />
              {errors.phone ? (
                <p id="user-phone-help" className="text-[12px] text-destructive-ink">
                  {String(errors.phone.message)}
                </p>
              ) : (
                <p id="user-phone-help" className="text-[11px] text-faint">
                  Optional · E.164 format.
                </p>
              )}
            </div>

            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-temp-password">
                  Temporary password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="user-temp-password"
                    type={pwVisible ? "text" : "password"}
                    className="pr-16 font-mono"
                    invalid={!!errors.temporaryPassword}
                    disabled={saving}
                    placeholder="At least 10 characters"
                    aria-describedby="user-temp-password-help"
                    {...register("temporaryPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setPwVisible((v) => !v)}
                    className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[12px] font-semibold text-muted-foreground"
                    aria-label={pwVisible ? "Hide password" : "Show password"}
                  >
                    {pwVisible ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                    {pwVisible ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.temporaryPassword ? (
                  <p id="user-temp-password-help" className="text-[12px] text-destructive-ink" data-testid="user-password-error">
                    {String(errors.temporaryPassword.message)}
                  </p>
                ) : (
                  <p id="user-temp-password-help" className="text-[11px] text-faint">
                    Write-only — never shown again. Share it with the user directly.
                  </p>
                )}
              </div>
            )}

            {isEdit && (
              <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label>Assigned projects</Label>
                  <Link
                    href="/audit/project-assignment"
                    className="text-[12px] font-semibold text-accent-ink hover:underline"
                  >
                    Manage assignment →
                  </Link>
                </div>
                {mode.user.assignedProjects.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground" data-testid="user-no-projects">
                    No projects assigned — this user can&rsquo;t transact yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {mode.user.assignedProjects.map((p) => (
                      <li
                        key={p.projectId}
                        className="flex items-center gap-2 rounded-token border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground"
                      >
                        <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden />
                        {p.projectName}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 text-[11.5px] text-faint">
                  <span>Last login</span>
                  <span className="font-mono text-muted-foreground">
                    {mode.user.lastLoginAt ? formatDate(mode.user.lastLoginAt) : "Never"}
                  </span>
                </div>
              </div>
            )}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-form"
            size="md"
            disabled={saving}
            aria-busy={saving || undefined}
            data-testid="user-save"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create user"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
