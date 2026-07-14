import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/auth/roles";
import { type ProfileView } from "../types";

/**
 * Read-only detail grid (spec §4/§5) — role, account status, default FY, last
 * login. Deliberately renders no controls (privilege-escalation guard FR-AUD-033).
 * The FY id is resolved via the caller-provided label map — falls back to the raw
 * id when unknown so the UI never silently swallows an unmapped FY.
 */
export interface FinancialYearLabelResolver {
  (fyId: string): string;
}

export function ProfileDetailsGrid({
  profile,
  resolveFyLabel,
}: {
  profile: ProfileView;
  resolveFyLabel: FinancialYearLabelResolver;
}) {
  const lastLogin =
    profile.lastLoginAt !== null && profile.lastLoginAt !== undefined
      ? safeFormatDateTime(profile.lastLoginAt)
      : "Never";

  return (
    <Card className="p-5" data-testid="profile-details-grid">
      <dl className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Role" testid="profile-detail-role">
          {roleLabel(profile.role)}
        </ReadOnlyField>
        <ReadOnlyField label="Account status" testid="profile-detail-status">
          <Badge tone={profile.isActive ? "success" : "neutral"} dot>
            {profile.isActive ? "Active" : "Inactive"}
          </Badge>
        </ReadOnlyField>
        <ReadOnlyField label="Email" testid="profile-detail-email">
          <span className="break-all">{profile.email}</span>
        </ReadOnlyField>
        <ReadOnlyField label="Default financial year" testid="profile-detail-fy">
          {resolveFyLabel(profile.financialYearId)}
        </ReadOnlyField>
        <ReadOnlyField label="Last login" testid="profile-detail-last-login">
          {lastLogin}
        </ReadOnlyField>
      </dl>
      <p className="mt-4 text-[12px] text-muted-foreground" data-testid="profile-contact-admin-hint">
        Contact an admin to change your email or role.
      </p>
    </Card>
  );
}

function ReadOnlyField({
  label,
  children,
  testid,
}: {
  label: string;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <div data-testid={testid}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] text-foreground" aria-readonly>
        {children}
      </dd>
    </div>
  );
}

function safeFormatDateTime(value: string): string {
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}
