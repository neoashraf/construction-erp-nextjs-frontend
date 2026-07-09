"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { toBangladeshE164 } from "@/lib/format";
import { parseMoney } from "@/lib/money";
import { type Party } from "../types";
import { partySchema, type PartyFormValues } from "../schemas/party.schema";
import { type PartyWriteInput } from "../api/parties";
import { useCreateParty, useUpdateParty } from "../hooks/useParties";

type Mode = { kind: "create" } | { kind: "edit"; party: Party };

/** Uppercase micro-label above a field (per Parties.dc.html). */
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
      className={cn("mb-1.5 block text-[10.5px]", invalid && "text-destructive-ink")}
    >
      {children} {required && <span className="text-destructive">*</span>}
    </Label>
  );
}

/** A selectable role card (Customer / Supplier) — checkbox affordance per the design. */
function RoleCard({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex h-11 flex-1 items-center gap-2.5 rounded-md border px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "border-accent bg-accent-soft/40" : "border-border-strong bg-surface hover:border-faint",
      )}
    >
      <span
        className={cn(
          "grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border text-[12px] text-primary-foreground",
          checked ? "border-primary bg-primary" : "border-border-strong bg-surface",
        )}
        aria-hidden
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-[13.5px] font-semibold text-foreground">{label}</span>
    </button>
  );
}

/**
 * Party create/edit drawer (FR-MAS-023, spec §7; Parties.dc.html). A right-side Sheet
 * with three sections — Identity & roles · Tax & contact · Terms & opening balance.
 * At least one role required (group error); phone E.164; TIN/BIN format-only; opening
 * balance ৳. Maps server validation errors. Saves in place — no route navigation.
 */
