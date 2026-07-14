"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { useSessionRefresh } from "@/providers/session-provider";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api/errors";
import { useUpdateProfile } from "../hooks/useUpdateProfile";
import { useProfileRead } from "../hooks/useProfile";
import {
  EMPTY_UPDATE_BACKSTOP,
  mapProfileUpdateError,
  validateNamePhone,
  type NamePhoneErrors,
  type NamePhoneFormValues,
} from "../schemas/profile";
import { type ProfileView } from "../types";

/**
 * FE-52 name/phone editor (spec §7). Only two fields — display name and phone.
 * Save is disabled until a field changes (dirty check); on submit we validate,
 * PATCH with `{ name?, phone?, version }`, re-seed the cache with the refreshed
 * ProfileView + bump `version`, refresh the session read so popover/header pick
 * up the new name. Stale-`409` triggers a refetch + banner (never a silent
 * overwrite).
 */
export function NamePhoneForm({ profile }: { profile: ProfileView }) {
  const online = useOnline();
  const { toast } = useToast();
  const refreshSession = useSessionRefresh();
  const readProfile = useProfileRead();
  const update = useUpdateProfile();

  const [values, setValues] = useState<NamePhoneFormValues>({
    name: profile.name,
    phone: profile.phone ?? "",
  });
  const [errors, setErrors] = useState<NamePhoneErrors>({});
  const [banner, setBanner] = useState<string | null>(null);

  // Reseed the form whenever the profile version bumps (post-save, or 409 refetch).
  useEffect(() => {
    setValues({ name: profile.name, phone: profile.phone ?? "" });
  }, [profile.version, profile.name, profile.phone]);

  const dirty = useMemo(() => {
    return values.name !== profile.name || values.phone !== (profile.phone ?? "");
  }, [values, profile.name, profile.phone]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!dirty) {
      setBanner(EMPTY_UPDATE_BACKSTOP);
      return;
    }
    if (!online) {
      setBanner("Can't reach the server. Check your connection and try again.");
      return;
    }
    const { errors: e2, normalisedName, normalisedPhone } = validateNamePhone(values);
    setErrors(e2);
    if (Object.keys(e2).length) return;

    // Send only the fields the caller actually changed. Empty-string phone ⇒ null.
    const body: { name?: string; phone?: string | null; version: number } = {
      version: profile.version,
    };
    if (normalisedName !== null && normalisedName !== profile.name) body.name = normalisedName;
    if (normalisedPhone !== (profile.phone ?? null)) body.phone = normalisedPhone as string | null;

    try {
      await update.mutateAsync(body);
      toast("Profile updated.", "success");
      void refreshSession();
    } catch (err) {
      const e3 = asApiError(err);
      if (e3.code === "OPTIMISTIC_LOCK_CONFLICT") {
        setBanner(mapProfileUpdateError(e3.code));
        // Re-fetch — the effect above reseeds the form when the new version arrives.
        void readProfile.refetch();
      } else if (e3.code === "VALIDATION_ERROR") {
        // Map any per-field detail if present; otherwise show the generic message.
        const details = (e3.details ?? {}) as Record<string, unknown>;
        setErrors({
          name: typeof details.name === "string" ? (details.name as string) : errors.name,
          phone: typeof details.phone === "string" ? (details.phone as string) : errors.phone,
        });
        setBanner(mapProfileUpdateError(e3.code));
      } else {
        setBanner(mapProfileUpdateError(e3.code));
      }
    }
  }

  function onCancel() {
    setValues({ name: profile.name, phone: profile.phone ?? "" });
    setErrors({});
    setBanner(null);
  }

  const saving = update.isPending;

  return (
    <Card className="p-6" data-testid="profile-name-phone-card">
      <form className="space-y-4" onSubmit={onSubmit} data-testid="profile-name-phone-form">
        {banner && (
          <Alert tone="destructive" title={banner} data-testid="profile-form-banner" />
        )}

        <div>
          <Label htmlFor="profile-name">Display name</Label>
          <Input
            id="profile-name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            invalid={!!errors.name}
            aria-describedby="profile-name-help profile-name-error"
            disabled={saving}
            data-testid="profile-name-input"
          />
          <p id="profile-name-help" className="mt-1 text-[11.5px] text-muted-foreground">
            Your name as shown across the app. Bangla is fine.
          </p>
          {errors.name && (
            <p
              id="profile-name-error"
              className="mt-1 text-[12px] text-destructive"
              role="alert"
              data-testid="profile-name-error"
            >
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="profile-phone">Phone number</Label>
          <Input
            id="profile-phone"
            type="tel"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
            invalid={!!errors.phone}
            aria-describedby="profile-phone-help profile-phone-error"
            placeholder="+8801712345678"
            disabled={saving}
            data-testid="profile-phone-input"
          />
          <p id="profile-phone-help" className="mt-1 text-[11.5px] text-muted-foreground">
            Include the country code (+880…). Leave blank to remove.
          </p>
          {errors.phone && (
            <p
              id="profile-phone-error"
              className="mt-1 text-[12px] text-destructive"
              role="alert"
              data-testid="profile-phone-error"
            >
              {errors.phone}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="submit"
            disabled={!dirty || saving || !online}
            className="gap-1.5"
            data-testid="profile-save"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={!dirty || saving}
            data-testid="profile-cancel"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
