"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { type Company } from "../types";
import { companyIdentitySchema, type CompanyIdentityValues } from "../schemas/company.schema";
import { useUpdateCompanyIdentity } from "../hooks/useCompany";
import { EditableCard } from "./EditableCard";

const HEADING_ID = "company-identity-heading";

function ReadField({
  label,
  sub,
  value,
  mono,
  full,
  bangla,
}: {
  label: string;
  sub?: string;
  value: string | null;
  mono?: boolean;
  full?: boolean;
  bangla?: boolean;
}) {
  const display = value && value.trim() ? value : "—";
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
        {sub && <span className="font-medium normal-case text-faint"> · {sub}</span>}
      </div>
      <div
        className={[
          "mt-1.5 text-sm text-foreground",
          mono ? "font-mono tabular-nums" : "",
          bangla ? "whitespace-pre-wrap leading-relaxed" : "",
        ].join(" ")}
      >
        {display}
      </div>
    </div>
  );
}

/** Company identity card (FR-MAS-001/004). Read/edit, discard guard, conflict reload. */
export function CompanyIdentityCard({
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
  const [discardOpen, setDiscardOpen] = useState(false);
  const { mutate, isPending } = useUpdateCompanyIdentity();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<CompanyIdentityValues>({
    resolver: zodResolver(companyIdentitySchema),
    defaultValues: { name: "", legalName: "", bin: "", tin: "", address: "" },
  });

  function startEdit() {
    if (!company) return;
    reset({
      name: company.name,
      legalName: company.legalName ?? "",
      bin: company.bin ?? "",
      tin: company.tin ?? "",
      address: company.address ?? "",
    });
    setConflict(false);
    setEditing(true);
  }

  function requestCancel() {
    if (isDirty) setDiscardOpen(true);
    else setEditing(false);
  }

  function confirmDiscard() {
    setDiscardOpen(false);
    setEditing(false);
  }

  function onSubmit(values: CompanyIdentityValues) {
    if (!company) return;
    setConflict(false);
    mutate(
      {
        name: values.name.trim(),
        legalName: values.legalName || null,
        bin: values.bin || null,
        tin: values.tin || null,
        address: values.address || null,
        version: company.version,
      },
      {
        onSuccess: () => {
          toast("Company details saved.", "success");
          setEditing(false);
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
            setConflict(true);
          } else if (e.code === "FORBIDDEN") {
            toast("You don't have permission to change company settings.", "error");
          } else if (e.code === "NETWORK_ERROR") {
            toast("You're offline. Changes weren't saved.", "error");
          } else if (e.isValidation && e.details) {
            const d = e.details as Record<string, string[] | string>;
            for (const f of ["name", "legalName", "bin", "tin", "address"] as const) {
              const msg = Array.isArray(d[f])
                ? (d[f] as string[])[0]
                : (d[f] as string | undefined);
              if (msg) setError(f, { message: String(msg) });
            }
          } else {
            toast(e.message || "Couldn't save company details.", "error");
          }
        },
      },
    );
  }

  const badge = company?.isActive ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : undefined;

  return (
    <>
      <EditableCard
        title="Company identity"
        headingId={HEADING_ID}
        badge={badge}
        isEditing={editing}
        canEdit={canEdit && !isLoading && !isError}
        saving={isPending}
        onEdit={startEdit}
        onCancel={requestCancel}
        onSave={handleSubmit(onSubmit)}
        data-testid="identity-card"
      >
        {isError ? (
          <Alert tone="destructive" title="Couldn't load company details.">
            <div className="flex flex-col items-start gap-2">
              <span>The server returned an error. Check your connection and try again.</span>
              <Button size="sm" onClick={onReload} data-testid="identity-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : isLoading || !company ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" data-testid="identity-loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-2.5 w-2/5" />
                <Skeleton className="mt-2.5 h-3.5 w-3/4" />
              </div>
            ))}
          </div>
        ) : editing ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate data-testid="identity-form">
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
                      data-testid="identity-conflict-reload"
                    >
                      Reload
                    </Button>
                  </div>
                </Alert>
              </div>
            )}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="co-name" className="mb-1.5 block text-[10.5px]">
                  Company name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="co-name"
                  invalid={!!errors.name}
                  disabled={isPending}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="co-legal" className="mb-1.5 block text-[10.5px]">
                  Legal name
                </Label>
                <Input id="co-legal" disabled={isPending} {...register("legalName")} />
              </div>
              <div>
                <Label htmlFor="co-bin" className="mb-1.5 block text-[10.5px]">
                  BIN <span className="font-medium normal-case text-faint">· VAT / Mushak</span>
                </Label>
                <Input
                  id="co-bin"
                  className="font-mono"
                  invalid={!!errors.bin}
                  disabled={isPending}
                  {...register("bin")}
                />
                {errors.bin && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.bin.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="co-tin" className="mb-1.5 block text-[10.5px]">
                  TIN
                </Label>
                <Input
                  id="co-tin"
                  className="font-mono"
                  invalid={!!errors.tin}
                  disabled={isPending}
                  {...register("tin")}
                />
                {errors.tin && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.tin.message}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="co-address" className="mb-1.5 block text-[10.5px]">
                  Address
                </Label>
                <Textarea id="co-address" disabled={isPending} {...register("address")} />
              </div>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ReadField label="Company name" value={company.name || "Not set"} />
            <ReadField label="Legal name" value={company.legalName} />
            <ReadField label="BIN" sub="VAT / Mushak" value={company.bin} mono />
            <ReadField label="TIN" value={company.tin} mono />
            <ReadField label="Address" value={company.address} full bangla />
          </div>
        )}
      </EditableCard>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent hideClose data-testid="discard-dialog">
          <DialogTitle>Discard changes?</DialogTitle>
          <DialogDescription className="mt-2">Your unsaved changes will be lost.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="outline" size="md" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={confirmDiscard}
              data-testid="discard-confirm"
            >
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
