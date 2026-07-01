"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-side slide-over panel (design-system §5.1 Drawer/Sheet). Same Radix Dialog
 * primitive as `Dialog` — focus-trap, ESC, scroll-lock, focus restored on close —
 * anchored to the right edge. Used for create/edit forms on small entities.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-[fadeIn_0.2s_ease]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 flex h-full w-[440px] max-w-[94%] flex-col bg-surface shadow-lg",
        "data-[state=open]:animate-[slideInRight_0.24s_ease] focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({
  kicker,
  title,
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border px-6 py-5",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker && (
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
            {kicker}
          </div>
        )}
        <DialogPrimitive.Title className="mt-0.5 truncate text-lg font-bold tracking-[-0.01em] text-foreground">
          {title}
        </DialogPrimitive.Title>
      </div>
      <DialogPrimitive.Close
        aria-label="Close"
        className="grid h-8 w-8 flex-none place-items-center rounded-token border border-border-strong bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden />
      </DialogPrimitive.Close>
    </div>
  );
}

export function SheetBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex-1 overflow-auto px-6 py-5", className)}>{children}</div>;
}

export function SheetFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2.5 border-t border-border px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Visually-hidden description slot so Radix has an accessible description when needed. */
export const SheetDescription = DialogPrimitive.Description;
