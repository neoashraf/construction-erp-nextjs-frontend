"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { Button } from "@/components/ui/button";

/**
 * Logout (skill §4). Calls the BFF /api/auth/logout (CSRF double-submit token in
 * the header), which revokes the refresh token and clears every auth cookie, then
 * routes back to login. A subsequent guarded request will redirect to login.
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await apiClient.post("/auth/logout", undefined, { csrfToken: readCsrfToken() });
    } catch {
      // Even if the upstream revoke fails, the BFF clears cookies; proceed to login.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onLogout} disabled={busy} data-testid="logout-button">
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
