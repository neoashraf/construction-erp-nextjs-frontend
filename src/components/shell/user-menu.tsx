"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

/**
 * Sidebar-footer user block + upward menu (App Shell v3 — spec §5/§8/§10; AUD).
 * The profile is docked at the sidebar bottom (NOT the topbar): avatar + name + role
 * open an UPWARD popover — identity header (name · role · email from the session
 * `me` read) then Change password (→ `/change-password`) and Sign out
 * (`POST /api/auth/logout` → login, "Signed out." toast). Role/email are read-only
 * (single role per user). `variant`:
 *  - "footer"  — the expanded-sidebar block (navy surface, full identity)
 *  - "rail"    — collapsed 56px rail: avatar only, menu opens as an upward flyout
 *  - "drawer"  — pinned at the mobile drawer bottom (same block as footer)
 */
export interface UserMenuUser {
  name: string;
  role: Role;
  email: string;
}

export function UserMenu({
  user,
  variant = "footer",
}: {
  user: UserMenuUser;
  variant?: "footer" | "rail" | "drawer";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const initials = user.name
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

  const avatar = (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink"
      aria-hidden
    >
      {initials}
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="user-menu"
          aria-haspopup="menu"
          aria-label={variant === "rail" ? `Account — ${user.name}` : undefined}
          className={cn(
            "flex items-center rounded-token transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            variant === "rail"
              ? "justify-center p-1 hover:bg-sidebar-hover"
              : "w-full gap-2.5 px-2 py-1.5 text-left hover:bg-sidebar-hover",
          )}
        >
          {avatar}
          {variant !== "rail" && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-sidebar-active-foreground">
                  {user.name}
                </span>
                <span className="block truncate text-[11px] text-sidebar-muted">
                  {roleLabel(user.role)}
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" aria-hidden />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      {/* Upward popover — the block sits at the viewport bottom (spec §10). */}
      <DropdownMenuContent
        aria-label="Account"
        side={variant === "rail" ? "right" : "top"}
        align={variant === "rail" ? "end" : "start"}
        className="min-w-[220px]"
      >
        <div className="border-b border-border px-2.5 pb-2 pt-1">
          <div className="truncate text-[13px] font-semibold text-foreground">{user.name}</div>
          <div className="text-[11px] text-muted-foreground">{roleLabel(user.role)}</div>
          <div data-testid="user-menu-email" className="truncate text-[11px] text-muted-foreground">
            {user.email}
          </div>
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
