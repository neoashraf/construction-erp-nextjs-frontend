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
        {/* lime posting-dimension dot (design) */}
        <span
          className="pointer-events-none absolute left-3 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-accent"
          aria-hidden
        />
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          id={idProp}
          disabled={disabled}
          value={open ? text : (value?.name ?? "")}
          placeholder={value ? value.name : "Select or type a purpose"}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setCreateError(null);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-10 pl-7 pr-9"
          data-testid="purpose-combobox-input"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden
        />
      </div>

      {open && (
        <ul
          role="listbox"
          id={listId}
          aria-label="Purposes"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border-strong bg-surface p-1.5 shadow-md"
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
                    "flex h-[38px] cursor-pointer items-center gap-2.5 rounded-token px-2.5 text-[13.5px]",
                    active === i && "bg-muted",
                  )}
                  data-testid={`purpose-option-${p.id}`}
                >
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-success" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {value?.id === p.id && (
                    <Check className="h-4 w-4 flex-none text-accent-ink" aria-hidden />
                  )}
                </li>
              ))}
              {purposes.length === 0 && !showCreate && (
                <li className="px-2.5 py-2 text-sm text-faint">
                  No purposes yet — type to create one.
                </li>
              )}
              {showCreate && (
                <>
                  {purposes.length > 0 && (
                    <li role="presentation" className="mx-1.5 my-1 h-px bg-border" aria-hidden />
                  )}
                  <li
                    id={`${listId}-opt-${purposes.length}`}
                    role="option"
                    aria-selected={false}
                    aria-disabled={closedProject}
                    onMouseEnter={() => setActive(purposes.length)}
                    onClick={doCreate}
                    className={cn(
                      "flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-token px-2.5 py-1.5 text-[13.5px]",
                      active === purposes.length && "bg-accent-soft",
                      closedProject && "cursor-not-allowed opacity-60",
                    )}
                    data-testid="purpose-create-option"
                  >
                    <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-accent text-accent-foreground">
                      {create.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      Create{" "}
                      <span className="font-bold text-accent-ink">
                        &lsquo;{trimmed}&rsquo;
                      </span>
                    </span>
                  </li>
                </>
              )}
              {closedProject && showCreate && (
                <li className="px-2.5 pb-1 pt-0.5 text-[11.5px] text-faint">
                  This project is closed — new purposes are blocked.
                </li>
              )}
              {/* Idempotency cue (design): typing an existing name never duplicates —
                  it selects the existing purpose. */}
              {canCreate && trimmed !== "" && exactMatch && (
                <li
                  className="px-2.5 pb-1 pt-0.5 text-[11px] text-faint"
                  data-testid="purpose-idempotent-hint"
                >
                  This purpose already exists — it will be selected, not duplicated.
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
