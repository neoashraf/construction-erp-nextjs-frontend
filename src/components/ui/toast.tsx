"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal toast system (design-system §5.1; state matrix success feedback). A
 * provider holds the queue and renders a bottom-centre viewport; `useToast()`
 * exposes `toast(message, tone?)`. Kept dependency-free and small — enough for the
 * create/edit/set-active confirmations and error nudges the master-data screens use.
 */

export type ToastTone = "default" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const DOT: Record<ToastTone, string> = {
  default: "bg-accent",
  success: "bg-success",
  error: "bg-destructive",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = "default") => {
      const id = (seq.current += 1);
      setItems((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => remove(id), 2600);
    },
    [remove],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto flex h-[42px] items-center gap-2.5 rounded-card px-4",
              "bg-foreground text-[13px] font-semibold text-background shadow-lg",
              "animate-[toastIn_0.22s_ease]",
            )}
          >
            <span className={cn("h-1.5 w-1.5 flex-none rounded-full", DOT[t.tone])} aria-hidden />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
