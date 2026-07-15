"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSessionRefresh } from "@/providers/session-provider";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useDeleteAvatar, useUploadAvatar } from "../hooks/useAvatar";
import {
  mapAvatarDeleteError,
  mapAvatarUploadError,
  preCheckAvatar,
} from "../schemas/profile";
import { type ProfileView } from "../types";
import { AvatarPreview } from "./ProfileIdentityCard";
import { RemovePhotoDialog } from "./RemovePhotoDialog";

/**
 * FE-52 avatar block: preview (image or initials fallback) + Upload/Replace +
 * Remove. Client pre-check runs first (type / size); server-confirmed URL
 * replaces the preview only on success (FR-AUD-038/-039/-040/-042). Upload
 * progress is `aria-live` per spec §10; existing avatar untouched on any reject.
 */
export function AvatarManager({ profile }: { profile: ProfileView }) {
  const online = useOnline();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const upload = useUploadAvatar();
  const remove = useDeleteAvatar();
  const refreshSession = useSessionRefresh();

  const busy = upload.isPending || remove.isPending;
  const hasPhoto = !!profile.avatarUrl;

  async function onFile(file: File) {
    setAvatarError(null);
    const check = preCheckAvatar(file);
    if (!check.ok) {
      setAvatarError(check.message!);
      return;
    }
    if (!online) {
      setAvatarError("Can't reach the server. Check your connection and try again.");
      return;
    }
    try {
      await upload.mutateAsync(file);
      toast("Photo updated.", "success");
      void refreshSession();
    } catch (err) {
      setAvatarError(mapAvatarUploadError(asApiError(err).code));
    }
  }

  async function onConfirmRemove() {
    setAvatarError(null);
    if (!online) {
      setAvatarError("Can't reach the server. Check your connection and try again.");
      setRemoveOpen(false);
      return;
    }
    try {
      await remove.mutateAsync();
      setRemoveOpen(false);
      toast("Photo removed.", "success");
      void refreshSession();
    } catch (err) {
      setRemoveOpen(false);
      setAvatarError(mapAvatarDeleteError(asApiError(err).code));
    }
  }

  return (
    <div className="flex flex-col items-center gap-3" data-testid="profile-avatar-manager">
      <div className="relative">
        <AvatarPreview name={profile.name} avatarUrl={profile.avatarUrl} size={96} />
        {upload.isPending && (
          <span
            className="absolute inset-0 grid place-items-center rounded-full bg-foreground/40"
            role="status"
            aria-live="polite"
            data-testid="profile-avatar-uploading"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" aria-hidden />
            <span className="sr-only">Uploading photo…</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={busy || !online}
          data-testid="profile-avatar-upload"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {hasPhoto ? "Replace photo" : "Upload photo"}
        </Button>
        {hasPhoto && (
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setRemoveOpen(true)}
            disabled={busy || !online}
            data-testid="profile-avatar-remove"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-selecting the same file after a reject
          if (file) void onFile(file);
        }}
        data-testid="profile-avatar-file-input"
      />

      {avatarError && (
        <p
          className="text-center text-[12px] text-destructive"
          role="alert"
          data-testid="profile-avatar-error"
        >
          {avatarError}
        </p>
      )}

      <RemovePhotoDialog
        open={removeOpen}
        busy={remove.isPending}
        onConfirm={onConfirmRemove}
        onCancel={() => setRemoveOpen(false)}
      />
    </div>
  );
}
