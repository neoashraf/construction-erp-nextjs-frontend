"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

/**
 * Copyable entity-id (design file — mono id + copy icon; spec §5/§10). An
 * accessible "Copy id" label on the icon button (not just a bare icon) so a
 * screen-reader announces its purpose (spec §10).
 */
export function CopyableEntityId({ id, className }: { id: string; className?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(id);
      setCopied(true);
      toast("Copied entity id.", "success");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Couldn't copy the id.", "error");
    }
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate font-mono text-[12px] text-info-ink" title={id}>
        {id}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy id"
        title="Copy id"
        className="shrink-0 text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus"
        data-testid="copy-entity-id"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </span>
  );
}
