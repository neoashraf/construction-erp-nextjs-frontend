"use client";

import { FileText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ReceiptType } from "../types";

/**
 * Two large choice cards — "IPC-linked receipt" vs "General receipt" (design §"Mode picker",
 * spec §1/§8). Rendered on create only; hidden when editing an existing draft (mode fixed
 * after first save — Open item 2). Keyboard-reachable: `Tab` between cards, `Enter`/`Space`
 * to pick; each card is a `role="radio"` inside a `role="radiogroup"` and the selection
 * change is announced via `aria-live="polite"` in the parent editor.
 */
export function ReceiptModePicker({
  value,
  onChange,
  disabled,
}: {
  value: ReceiptType | "";
  onChange: (mode: ReceiptType) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Receipt mode"
      data-testid="receipt-mode-picker"
      className="grid gap-3.5 sm:grid-cols-2"
    >
      <ModeCard
        icon={<FileText className="h-[19px] w-[19px]" aria-hidden />}
        title="IPC-linked receipt"
        description="Collect against a posted IPC and reduce its outstanding."
        selected={value === "IPC_LINKED"}
        onClick={() => onChange("IPC_LINKED")}
        disabled={disabled}
        testId="receipt-mode-ipc"
        tone="info"
      />
      <ModeCard
        icon={<Wallet className="h-[19px] w-[19px]" aria-hidden />}
        title="General receipt"
        description="Record income, an advance, or another non-IPC collection."
        selected={value === "GENERAL"}
        onClick={() => onChange("GENERAL")}
        disabled={disabled}
        testId="receipt-mode-general"
        tone="muted"
      />
    </div>
  );
}

function ModeCard({
  icon,
  title,
  description,
  selected,
  onClick,
  disabled,
  testId,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
  tone: "info" | "muted";
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      data-selected={selected || undefined}
      className={cn(
        "group flex items-start gap-3 rounded-card border p-4 text-left transition",
        selected
          ? "border-accent bg-accent-soft/60 shadow-focus"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "grid h-[38px] w-[38px] flex-none place-items-center rounded-token",
          tone === "info" ? "bg-info-soft text-info" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold text-foreground">{title}</span>
        <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-2",
          selected ? "border-accent" : "border-border-strong",
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            selected ? "bg-accent" : "bg-transparent",
          )}
        />
      </span>
    </button>
  );
}
