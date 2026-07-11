"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { asApiError } from "@/lib/api/errors";
import { type Project, type ProjectStatus } from "../types";
import { type StatusAction } from "../api/projects";
import { useChangeProjectStatus } from "../hooks/useProjects";

interface ActionDef {
  action: StatusAction;
  label: string;
  done: string;
  confirm?: { title: string; body: string };
  destructive?: boolean;
}

const CLOSE_CONFIRM = {
  title: "Close this project?",
  body: "Closing sets the actual end date and stops new postings. You can reopen it later.",
};

function actionsFor(status: ProjectStatus, isAdmin: boolean): ActionDef[] {
  switch (status) {
    case "PLANNED":
      return [{ action: "activate", label: "Activate", done: "Project activated." }];
    case "ACTIVE":
      return [
        { action: "hold", label: "Put on hold", done: "Project put on hold." },
        {
          action: "close",
          label: "Close project",
          done: "Project closed.",
          destructive: true,
          confirm: CLOSE_CONFIRM,
        },
      ];
    case "ON_HOLD":
      return [
        { action: "resume", label: "Resume", done: "Project resumed." },
        {
          action: "close",
          label: "Close project",
          done: "Project closed.",
          destructive: true,
          confirm: CLOSE_CONFIRM,
        },
      ];
    case "CLOSED":
      return isAdmin
        ? [
            {
              action: "reopen",
              label: "Reopen",
              done: "Project reopened.",
              confirm: {
                title: "Reopen this project?",
                body: "Reopening sets the project back to Active so postings can resume.",
              },
            },
          ]
        : [];
    default:
      return [];
  }
}

/** Status lifecycle control (FR-MAS-006, spec §9). Offers only valid transitions. */
export function StatusActionButton({
  project,
  isAdmin,
  onDone,
  onError,
  onReload,
}: {
  project: Project;
  isAdmin: boolean;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onReload: () => void;
}) {
  const { mutate, isPending } = useChangeProjectStatus();
  const [confirming, setConfirming] = useState<ActionDef | null>(null);
  const actions = actionsFor(project.status, isAdmin);

  function run(a: ActionDef) {
    mutate(
      { id: project.id, action: a.action, version: project.version },
      {
        onSuccess: () => {
          onDone(a.done);
          setConfirming(null);
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.code === "INVALID_STATUS_TRANSITION")
            onError("That status change is no longer valid. Reload and try again.");
          else if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
            onError("This project was changed by someone else. Reload and try again.");
            onReload();
          } else if (e.code === "NETWORK_ERROR")
            onError("You're offline. Try again when reconnected.");
          else if (e.code === "FORBIDDEN") onError("You don't have permission to do that.");
          else onError(e.message || "Couldn't change the status.");
          setConfirming(null);
        },
      },
    );
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-none gap-2">
      {actions.map((a) => (
        <Button
          key={a.action}
          variant={
            a.destructive
              ? "outline"
              : a.action === "activate" || a.action === "resume" || a.action === "reopen"
                ? "primary"
                : "outline"
          }
          size="md"
          disabled={isPending}
          onClick={() => (a.confirm ? setConfirming(a) : run(a))}
          data-testid={`status-${a.action}`}
          // Destructive outline (Projects.dc.html): red text + red-tinted border.
          className={
            a.destructive
              ? "border-destructive-soft text-destructive-ink hover:bg-destructive-soft"
              : undefined
          }
        >
          {a.label}
        </Button>
      ))}

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent hideClose data-testid="status-confirm-dialog">
          <DialogTitle>{confirming?.confirm?.title}</DialogTitle>
          <DialogDescription className="mt-2">{confirming?.confirm?.body}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => setConfirming(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant={confirming?.destructive ? "destructive" : "primary"}
              size="md"
              onClick={() => confirming && run(confirming)}
              disabled={isPending}
              data-testid="status-confirm"
            >
              {isPending ? "Working…" : confirming?.label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
