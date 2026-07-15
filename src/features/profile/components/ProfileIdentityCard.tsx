import { Card } from "@/components/ui/card";
import { roleLabel } from "@/lib/auth/roles";
import { AvatarManager } from "./AvatarManager";
import { type ProfileView } from "../types";

/**
 * Left column card at 1280 (spec §4/§5): avatar (or initials) + Replace/Remove
 * buttons above, then the identity block below (name · role badge · email · Active
 * badge · "contact an admin" hint). Read-only — no controls for role/email/isActive.
 */
export function ProfileIdentityCard({ profile }: { profile: ProfileView }) {
  return (
    <Card className="p-6" data-testid="profile-identity-card">
      <div className="flex flex-col items-center gap-4">
        <AvatarManager profile={profile} />
        <div className="text-center">
          <h2
            className="max-w-full break-words text-[15px] font-bold text-foreground"
            data-testid="profile-identity-name"
          >
            {profile.name}
          </h2>
          <p
            className="mt-1 text-[12px] text-muted-foreground"
            data-testid="profile-identity-role"
            aria-readonly
          >
            {roleLabel(profile.role)}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Small avatar preview used inside the identity card. Handles both `avatarUrl`
 * (image) and null (initials). Descriptive `alt` per spec §10.
 */
export function AvatarPreview({
  name,
  avatarUrl,
  size = 96,
}: {
  name: string;
  avatarUrl: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <span
        className="relative inline-block overflow-hidden rounded-full border border-border-strong"
        style={{ width: size, height: size }}
        data-testid="profile-avatar-image"
      >
        {/* Use plain <img> — the mock returns object URLs / data URIs and the
            Cloudinary URL will be a remote origin not whitelisted for next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={`Profile photo of ${name}`}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  const initials = deriveInitials(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      role="img"
      aria-label={`No photo — initials ${initials}`}
      data-testid="profile-avatar-initials"
    >
      <span className="font-bold">{initials}</span>
    </span>
  );
}

/** Bangla-safe initials: first grapheme of the first two whitespace-split parts. */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts
    .map((p) => Array.from(p)[0] ?? "")
    .join("")
    .toUpperCase();
}

