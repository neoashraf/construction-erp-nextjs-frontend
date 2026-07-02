"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { quickCreateForRole, type Role } from "@/lib/nav/nav-tree";

/**
 * "+ New" quick-create menu (screen spec §5/§11; NFR-007). A role-filtered dropdown of
 * create targets, each pure navigation to that editor's create route. Only
 * `built && role-permitted` targets render (`quickCreateForRole`); the whole button is
 * hidden if the role has none. In Phase-1 v2 all voucher editors are unbuilt, so the
 * button is hidden for every role until an editor brief flips its `built` flag on.
 */
export function QuickCreateMenu({ role }: { role: Role }) {
  const router = useRouter();
  const targets = quickCreateForRole(role);
  if (targets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="quick-create"
          className="inline-flex h-9 items-center gap-1.5 rounded-token bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Create new">
        {targets.map((t) => (
          <DropdownMenuItem
            key={t.route}
            data-testid={`quick-create-${t.label}`}
            onSelect={() => router.push(t.route)}
          >
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
