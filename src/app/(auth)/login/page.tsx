import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server-session";
import { LoginCard } from "@/features/audit/components/LoginCard";

/**
 * Login page — public route, no app shell (FR-AUD-001..004, FR-AUD-008, FR-AUD-009).
 * Already-authenticated visitors are redirected into the shell. The `?expired=1`
 * query param is set by the BFF proxy when a token refresh fails, which triggers the
 * "Your session has expired" banner on the card.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getServerSession();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const sessionExpired = params.expired === "1";

  return <LoginCard sessionExpired={sessionExpired} />;
}
