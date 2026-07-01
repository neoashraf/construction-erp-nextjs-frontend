"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { GapAuditPanel } from "./GapAuditPanel";
import { DiscardChangesDialog } from "./DiscardChangesDialog";
import { useUpdateSeries } from "../hooks/useNumberingSeries";
import { type NumberingSeries, voucherTypeLabel } from "../types";
import {
  seriesEditSchema,
  type SeriesEditFormValues,
  composePreview,
  fyLabelFromPreview,
  mapSeriesEditError,
} from "../schemas/numbering-series.schema";

type Tab = "edit" | "audit";

/**
 * Series editor / gap-audit drawer (spec §7/§9/§10, design file §4/§5). Right side-
 * over with two tabs. Edit: an always-visible forward-only warning banner
 * (`role="alert"`), the prefix + padding-width fields (uniform focus/error states via
 * the shared Input primitive), a live preview (`aria-live="polite"`) that recomputes
 * as the Admin types, and a read-only context block (company/FY/voucher type/last
 * sequence). Save is server-confirmed (no optimistic UI). Cancel with dirty edits
 * opens the discard confirm. Audit tab hosts `GapAuditPanel`. Focus is trapped by the
 * Radix Sheet; Esc closes.
 */
export function SeriesEditorDrawer({
  series,
  fyLabelText,
  initialTab = "edit",
  onClose,
  onSaved,
  onError,
}: {
  series: NumberingSeries;
  /** e.g. "FY 2025–26" — the read-only context label. */
  fyLabelText: string;
  initialTab?: Tab;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const update = useUpdateSeries();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    getValues,
    formState: { errors, isDirty },
  } = useForm<SeriesEditFormValues>({
    resolver: zodResolver(seriesEditSchema),
    defaultValues: { prefix: series.prefix, paddingWidth: series.paddingWidth },
  });

  const prefix = watch("prefix");
  const paddingWidth = Number(watch("paddingWidth"));
  const nextSeq = series.lastSequence + 1;
  const fyLabel = fyLabelFromPreview(series.nextNumberPreview);
  const preview = composePreview(prefix || series.prefix, paddingWidth, nextSeq, fyLabel);
  const nextSeqPadded = preview.split("/").pop() ?? "";

  function requestClose() {
    if (isDirty && tab === "edit" && !update.isPending) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  }

  function onSubmit(values: SeriesEditFormValues) {
    update.mutate(
      { id: series.id, input: { prefix: values.prefix.trim(), paddingWidth: values.paddingWidth } },
      {
        onSuccess: () => {
          onSaved();
          onClose();
        },
        onError: (err) => {
          const mapped = mapSeriesEditError(asApiError(err));
          let pinned = false;
          for (const [field, msg] of Object.entries(mapped.fieldErrors)) {
            if (msg) {
              setError(field as keyof SeriesEditFormValues, { message: msg });
              pinned = true;
            }
          }
          if (mapped.formMessage) onError(mapped.formMessage);
          else if (!pinned) onError("Couldn't save the numbering series.");
        },
      },
    );
  }

  function stepPadding(delta: number) {
    const current = Number(getValues("paddingWidth")) || 0;
    const next = Math.max(1, current + delta);
    setValue("paddingWidth", next, { shouldDirty: true, shouldValidate: true });
  }

  const typeLabel = voucherTypeLabel(series.voucherType);

  return (
    <>
    <Sheet open onOpenChange={(open) => !open && requestClose()}>
      <SheetContent className="w-[476px]" data-testid="series-editor-drawer">
        <DialogPrimitive.Description className="sr-only">
          Edit the prefix and padding width for the {typeLabel} numbering series, or
          review its gap audit.
        </DialogPrimitive.Description>

        {/* header */}
        <div className="flex flex-none items-start justify-between gap-3 px-6 pb-0 pt-5">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
              Edit series
            </div>
            <DialogPrimitive.Title className="mt-0.5 truncate text-lg font-bold tracking-[-0.01em] text-foreground">
              {typeLabel}
            </DialogPrimitive.Title>
            <div className="mt-0.5 font-mono text-[11.5px] text-faint">{series.voucherType}</div>
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            onClick={(e) => {
              // Intercept so a dirty edit gets the discard confirm instead of closing.
              e.preventDefault();
              requestClose();
            }}
            className="grid h-8 w-8 flex-none place-items-center rounded-token border border-border-strong bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ✕
          </DialogPrimitive.Close>
        </div>

        {/* tabs */}
        <div
          role="tablist"
          aria-label="Series editor sections"
          className="flex flex-none gap-5 border-b border-border px-6 pt-3.5"
        >
          <TabButton id="edit" active={tab === "edit"} onSelect={setTab}>
            Edit
          </TabButton>
          <TabButton id="audit" active={tab === "audit"} onSelect={setTab}>
            Gap audit
          </TabButton>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {tab === "edit" ? (
            <form
              id="series-edit-form"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              data-testid="series-edit-form"
            >
              {/* forward-only warning — always visible while editing (FR-NUM-020) */}
              <div
                role="alert"
                className="flex items-start gap-3 rounded-card border border-warning-soft bg-warning-soft p-3.5"
                data-testid="forward-only-warning"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-none text-warning"
                  aria-hidden
                />
                <span className="text-[12.5px] leading-relaxed text-warning-ink">
                  Changes to the prefix or padding width apply to <strong>future</strong>{" "}
                  numbers only. They cannot renumber or change vouchers that already have a
                  number.
                </span>
              </div>

              {/* prefix */}
              <div className="mt-5">
                <Label htmlFor="series-prefix">
                  Prefix <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="series-prefix"
                  className="mt-1.5 font-mono"
                  invalid={!!errors.prefix}
                  disabled={update.isPending}
                  aria-describedby="series-prefix-help"
                  {...register("prefix")}
                />
                {errors.prefix ? (
                  <p
                    id="series-prefix-help"
                    className="mt-1.5 text-[11.5px] text-destructive-ink"
                    data-testid="series-prefix-error"
                  >
                    {errors.prefix.message}
                  </p>
                ) : (
                  <p id="series-prefix-help" className="mt-1.5 text-[11.5px] text-faint">
                    Use only letters, digits and <span className="font-mono">-</span>{" "}
                    <span className="font-mono">_</span> — no{" "}
                    <span className="font-mono">/</span>.
                  </p>
                )}
              </div>

              {/* padding width */}
              <div className="mt-[18px]">
                <Label htmlFor="series-padding">
                  Padding width <span className="text-destructive">*</span>
                </Label>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="flex h-9 items-center overflow-hidden rounded-token border border-border-strong">
                    <button
                      type="button"
                      aria-label="Decrease padding width"
                      onClick={() => stepPadding(-1)}
                      disabled={update.isPending}
                      className="grid h-full w-9 place-items-center border-r border-border bg-surface-2 text-muted-foreground hover:bg-muted disabled:opacity-60"
                    >
                      <Minus className="h-4 w-4" aria-hidden />
                    </button>
                    <input
                      id="series-padding"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      aria-invalid={!!errors.paddingWidth || undefined}
                      disabled={update.isPending}
                      className="h-full w-14 border-0 bg-background text-center font-mono text-sm font-semibold tabular-nums text-foreground focus:outline-none"
                      {...register("paddingWidth")}
                    />
                    <button
                      type="button"
                      aria-label="Increase padding width"
                      onClick={() => stepPadding(1)}
                      disabled={update.isPending}
                      className="grid h-full w-9 place-items-center border-l border-border bg-surface-2 text-muted-foreground hover:bg-muted disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <span className="text-[11.5px] text-faint">Minimum 1 · default 4</span>
                </div>
                {errors.paddingWidth && (
                  <p
                    className="mt-1.5 text-[11.5px] text-destructive-ink"
                    data-testid="series-padding-error"
                  >
                    {errors.paddingWidth.message}
                  </p>
                )}
              </div>

              {/* live preview (aria-live so the recomputed number is announced) */}
              <div
                aria-live="polite"
                className="mt-5 rounded-card border border-border-strong bg-surface-2 p-4"
                data-testid="series-preview"
              >
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
                  Next number preview
                </div>
                <div className="mt-2 break-all font-mono text-[22px] font-semibold tabular-nums tracking-[0.5px] text-foreground">
                  {preview}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <PreviewChip>prefix {prefix || series.prefix}</PreviewChip>
                  {fyLabel && <PreviewChip>FY {fyLabel}</PreviewChip>}
                  <PreviewChip>
                    pad {Number.isFinite(paddingWidth) ? paddingWidth : "—"} → seq{" "}
                    {nextSeqPadded}
                  </PreviewChip>
                </div>
              </div>

              {/* read-only context */}
              <div className="mt-[18px] overflow-hidden rounded-card border border-border">
                <div className="border-b border-border bg-surface-2 px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
                  Read-only context
                </div>
                <div className="px-3.5">
                  <ContextRow label="Company" value={series.companyId ? "Active company" : "—"} />
                  <ContextRow label="Financial year" value={fyLabelText} />
                  <ContextRow label="Voucher type" value={series.voucherType} mono />
                  <ContextRow
                    label="Last sequence"
                    value={series.lastSequence.toLocaleString("en-IN")}
                    mono
                    last
                  />
                </div>
                <div className="border-t border-border bg-surface-2 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-faint">
                  Last sequence advances only when a voucher is posted. It can&rsquo;t be set
                  or edited here.
                </div>
              </div>
            </form>
          ) : (
            <GapAuditPanel series={series} />
          )}
        </div>

        {/* footer */}
        {tab === "edit" ? (
          <div className="flex flex-none items-center justify-end gap-2.5 border-t border-border px-6 py-3.5">
            <span className="mr-auto text-[11.5px] text-faint">
              Every change is recorded in the audit log.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={requestClose}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="series-edit-form"
              size="md"
              disabled={update.isPending}
              aria-busy={update.isPending || undefined}
              data-testid="series-save"
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-none justify-end border-t border-border px-6 py-3.5">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>

      <DiscardChangesDialog
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

function TabButton({
  id,
  active,
  onSelect,
  children,
}: {
  id: Tab;
  active: boolean;
  onSelect: (t: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(id)}
      className={cn(
        "-mb-px border-b-2 py-2.5 text-[13px] font-semibold transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
      data-testid={`series-tab-${id}`}
    >
      {children}
    </button>
  );
}

function PreviewChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[10.5px] text-accent-ink">
      {children}
    </span>
  );
}

function ContextRow({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      aria-readonly="true"
      className={cn(
        "flex items-center justify-between gap-3 py-2.5",
        !last && "border-b border-border",
      )}
    >
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[12.5px] font-semibold text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  );
}
