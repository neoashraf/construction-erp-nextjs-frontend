"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyInput } from "@/components/ui/money-input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { toBangladeshE164 } from "@/lib/format";
import { parseMoney } from "@/lib/money";
import { type Party } from "../types";
import { partySchema, type PartyFormValues } from "../schemas/party.schema";
import { type PartyWriteInput } from "../api/parties";
import { useCreateParty, useUpdateParty } from "../hooks/useParties";

type Mode = { kind: "create" } | { kind: "edit"; party: Party };

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-[10.5px]">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[11.5px] text-destructive-ink">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11.5px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Party create/edit form (FR-MAS-023, spec §7). Sections: Identity & roles ·
 * Tax & contact · Terms & opening balance. At least one role required (group error);
 * phone E.164; TIN/BIN format-only; opening balance ৳ (decimal). Maps server errors.
 */
export function PartyDetailForm({
  mode,
  readOnly = false,
  onCreated,
  onUpdated,
  onCancel,
  onReload,
}: {
  mode: Mode;
  readOnly?: boolean;
  onCreated: (id: string) => void;
  onUpdated: () => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.party : null;
  const create = useCreateParty();
  const update = useUpdateParty();
  const saving = create.isPending || update.isPending;
  const disabled = saving || readOnly;

  const {
    register,
    handleSubmit,
    setError,
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
            onUpdated();
          },
          onError: mapServerError,
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: (res) => {
          toast("Party created.", "success");
          onCreated(res.id);
        },
        onError: mapServerError,
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-[18px]"
      data-testid="party-form"
    >
      {/* Identity & roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity &amp; roles</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field id="party-name" label="Party name" required error={errors.name?.message}>
            <Input
              id="party-name"
              invalid={!!errors.name}
              disabled={disabled}
              {...register("name")}
            />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Roles <span className="text-destructive">*</span>
            </legend>
            <div
              className="flex flex-wrap gap-5"
              role="group"
              aria-label="Roles"
              aria-describedby="roles-error"
            >
              <label className="flex items-center gap-2 text-sm">
                <Checkbox disabled={disabled} {...register("isCustomer")} /> Customer
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox disabled={disabled} {...register("isSupplier")} /> Supplier
              </label>
            </div>
            {roleError && (
              <p
                id="roles-error"
                className="mt-1.5 text-[11.5px] text-destructive-ink"
                data-testid="roles-error"
              >
                {roleError}
              </p>
            )}
            {(isCustomer || isSupplier) && (
              <p className="mt-1.5 text-[11.5px] text-faint">
                One record can be both customer and supplier.
              </p>
            )}
          </fieldset>
        </CardContent>
      </Card>

      {/* Tax & contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax &amp; contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field id="party-tin" label="TIN" error={errors.tin?.message}>
            <Input
              id="party-tin"
              className="font-mono"
              invalid={!!errors.tin}
              disabled={disabled}
              {...register("tin")}
            />
          </Field>
          <Field id="party-bin" label="BIN" error={errors.bin?.message}>
            <Input
              id="party-bin"
              className="font-mono"
              invalid={!!errors.bin}
              disabled={disabled}
              {...register("bin")}
            />
          </Field>
          <Field
            id="party-phone"
            label="Phone"
            required
            error={errors.phone?.message}
            hint="Bangladesh mobile, e.g. +8801XXXXXXXXX or 01XXXXXXXXX."
          >
            <Input
              id="party-phone"
              type="tel"
              invalid={!!errors.phone}
              disabled={disabled}
              {...register("phone")}
            />
          </Field>
          <Field id="party-email" label="Email" error={errors.email?.message}>
            <Input
              id="party-email"
              type="email"
              invalid={!!errors.email}
              disabled={disabled}
              {...register("email")}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field id="party-address" label="Address">
              <Textarea id="party-address" disabled={disabled} {...register("address")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Terms & opening balance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terms &amp; opening balance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <Field
              id="party-terms"
              label="Payment terms (days)"
              error={errors.paymentTermsDays?.message}
            >
              <Input
                id="party-terms"
                type="number"
                min={0}
                invalid={!!errors.paymentTermsDays}
                disabled={disabled}
                {...register("paymentTermsDays")}
              />
            </Field>
            <Field
              id="party-opening"
              label="Opening balance"
              error={errors.openingBalance?.message}
            >
              <MoneyInput
                id="party-opening"
                invalid={!!errors.openingBalance}
                disabled={disabled}
                {...register("openingBalance")}
              />
            </Field>
          </div>
          <Alert tone="info">
            Opening balance is reference data. It&apos;s posted via the opening journal at go-live
            and split across receivable/payable.
          </Alert>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={saving}>
          {readOnly ? "Back to parties" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button type="submit" size="md" disabled={disabled} data-testid="party-save">
            {saving && (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/45 border-t-primary-foreground"
                aria-hidden
              />
            )}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create party"}
          </Button>
        )}
      </div>
    </form>
  );
}
