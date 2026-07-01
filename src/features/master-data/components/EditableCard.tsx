"use client";

import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Read/edit card shell for the company-settings screen (design fidelity). Header
 * carries the section title (+ optional subtitle / right-side badge) and the
 * Edit → Cancel/Save controls; the body slot renders read view / edit form /
 * loading / error. Each card is an aria-labelledby region (spec §10).
 */
export function EditableCard({
  title,
  subtitle,
  headingId,
  badge,
  isEditing,
  canEdit,
  saving,
  onEdit,
  onCancel,
  onSave,
  children,
  "data-testid": testId,
}: {
  title: string;
  subtitle?: string;
  headingId: string;
  badge?: ReactNode;
  isEditing: boolean;
  canEdit: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Card role="region" aria-labelledby={headingId} data-testid={testId}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-[22px] py-[18px]">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          {subtitle && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-none items-center gap-2.5">
          {!isEditing && badge}
          {!isEditing && canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`${testId}-edit`}>
              Edit
            </Button>
          )}
          {isEditing && (
            <>
              <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving} data-testid={`${testId}-save`}>
                {saving && (
                  <span
                    className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/45 border-t-primary-foreground"
                    aria-hidden
                  />
                )}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="p-[22px]">{children}</div>
    </Card>
  );
}
