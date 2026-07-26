"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { IsoDateField } from "./IsoDateField";
import { type GovernmentHoliday } from "../api/holidays";
import { useSaveHoliday } from "../hooks/useHolidays";
import { HOLIDAY_TYPES, holidayTypeOf, type HolidayType } from "../lib/holiday-types";

/**
 * Add / edit a holiday.
 *
 * The backend upserts by date, so a save onto an existing date is an update rather than a
 * duplicate. That case is detected *before* the call purely to choose the right wording —
 * telling the user "saved" when they actually overwrote an existing holiday hides the fact
 * that something was replaced.
 *
 * Closing is blocked while a save is in flight (including backdrop clicks), so the drawer
 * can't disappear midway and leave the outcome unreported.
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
  const [type, setType] = useState<HolidayType>("National");
  const [description, setDescription] = useState("");

  // Re-seed the fields whenever the drawer opens or switches target.
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setDate(existing?.date ?? "");
    setType(existing ? holidayTypeOf(existing) : "National");
    setDescription(existing?.localName ?? "");
  }, [open, existing]);

  const canSubmit = name.trim().length > 0 && date.length > 0 && !save.isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    // An entry on this date already exists (and isn't the one being edited) → overwrite.
    const collision = holidays.find((h) => h.date === date && h.id !== existing?.id);
    const isUpdate = Boolean(existing) || Boolean(collision);

    save.mutate(
      { date, name: name.trim(), localName: description.trim() || null },
      {
        onSuccess: () => {
          toast(isUpdate ? "Holiday updated" : "Holiday saved", "success");
          onClose();
        },
        onError: (error) => {
          toast(error instanceof ApiError ? error.message : "Could not save holiday", "error");
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
              <Label htmlFor="holiday-name">Holiday name</Label>
              <Input
                id="holiday-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Independence Day"
                disabled={save.isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-date">Date</Label>
              <IsoDateField
                id="holiday-date"
                value={date}
                onChange={setDate}
                disabled={save.isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-type">Type</Label>
              <Select
                id="holiday-type"
                value={type}
                disabled={save.isPending}
                onChange={(e) => setType(e.target.value as HolidayType)}
              >
                {HOLIDAY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <p className="text-[11.5px] text-muted-foreground">
                Type is derived from the holiday source when it comes from the government feed.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-description">Local name / description</Label>
              <Textarea
                id="holiday-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional — e.g. স্বাধীনতা দিবস"
                disabled={save.isPending}
              />
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {save.isPending ? "Saving…" : "Save holiday"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
