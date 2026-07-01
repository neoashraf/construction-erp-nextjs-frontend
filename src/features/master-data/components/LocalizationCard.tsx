"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { type Company } from "../types";
import {
  localizationSchema,
  type LocalizationValues,
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  LOCALE_OPTIONS,
} from "../schemas/company.schema";
import { useUpdateLocalization } from "../hooks/useCompany";
import { EditableCard } from "./EditableCard";

const HEADING_ID = "localization-heading";

const labelFor = (opts: { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v;

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Localization card (FR-MAS-004). Currency / date format / locale — all required selects. */
export function LocalizationCard({
  company,
  isLoading,
  isError,
  onReload,
  canEdit,
}: {
  company: Company | undefined;
  isLoading: boolean;
  isError: boolean;
  onReload: () => void;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const { mutate, isPending } = useUpdateLocalization();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LocalizationValues>({
    resolver: zodResolver(localizationSchema),
    defaultValues: { currency: "BDT", dateFormat: "DD/MM/YYYY", locale: "bn-BD" },
  });

  function startEdit() {
    if (!company) return;
    reset({ currency: company.currency, dateFormat: company.dateFormat, locale: company.locale });
    setConflict(false);
    setEditing(true);
  }

  function onSubmit(values: LocalizationValues) {
    if (!company) return;
    setConflict(false);
    mutate(
      { ...values, version: company.version },
      {
        onSuccess: () => {
          toast("Localization settings saved.", "success");
          setEditing(false);
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "OPTIMISTIC_LOCK_CONFLICT") setConflict(true);
          else if (e.code === "FORBIDDEN")
            toast("You don't have permission to change company settings.", "error");
          else if (e.code === "NETWORK_ERROR")
            toast("You're offline. Changes weren't saved.", "error");
          else toast(e.message || "Couldn't save localization settings.", "error");
        },
      },
    );
  }

  return (
    <EditableCard
      title="Localization"
      subtitle="Affects how money and dates display across the app."
      headingId={HEADING_ID}
      isEditing={editing}
      canEdit={canEdit && !isLoading && !isError}
      saving={isPending}
      onEdit={startEdit}
      onCancel={() => setEditing(false)}
      onSave={handleSubmit(onSubmit)}
      data-testid="localization-card"
    >
      {isError ? (
        <Alert tone="destructive" title="Couldn't load company details.">
          <div className="flex flex-col items-start gap-2">
            <span>The server returned an error. Check your connection and try again.</span>
            <Button size="sm" onClick={onReload} data-testid="localization-retry">
              Retry
            </Button>
          </div>
        </Alert>
      ) : isLoading || !company ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" data-testid="localization-loading">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-2/5" />
              <Skeleton className="mt-2.5 h-9 w-full" />
            </div>
          ))}
        </div>
      ) : editing ? (
        <form onSubmit={handleSubmit(onSubmit)} noValidate data-testid="localization-form">
          {conflict && (
            <div className="mb-5">
              <Alert tone="warning" title="These details were changed by someone else.">
                <div className="flex flex-col items-start gap-2">
                  <span>Reload and try again.</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onReload();
                      setConflict(false);
                    }}
                    data-testid="localization-conflict-reload"
                  >
                    Reload
                  </Button>
                </div>
              </Alert>
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <Label htmlFor="loc-currency" className="mb-1.5 block text-[10.5px]">
                Currency <span className="text-destructive">*</span>
              </Label>
              <Select
                id="loc-currency"
                invalid={!!errors.currency}
                disabled={isPending}
                {...register("currency")}
              >
                {CURRENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {errors.currency && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  {errors.currency.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="loc-date" className="mb-1.5 block text-[10.5px]">
                Date format <span className="text-destructive">*</span>
              </Label>
              <Select
                id="loc-date"
                invalid={!!errors.dateFormat}
                disabled={isPending}
                {...register("dateFormat")}
              >
                {DATE_FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {errors.dateFormat && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  {errors.dateFormat.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="loc-locale" className="mb-1.5 block text-[10.5px]">
                Locale <span className="text-destructive">*</span>
              </Label>
              <Select
                id="loc-locale"
                invalid={!!errors.locale}
                disabled={isPending}
                {...register("locale")}
              >
                {LOCALE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {errors.locale && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.locale.message}</p>
              )}
            </div>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <ReadField label="Currency">
            <span className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-sm bg-accent-soft text-sm font-bold text-accent-ink">
                ৳
              </span>
              {labelFor(CURRENCY_OPTIONS, company.currency)}
            </span>
          </ReadField>
          <ReadField label="Date format">
            <span className="font-mono tabular-nums">{company.dateFormat}</span>
          </ReadField>
          <ReadField label="Locale">{labelFor(LOCALE_OPTIONS, company.locale)}</ReadField>
        </div>
      )}
    </EditableCard>
  );
}
