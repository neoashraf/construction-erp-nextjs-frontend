import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server-session";
import { LoginForm } from "./login-form";

/**
 * Login route — auth-flow PLUMBING only (the designed login screen is a later
 * brief). An already-authenticated visitor is sent into the app shell.
 */
export default async function LoginPage() {
  const user = await getServerSession();
  if (user) redirect("/dashboard");
  return <LoginForm />;
}
