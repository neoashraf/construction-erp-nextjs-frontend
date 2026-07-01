import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server-session";
import { guardAuthenticated } from "@/lib/auth/guard";
import { ChangePasswordCard } from "@/features/audit/components/ChangePasswordCard";
import { ChangePasswordSkeleton } from "@/features/audit/components/ChangePasswordSkeleton";

/**
 * Change-password page (FE-16 / FR-AUD-006, FR-AUD-002). Renders as a centred
 * card on the grey canvas with NO app shell (the `(auth)` route group — same
 * layout as /login), even though the caller is authenticated. Any authenticated
 * user may reach it for their own account (spec §11) — an unauthenticated
 * visitor is bounced to /login (defence-in-depth; the BFF proxy also re-checks
 * the access token on submit). `?forced=1` selects the forced-change entry mode
 * (Admin reset / temporary password — SRS §16, _open-questions.md AUD 4).
 */
async function ChangePasswordGate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getServerSession();
  const decision = guardAuthenticated(user?.role);
  if (!decision.allow) redirect(decision.redirectTo);

  const params = await searchParams;
  const forced = params.forced === "1";

  return <ChangePasswordCard forced={forced} />;
}

export default function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ChangePasswordSkeleton />}>
      <ChangePasswordGate searchParams={searchParams} />
    </Suspense>
  );
}
