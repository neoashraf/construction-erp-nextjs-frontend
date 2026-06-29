import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server-session";

/**
 * Root entry. Authenticated → into the app shell; otherwise → login. (No landing
 * page ships in the scaffold — screens come later.)
 */
export default async function RootPage() {
  const user = await getServerSession();
  redirect(user ? "/dashboard" : "/login");
}
