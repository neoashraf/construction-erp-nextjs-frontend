"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { roleLabel, type Role } from "@/lib/auth/roles";

/**
 * User menu (screen spec §5/§8; AUD). Avatar + name · role opens a dropdown with
 * Change password (→ `/change-password`) and Sign out (`POST /api/auth/logout` →
 * login, "Signed out." toast). Replaces the standalone Sign-out button (absorbs the
 * old logout-button). Role label is read-only (single role per user).
 */
export function UserMenu({ name, role }: { name: string; role: Role }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function signOut() {
    setBusy(true);
    try {
      await apiClient.post("/auth/logout", undefined, { csrfToken: readCsrfToken() });
    } catch {
      // Even if the upstream revoke fails, the BFF clears cookies; proceed to login.
    } finally {
      toast("Signed out.");
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="user-menu"
          className="flex items-center gap-2.5 rounded-token py-1 pl-1 pr-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink"
            aria-hidden
          >
            {initials}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[160px] truncate text-[13px] font-medium text-foreground">{name}</span>
            <span className="block text-[11px] text-muted-foreground">{roleLabel(role)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Account">
        <div className="border-b border-border px-2.5 pb-2 pt-1">
          <div className="truncate text-[13px] font-semibold text-foreground">{name}</div>
          <div className="text-[11px] text-muted-foreground">{roleLabel(role)}</div>
        </div>
        <DropdownMenuItem
          data-testid="user-menu-change-password"
          className="mt-1"
          onSelect={() => router.push("/change-password")}
        >
          <KeyRound className="mr-2 h-4 w-4" aria-hidden />
          Change password
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="user-menu-signout"
          disabled={busy}
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          {busy ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