export function PartyFormSheet({
  mode,
  onClose,
  onSaved,
  onReload,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.party : null;
  const create = useCreateParty();
  const update = useUpdateParty();
  const saving = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PartyFormValues>({
    resolver: zodResolver(partySchema),
    defaultValues: editing
      ? {
          name: editing.name,
          isCustomer: editing.isCustomer,
          isSupplier: editing.isSupplier,
          tin: editing.tin ?? "",
          bin: editing.bin ?? "",
          address: editing.address ?? "",
          phone: editing.phone,
          email: editing.email ?? "",
          paymentTermsDays:
            editing.paymentTermsDays != null ? String(editing.paymentTermsDays) : "",
          openingBalance: editing.openingBalance ?? "",
        }
      : {
          name: "",
          isCustomer: false,
          isSupplier: false,
          tin: "",
          bin: "",
          address: "",
          phone: "",
          email: "",
          paymentTermsDays: "",
          openingBalance: "",
        },
  });

  const roleError = (errors as Record<string, { message?: string }>).roles?.message;
  const isCustomer = watch("isCustomer");
  const isSupplier = watch("isSupplier");

  function toggleRole(key: "isCustomer" | "isSupplier", current: boolean) {
    // Clear the group role error as soon as the user selects a role.
    setValue(key, !current, { shouldValidate: true, shouldDirty: true });
  }

  function mapServerError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
      toast("This party was changed by someone else. Reload and try again.", "error");
      onReload();
      return;
    }
    if (e.code === "NETWORK_ERROR") {
      toast("You're offline. Try again when reconnected.", "error");
      return;
    }
    if (e.code === "FORBIDDEN") {
      toast("You don't have permission to do that.", "error");
      return;
    }
    if (e.isValidation && e.details) {
      const d = e.details as Record<string, string[] | string>;
      const fields = [
        "name",
        "phone",
        "email",
        "tin",
        "bin",
        "address",
        "paymentTermsDays",
        "openingBalance",
      ] as const;
      for (const f of fields) {
        const msg = Array.isArray(d[f]) ? (d[f] as string[])[0] : (d[f] as string | undefined);
        if (msg) setError(f, { message: String(msg) });
      }
      const roleMsg = d.roles ?? d.isCustomer ?? d.isSupplier;
      if (roleMsg) {
        setError("isCustomer", {
          message: Array.isArray(roleMsg) ? roleMsg[0] : String(roleMsg),
        });
      }
      return;
    }
    toast(e.message || "Couldn't save the party.", "error");
  }

  function onSubmit(values: PartyFormValues) {
    const payload: PartyWriteInput = {
      name: values.name.trim(),
      isCustomer: values.isCustomer,
      isSupplier: values.isSupplier,
      tin: values.tin || null,
      bin: values.bin || null,
      address: values.address || null,
      phone: toBangladeshE164(values.phone),
      email: values.email || null,
      paymentTermsDays: values.paymentTermsDays === "" ? null : Number(values.paymentTermsDays),
      openingBalance:
        values.openingBalance === "" ? null : parseMoney(values.openingBalance).toFixed(4),
    };

    if (editing) {
      update.mutate(
        { id: editing.id, input: { ...payload, version: editing.version } },
        {
          onSuccess: () => {
            toast("Party updated.", "success");
            onSaved();
            onClose();
          },
          onError: mapServerError,
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast("Party created.", "success");
          onSaved();
          onClose();
        },
        onError: mapServerError,
      });
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && !saving && onClose()}>
      <SheetContent className="w-[456px]" data-testid="party-form-sheet">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex h-full flex-col" data-testid="party-form">
          <SheetHeader
            kicker={isEdit ? "Edit" : "Create"}
            title={isEdit ? "Edit party" : "New party"}
          />

          <SheetBody className="flex flex-col gap-0 p-0">
            {/* Identity & roles */}
            <section className="flex flex-col gap-4 px-6 py-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
                Identity &amp; roles
              </div>
              <div>
                <FieldLabel htmlFor="pf-name" required invalid={!!errors.name}>
                  Name
                </FieldLabel>
                <Input
                  id="pf-name"
                  placeholder="Party name"
                  invalid={!!errors.name}
                  disabled={saving}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
                )}
              </div>
              <fieldset className="min-w-0 border-none p-0">
                <legend
                  className={cn(
                    "p-0 text-[11px] font-semibold uppercase tracking-[0.4px]",
                    roleError ? "text-destructive-ink" : "text-muted-foreground",
                  )}
                >
                  Roles <span className="text-destructive">*</span>
                </legend>
                <div className="mt-2.5 flex gap-2.5">
                  <RoleCard
                    label="Customer"
                    checked={isCustomer}
                    disabled={saving}
                    onToggle={() => toggleRole("isCustomer", isCustomer)}
                  />
                  <RoleCard
                    label="Supplier"
                    checked={isSupplier}
                    disabled={saving}
                    onToggle={() => toggleRole("isSupplier", isSupplier)}
                  />
                </div>
                {roleError ? (
                  <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="roles-error">
                    {roleError}
                  </p>
                ) : (
                  (isCustomer || isSupplier) && (
                    <p className="mt-2 text-[11.5px] text-faint">
                      One record can be both customer and supplier.
                    </p>
                  )
                )}
              </fieldset>
            </section>

            {/* Tax & contact */}
            <section className="flex flex-col gap-4 border-t border-border px-6 py-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
                Tax &amp; contact
              </div>
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="pf-tin" invalid={!!errors.tin}>
                    TIN
                  </FieldLabel>
                  <Input
                    id="pf-tin"
                    className="font-mono"
                    placeholder="12-digit TIN"
                    invalid={!!errors.tin}
                    disabled={saving}
                    {...register("tin")}
                  />
                  {errors.tin && (
                    <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.tin.message}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="pf-bin" invalid={!!errors.bin}>
                    BIN
                  </FieldLabel>
                  <Input
                    id="pf-bin"
                    className="font-mono"
                    placeholder="000000000-0000"
                    invalid={!!errors.bin}
                    disabled={saving}
                    {...register("bin")}
                  />
                  {errors.bin && (
                    <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.bin.message}</p>
                  )}
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="pf-addr">Address</FieldLabel>
                <Textarea
                  id="pf-addr"
                  rows={2}
                  placeholder="Street, area, city, postcode"
                  disabled={saving}
                  {...register("address")}
                />
              </div>
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="pf-phone" required invalid={!!errors.phone}>
                    Phone
                  </FieldLabel>
                  <Input
                    id="pf-phone"
                    type="tel"
                    className="font-mono"
                    placeholder="+8801XXXXXXXXX"
                    invalid={!!errors.phone}
                    disabled={saving}
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="pf-email" invalid={!!errors.email}>
                    Email
                  </FieldLabel>
                  <Input
                    id="pf-email"
                    type="email"
                    placeholder="name@company.com"
                    invalid={!!errors.email}
                    disabled={saving}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Terms & opening balance */}
            <section className="flex flex-col gap-4 border-t border-border px-6 py-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
                Terms &amp; opening balance
              </div>
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="pf-terms" invalid={!!errors.paymentTermsDays}>
                    Payment terms
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="pf-terms"
                      type="number"
                      min={0}
                      className="pr-12 font-mono"
                      invalid={!!errors.paymentTermsDays}
                      disabled={saving}
                      {...register("paymentTermsDays")}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-faint">
                      days
                    </span>
                  </div>
                  {errors.paymentTermsDays && (
                    <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                      {errors.paymentTermsDays.message}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="pf-open" invalid={!!errors.openingBalance}>
                    Opening balance
                  </FieldLabel>
                  <MoneyInput
                    id="pf-open"
                    invalid={!!errors.openingBalance}
                    disabled={saving}
                    {...register("openingBalance")}
                  />
                  {errors.openingBalance && (
                    <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                      {errors.openingBalance.message}
                    </p>
                  )}
                </div>
              </div>
              <Alert tone="info">
                Opening balance is reference data. It&apos;s posted via the opening journal at
                go-live and split across receivable/payable.
              </Alert>
            </section>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="party-save">
              {saving && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/45 border-t-primary-foreground"
                  aria-hidden
                />
              )}
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
