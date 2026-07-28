import { Avatar, deriveInitials } from "@/components/ui/avatar";
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
 * Account-screen avatar preview — the shared `ui/avatar` primitive with this
 * screen's size, ring and testids. The photo-or-initials logic itself lives in
 * `@/components/ui/avatar` so the app-shell sidebar-footer user block renders the
 * same disc from the same one `deriveInitials` (spec §10; FR-AUD-038).
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
  return (
    <Avatar
      name={name}
      avatarUrl={avatarUrl}
      size={size}
      ring
      testId="profile-avatar-image"
      initialsTestId="profile-avatar-initials"
    />
  );
}

export { deriveInitials };

