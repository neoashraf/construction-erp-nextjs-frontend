"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ChevronsUpDown, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

/**
 * Sidebar-footer user block + upward menu (App Shell v3 — spec §5/§8/§10; AUD).
 * The profile is docked at the sidebar bottom (NOT the topbar): avatar + name + role
 * open an UPWARD popover — identity header (avatar · name · role · email from the
 * session `me` read) then My profile (→ `/profile`), Change password
 * (→ `/change-password`) and Sign out (`POST /api/auth/logout` → login, "Signed out."
 * toast). Role/email are read-only (single role per user). `variant`:
 *  - "footer"  — the expanded-sidebar block (navy surface, full identity)
 *  - "rail"    — collapsed 56px rail: avatar only, menu opens as an upward flyout
 *  - "drawer"  — pinned at the mobile drawer bottom (same block as footer)
 *
 * The **avatar** is the user's profile photo (`user.avatarUrl`, FR-AUD-038) with an
 * initials fallback. It comes from the session projection `GET /api/auth/me` — never
 * from `GET /api/profile`, which is the account screen's own read. Uploading a photo
 * on My profile calls `refreshSession()`, so this block updates without a re-login.
 */
export interface UserMenuUser {
  name: string;
  role: Role;
  email: string;
  /**
   * Profile photo from the session `me` read (`avatarUrl`, FR-AUD-038). Absent on a
   * pre-field session snapshot, `null` when the user has no photo — both render the
   * initials disc. Set/cleared on the My-profile screen, which re-reads the session
   * so this block updates in place without a re-login.
   */
  avatarUrl?: string | null;
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

  /**
   * The user's photo when set, else the initials disc (spec §5 footer user block,
   * §6 no-photo/degraded/broken-image states). No `aria-hidden`: `<Avatar>` labels
   * itself (photo → descriptive `alt`; initials → `role="img"` + `aria-label`), and
   * in **rail** mode this disc is the only visible content of the trigger, so hiding
   * it from the a11y tree would leave the button announced by its own `aria-label`
   * alone. 32px per spec.
   */
  const avatar = <Avatar name={user.name} avatarUrl={user.avatarUrl} size={32} />;

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
        {/* Identity header — avatar · name · role · email (spec §5 user-menu row). The
            40px disc matters most in RAIL mode, where the trigger is a 32px avatar with
            no name beside it and this flyout is where identity is actually confirmed. */}
        <div className="flex items-center gap-2.5 border-b border-border px-2.5 pb-2 pt-1">
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size={40} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">{user.name}</div>
            <div className="text-[11px] text-muted-foreground">{roleLabel(user.role)}</div>
            <div
              data-testid="user-menu-email"
              className="truncate text-[11px] text-muted-foreground"
            >
              {user.email}
            </div>
          </div>
        </div>
        <DropdownMenuItem
          data-testid="user-menu-my-profile"
          className="mt-1"
          onSelect={() => router.push("/profile")}
        >
          <UserRound className="mr-2 h-4 w-4" aria-hidden />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="user-menu-change-password"
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
