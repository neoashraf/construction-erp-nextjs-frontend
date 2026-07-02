"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, CornerDownLeft } from "lucide-react";
import { navDestinationsForRole, quickCreateForRole, type Role } from "@/lib/nav/nav-tree";
import { cn } from "@/lib/utils";

/**
 * Ctrl+K nav command palette (screen spec §5/§9/§14-1). A client-side command palette
 * over **nav items + quick-create actions only** — deliberately NOT entity search (no
 * backing endpoint). Type-ahead filters; Enter navigates the highlighted item; Esc
 * closes and restores focus (Radix Dialog manages the focus trap + restore).
 */
export function NavCommand({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo(() => {
    const nav = navDestinationsForRole(role).map((d) => ({
      key: `nav:${d.route}`,
      label: d.label,
      hint: d.moduleLabel,
      route: d.route,
    }));
    const create = quickCreateForRole(role).map((t) => ({
      key: `new:${t.route}`,
      label: `New ${t.label}`,
      hint: "Create",
      route: t.route,
    }));
    return [...nav, ...create];
  }, [role]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Global Ctrl/Cmd+K opens the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Reset the query + highlight each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(route: string) {
    setOpen(false);
    router.push(route);
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[active];
      if (chosen) go(chosen.route);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="nav-search-trigger"
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-token border border-border-strong bg-canvas px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted md:inline-flex"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span>Go to…</span>
        <kbd className="ml-2 rounded border border-border-strong bg-surface px-1.5 py-px text-[10px] font-semibold text-faint">
          Ctrl K
        </kbd>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-foreground/40 data-[state=open]:animate-[fadeIn_0.15s_ease]" />
          <DialogPrimitive.Content
            data-testid="nav-command"
            onKeyDown={onListKeyDown}
            className="fixed left-1/2 top-[18%] z-[80] w-[520px] max-w-[92%] -translate-x-1/2 rounded-xl border border-border-strong bg-surface shadow-lg focus:outline-none"
          >
            <DialogPrimitive.Title className="sr-only">Go to</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Search navigation and create actions
            </DialogPrimitive.Description>
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                data-testid="nav-command-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Go to… (Ctrl+K)"
                aria-label="Go to"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul role="listbox" aria-label="Results" className="max-h-[320px] overflow-auto p-2">
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">No matches.</li>
              ) : (
                results.map((c, i) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      data-testid={`nav-command-item-${c.route}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(c.route)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-token px-3 py-2 text-left text-[13px]",
                        i === active ? "bg-muted text-foreground" : "text-foreground",
                      )}
                    >
                      <span className="font-medium">{c.label}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{c.hint}</span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-faint" aria-hidden />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
