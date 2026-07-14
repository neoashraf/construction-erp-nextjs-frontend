import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * FE-52 — the change-password link-out (FR-AUD-035). This screen never
 * re-implements the change-password flow; it routes to FE-16 (/change-password).
 */
export function ChangePasswordLink() {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5" data-testid="profile-change-password">
      <div>
        <h3 className="text-[13.5px] font-semibold text-foreground">Change password</h3>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          Update your password on the change-password screen.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild className="gap-1.5">
        <Link href="/change-password" data-testid="profile-change-password-link">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          Change password
        </Link>
      </Button>
    </Card>
  );
}
