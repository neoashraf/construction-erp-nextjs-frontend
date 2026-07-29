"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { IsoDateField } from "./IsoDateField";
import { type GovernmentHoliday } from "../api/holidays";
import { useSaveHoliday } from "../hooks/useHolidays";
import { formatDayLabel } from "../lib/attendance-time";
import { weekdayName } from "../lib/holiday-types";

/**
 * Add / edit a holiday (FR-HR-008d).
 *
 * The backend upserts by date, so a save onto an existing date is an OVERWRITE — the
 * collision is detected from the loaded year and stated in the drawer BEFORE the call
 * (including the one-way door: replacing an `import` row converts it to `manual`,
 * permanently exempting the date from future feed syncs), not only in the toast wording.
 *
 * There is deliberately NO Type control: no stored category exists on `GovernmentHoliday`
 * (SRS §16 records the two options for the client), and a select whose value is silently
 * discarded on save must not ship on a payroll-critical screen. The read-side Type column
 * stays as a client-side derivation.
 *
 * The date field's inline error is "Enter a valid date." — the server's own string names
 * the YYYY-MM-DD wire format the user has never seen, and is the spec's one deliberate
 * exception to rendering server validation strings verbatim.
 *
 * Closing is blocked while a save is in flight (backdrop + Esc), so the drawer can't
 * disappear midway and leave the outcome unreported.
 */
export function HolidayFormDrawer({
  open,
  year,
  existing,
  holidays,
  onClose,
}: {
  open: boolean;
  year: number;
  /** The holiday being edited, or null when adding. */
  existing: GovernmentHoliday | null;
  /** The loaded year, used to detect an overwrite by date. */
  holidays: GovernmentHoliday[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const save = useSaveHoliday(year);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [localName, setLocalName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  // Re-seed the fields whenever the drawer opens or switches target.
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setDate(existing?.date ?? "");
    setLocalName(existing?.localName ?? "");
    setNameError(null);
    setDateError(null);
  }, [open, existing]);

  // An entry on this date already exists (and isn't the one being edited) → overwrite.
  // Surfaced BEFORE the call — telling a user "saved" when they just replaced an existing
  // entry hides the fact that something was destroyed.
  const collision = useMemo(
    () => (date ? holidays.find((h) => h.date === date && h.id !== existing?.id) ?? null : null),
    [date, holidays, existing],
  );
  const collisionFromFeed = collision
    ? (collision.source ?? "").toLowerCase().includes("import")
    : false;

  function handleSubmit() {
    if (save.isPending) return;
    const trimmed = name.trim();
    const nameMissing = trimmed.length === 0;
    const dateMissing = date.length === 0;
    setNameError(nameMissing ? "Holiday name is required." : null);
    setDateError(dateMissing ? "Enter a valid date." : null);
    if (nameMissing || dateMissing) return;

    const isUpdate = Boolean(existing) || Boolean(collision);

    save.mutate(
      { date, name: trimmed, localName: localName.trim() || null },
      {
        onSuccess: () => {
          toast(isUpdate ? "Holiday updated." : "Holiday saved.", "success");
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.isValidation) {
            // Map the two known validation strings back onto their fields. The date
            // message is rewritten — the wire-format string describes the wire, not the
            // user's mistake (they have only ever seen DD/MM/YYYY).
            if (/YYYY-MM-DD/i.test(error.message)) {
              setDateError("Enter a valid date.");
              return;
            }
            if (/name is required/i.test(error.message)) {
              setNameError("Holiday name is required.");
              return;
            }
          }
          toast(error instanceof ApiError ? error.message : "Couldn't save holiday.", "error");
        },
      },
    );
  }

  if (!open) return null;

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        // Ignore dismissal (backdrop / ESC) while the save is running.
        if (!next && !save.isPending) onClose();
      }}
    >
      <SheetContent
        onInteractOutside={(e) => {
          if (save.isPending) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (save.isPending) e.preventDefault();
        }}
      >
        <SheetHeader
          kicker={existing ? "Edit holiday" : "New holiday"}
          title={existing ? existing.name : "Add holiday"}
        />

        <SheetBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-name">
                Holiday name <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input
                id="holiday-name"
                value={name}
                invalid={Boolean(nameError)}
                aria-describedby={nameError ? "holiday-name-error" : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="e.g. Independence Day"
                disabled={save.isPending}
              />
              {nameError ? (
                <p id="holiday-name-error" className="text-[11.5px] text-destructive-ink">
                  {nameError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-date">
                Date <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <div className="relative">
                <IsoDateField
                  id="holiday-date"
                  value={date}
                  invalid={Boolean(dateError)}
                  onChange={(next) => {
                    setDate(next);
                    if (dateError) setDateError(null);
                  }}
                  disabled={save.isPending}
                  className="pr-24"
                />
                {date ? (
                  <span
                    className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground"
                    aria-hidden
                  >
                    {weekdayName(date)}
                  </span>
                ) : null}
              </div>
              {dateError ? (
                <p id="holiday-date-error" className="text-[11.5px] text-destructive-ink">
                  {dateError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-local-name">Local name (Bangla)</Label>
              <Textarea
                id="holiday-local-name"
                rows={3}
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Optional — e.g. স্বাধীনতা দিবস"
                disabled={save.isPending}
              />
              <p className="text-[11.5px] text-muted-foreground">
                Shown beneath the English name everywhere the calendar is read.
              </p>
            </div>

            {collision ? (
              <Alert tone="warning" data-testid="overwrite-notice">
                <p className="font-semibold text-warning-ink">
                  {formatDayLabel(collision.date)} already has a holiday — &quot;{collision.name}&quot;.
                  Saving replaces it.
                </p>
                {collisionFromFeed ? (
                  <p>It will also become a hand-entered holiday, so future imports will leave it alone.</p>
                ) : null}
              </Alert>
            ) : null}
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save holiday"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
