"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api/errors";
import { Input } from "@/components/ui/input";
import { type Purpose } from "../types";
import { usePurposes, useCreatePurpose } from "../hooks/usePurposes";

/**
 * Shared inline-create purpose combobox (FR-MAS-012/013, spec §5/§9/§10). ARIA
 * combobox with typeahead over active purposes; a "Create '<typed>'" option appears
 * when the trimmed text matches nothing (case-insensitive). Create is server-
 * confirmed and idempotent (an existing name returns 200 and is selected silently).
 * Works to ≥360 for site voucher forms. Reused by every voucher line later.
 */
export function PurposeCombobox({
  projectId,
  value,
  onChange,
  canCreate = true,
  closedProject = false,
  disabled = false,
  id: idProp,
}: {
  projectId: string;
  value: Purpose | null;
  onChange: (p: Purpose) => void;
  canCreate?: boolean;
  closedProject?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const reactId = useId();
  const listId = `${idProp ?? reactId}-listbox`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const create = useCreatePurpose();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const query = usePurposes(open ? projectId : null, { isActive: true, q: debounced || undefined });
  const purposes = useMemo(() => query.data?.data ?? [], [query.data]);

  const trimmed = text.trim();
  const exactMatch = purposes.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = canCreate && trimmed !== "" && !exactMatch;

  // Options list = purposes (+ synthetic create at the end).
  const optionCount = purposes.length + (showCreate ? 1 : 0);
  useEffect(() => {
    if (active >= optionCount) setActive(Math.max(0, optionCount - 1));
  }, [optionCount, active]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function selectExisting(p: Purpose) {
    onChange(p);
    setText("");
    setOpen(false);
  }

  function doCreate() {
    if (closedProject || !trimmed) return;
    setCreateError(null);
    create.mutate(
      { projectId, name: trimmed },
      {
        onSuccess: (p) => {
          onChange(p); // idempotent: existing or new purpose
          setText("");
          setOpen(false);
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "NETWORK_ERROR") setCreateError("Can't create a purpose while offline.");
          else if (e.code === "CLOSED_PROJECT")
            setCreateError("This project is closed — new purposes are blocked.");
          else setCreateError(e.message || "Couldn't create the purpose.");
        },
      },
    );
  }

  function chooseActive() {
    if (showCreate && active === purposes.length) doCreate();
    else if (purposes[active]) selectExisting(purposes[active]!);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => Math.min(optionCount - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open) chooseActive();
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const activeId = open && optionCount > 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <div ref={rootRef} className="relative" data-testid="purpose-combobox">
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          id={idProp}
          disabled={disabled}
          value={open ? text : (value?.name ?? "")}
          placeholder={value ? value.name : "Select or create a purpose…"}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setCreateError(null);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="pr-9"
          data-testid="purpose-combobox-input"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>

      {open && (
        <ul
          role="listbox"
          id={listId}
          aria-label="Purposes"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border-strong bg-surface p-1 shadow-md"
        >
          {query.isLoading ? (
            <li
              className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground"
              data-testid="purpose-loading"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </li>
          ) : query.isError ? (
            <li className="flex flex-col items-start gap-1 px-2.5 py-2 text-sm">
              <span className="text-destructive-ink">Couldn&apos;t load purposes.</span>
              <button
                type="button"
                onClick={() => query.refetch()}
                className="text-xs font-semibold text-accent-ink hover:underline"
                data-testid="purpose-retry"
              >
                Retry
              </button>
            </li>
          ) : (
            <>
              {purposes.map((p, i) => (
                <li
                  key={p.id}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={value?.id === p.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => selectExisting(p)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-token px-2.5 py-1.5 text-sm",
                    active === i && "bg-muted",
                  )}
                  data-testid={`purpose-option-${p.id}`}
                >
                  <span className="truncate">{p.name}</span>
                  {value?.id === p.id && <Check className="h-4 w-4 text-accent-ink" aria-hidden />}
                </li>
              ))}
              {purposes.length === 0 && !showCreate && (
                <li className="px-2.5 py-2 text-sm text-faint">
                  No purposes yet — type to create one.
                </li>
              )}
              {showCreate && (
                <li
                  id={`${listId}-opt-${purposes.length}`}
                  role="option"
                  aria-selected={false}
                  aria-disabled={closedProject}
                  onMouseEnter={() => setActive(purposes.length)}
                  onClick={doCreate}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-token px-2.5 py-1.5 text-sm",
                    active === purposes.length && "bg-muted",
                    closedProject && "cursor-not-allowed opacity-60",
                  )}
                  data-testid="purpose-create-option"
                >
                  {create.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-accent-ink" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4 text-accent-ink" aria-hidden />
                  )}
                  <span>
                    Create &lsquo;<span className="font-semibold">{trimmed}</span>&rsquo;
                  </span>
                </li>
              )}
              {closedProject && showCreate && (
                <li className="px-2.5 pb-1 pt-0.5 text-[11.5px] text-faint">
                  This project is closed — new purposes are blocked.
                </li>
              )}
              {createError && (
                <li
                  className="px-2.5 py-1 text-[11.5px] text-destructive-ink"
                  data-testid="purpose-create-error"
                >
                  {createError}
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
