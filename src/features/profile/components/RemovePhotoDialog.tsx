import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * FE-52 — confirm dialog for the avatar-remove flow (spec §6). Copy pinned to
 * the design/spec — Confirm = "Remove", Cancel = "Keep photo".
 */
export function RemovePhotoDialog({
  open,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : onCancel())}>
      <DialogContent hideClose data-testid="profile-remove-photo-dialog">
        <DialogTitle>Remove profile photo?</DialogTitle>
        <DialogDescription className="mt-2">
          Your avatar will fall back to your initials. You can upload a new photo any time.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            data-testid="profile-remove-photo-cancel"
          >
            Keep photo
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
            data-testid="profile-remove-photo-confirm"
          >
            {busy ? "Removing…" : "Remove"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
