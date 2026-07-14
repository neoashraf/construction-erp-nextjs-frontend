"use client";

import { AlertCircle, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useProfileRead } from "../hooks/useProfile";
import { useFinancialYearLabels } from "../hooks/useFinancialYearLabels";
import { AssignedProjects } from "./AssignedProjects";
import { ChangePasswordLink } from "./ChangePasswordLink";
import { NamePhoneForm } from "./NamePhoneForm";
import { ProfileDetailsGrid } from "./ProfileDetailsGrid";
import { ProfileIdentityCard } from "./ProfileIdentityCard";
import { PROFILE_LOAD_ERROR } from "../schemas/profile";

/**
 * FE-52 fe-account-profile — self-service My Profile (FR-AUD-029..043). Loaded
 * from the sidebar-footer user popover, **no breadcrumb**. Two-column layout at
 * ≥1024 (avatar+identity left; form + projects + detail grid + change-password
 * right), single-column stacked below. On 403 the shell routes out; here we
 * just show the load-error card as a defensive last resort.
 */
export function AccountProfileScreen() {
  const online = useOnline();
  const profile = useProfileRead();
  const fyLabels = useFinancialYearLabels();

  if (profile.isLoading) return <LoadingShell />;

  if (profile.isError) {
    const err = asApiError(profile.error);
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader />
        <Card className="mt-4 p-8" data-testid="profile-load-error">
          <EmptyState
            icon={AlertCircle}
            title={err.code === "FORBIDDEN" ? "Your account is deactivated." : PROFILE_LOAD_ERROR}
            action={
              <Button size="md" onClick={() => profile.refetch()} data-testid="profile-load-error-retry">
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const data = profile.data!;
  const resolveFy = (id: string) =>
    fyLabels.data?.find((f) => f.id === id)?.label ?? id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="profile-screen">
      <PageHeader />

      {!online && (
        <Alert
          tone="warning"
          title="You're offline."
          className="mt-4"
          data-testid="profile-offline"
        >
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Save and photo actions are disabled until you reconnect.
          </span>
        </Alert>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <ProfileIdentityCard profile={data} />
        </div>
        <div className="space-y-4">
          <NamePhoneForm profile={data} />
          <AssignedProjects assigned={data.assignedProjects} />
          <ProfileDetailsGrid profile={data} resolveFyLabel={resolveFy} />
          <ChangePasswordLink />
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="mb-1">
      <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="profile-title">
        My profile
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        A single self-service screen where you see who you are and manage your identity — display
        name, phone, and photo. Everything else is read-only and managed by an admin.
      </p>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="profile-loading">
      <div className="mb-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-32" />
          </Card>
          <Card className="space-y-3 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}

