"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Avatar — the one profile-photo-or-initials disc (AUD self-service slice,
 * FR-AUD-038/-043; app-shell spec §5 sidebar-footer user block, §6 states).
 *
 * Two consumers, one implementation:
 *  - the **app shell** sidebar-footer user block (footer / rail / drawer), reading
 *    `avatarUrl` off the session `me` projection (`GET /api/auth/me`)
 *  - the **My profile** account screen, reading it off `GET /api/profile`
 *
 * Living here (not in `features/profile`) keeps the shell from importing a feature
 * module and — more importantly — keeps ONE `deriveInitials`. The shell previously
 * had its own `name.split(" ").map(p => p[0])`, which slices UTF-16 code units and
 * so mangles Bangla names; the grapheme-based version below is the only one now.
 *
 * A photo that fails to load (dead/rotated CDN URL) degrades to the initials disc
 * rather than a broken-image glyph (spec §6) — the avatar never blanks the shell.
 */
export function Avatar({
  name,
  avatarUrl,
  size = 32,
  ring = false,
  className,
  testId,
  initialsTestId,
}: {
  name: string;
  /** Served CDN URL, or null/undefined when the user has no photo (or the session is degraded). */
  avatarUrl: string | null | undefined;
  /** Rendered box in px — square. 32 in the shell, 96 on the account screen. */
  size?: number;
  /** Outline ring; on for the account-screen card, off on the navy sidebar. */
  ring?: boolean;
  className?: string;
  /** `data-testid` for the image branch. */
  testId?: string;
  /** `data-testid` for the initials branch. */
  initialsTestId?: string;
}) {
  // A URL that 404s/errors falls back to initials. Keyed on `avatarUrl` so a
  // replace-photo (new URL) clears a previous failure instead of staying broken.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatarUrl]);

  if (avatarUrl && !failed) {
    return (
      <span
        className={cn(
          "relative inline-block shrink-0 overflow-hidden rounded-full",
          ring && "border border-border-strong",
          className,
        )}
        style={{ width: size, height: size }}
        data-testid={testId}
      >
        {/* Plain <img>, not next/image: Cloudinary is a remote origin that is not in
            `images.remotePatterns`, and the mock BFF serves data: URIs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={`Profile photo of ${name}`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  const initials = deriveInitials(name);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-ink",
        ring && "border border-border-strong",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      role="img"
      aria-label={`No photo — initials ${initials}`}
      data-testid={initialsTestId}
    >
      {initials}
    </span>
  );
}

/**
 * Bangla-safe initials: the first **grapheme** of the first two whitespace-split
 * parts, uppercased. `Array.from` iterates code points, so a multi-byte Bangla
 * character survives where `name[0]` would split it into a broken half.
 */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts
    .map((p) => Array.from(p)[0] ?? "")
    .join("")
    .toUpperCase();
}
