"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { displayMoney } from "../lib";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[11px]">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

/**
 * Generate salary sheet (FR-HR-013; Salary Sheet.dc.html). Calculates gross from
 * attendance + wage type + overtime for every active employee (inactive excluded).
 * A DRAFT already existing for the period surfaces a duplicate warning.
 */
export function GenerateSheetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState("2026-07");
  const duplicate = period === "2026-06";

  function generate() {
    if (duplicate) return;
    toast(`Draft salary sheet created for ${period}.`, "success");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]" data-testid="generate-dialog">
        <DialogTitle>Generate salary sheet</DialogTitle>
        <DialogDescription className="mt-1.5">
          This calculates gross pay from attendance, wage type, and overtime for every active
          employee. Inactive employees are excluded automatically.
        </DialogDescription>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Financial year" required>
            <Select defaultValue="2025-26">
              <option value="2025-26">FY 2025–26</option>
            </Select>
          </Field>
          <Field label="Period label" required>
            <Input
              className="font-mono"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2026-07"
            />
          </Field>
          <Field label="Period start" required>
            <Input className="font-mono" defaultValue="01/07/2026" />
          </Field>
          <Field label="Period end" required>
            <Input className="font-mono" defaultValue="31/07/2026" />
          </Field>
          <div className="col-span-2">
            <Field label="Project — optional scope">
              <Select defaultValue="ALL">
                <option value="ALL">All projects</option>
                <option value="Bridge-04 — Buriganga">Bridge-04 — Buriganga</option>
                <option value="Tower-A">Tower-A</option>
              </Select>
            </Field>
          </div>
        </div>

        {duplicate && (
          <div className="mt-3">
            <Alert tone="warning">
              A draft salary sheet already exists for this period. Edit it instead of generating a
              new one.
            </Alert>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={generate} disabled={duplicate}>
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PostLine {
  side: "DR" | "CR";
  account: string;
  amount: string;
}

/**
 * Post this salary run (FR-HR-015). Shows the balanced posting preview (Dr Gross
 * [+ Employer PF] / Cr Salary Payable + TDS + PF + Advance) and posts the SALARY
 * journal tagged to cost centre Labour. Once posted the run is locked; payslips appear.
 */
export function PostRunDialog({
  open,
  onClose,
  postLines,
  postTotal,
  grossTotal,
}: {
  open: boolean;
  onClose: () => void;
  postLines: PostLine[];
  postTotal: string;
  grossTotal: string;
}) {
  const { toast } = useToast();
  function post() {
    toast("Salary posted — entry SAL-2026-00007.", "success");
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]" data-testid="post-dialog">
        <DialogTitle>Post this salary run?</DialogTitle>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Balanced posting preview
          </span>
          <Badge tone="success" dot>
            Σ Dr = Σ Cr
          </Badge>
        </div>

        <div className="mt-2.5 overflow-hidden rounded-token border border-border">
          {postLines.map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
            >
              <Badge tone={l.side === "DR" ? "success" : "destructive"}>{l.side}</Badge>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                {l.account}
              </span>
              <span className="font-mono text-[12.5px] tabular-nums text-foreground">
                {displayMoney(l.amount)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-surface-2 px-3 py-2">
            <span className="text-[12px] font-semibold text-success-ink">Σ Debit = Σ Credit</span>
            <span className="font-mono text-[12.5px] font-bold tabular-nums text-success-ink">
              {displayMoney(postTotal)}
            </span>
          </div>
        </div>

        <DialogDescription className="mt-3">
          This posts a {displayMoney(grossTotal)} salary entry (Dr Gross Salary [+ Employer PF] / Cr
          Salary Payable + TDS + PF + Advance) tagged to cost centre Labour. Once posted, this run is
          locked — corrections require a reversal, and payslips become available.
        </DialogDescription>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={post}>
            Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reverse this salary run (FR-HR-018). Posts a reversing entry against the original;
 * the original stays on record. A reason is required.
 */
export function ReverseRunDialog({
  open,
  onClose,
  entryNo,
}: {
  open: boolean;
  onClose: () => void;
  entryNo: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState(false);

  function reverse() {
    if (!reason.trim()) {
      setErr(true);
      return;
    }
    toast("Salary run reversed — SAL-2026-00012.", "success");
    setReason("");
    setErr(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]" data-testid="reverse-dialog">
        <DialogTitle>Reverse this salary run?</DialogTitle>
        <DialogDescription className="mt-1.5">
          This posts a reversing entry against{" "}
          <span className="font-mono text-foreground">{entryNo}</span>. The original stays on record;
          a corrected sheet can be generated fresh.
        </DialogDescription>
        <div className="mt-3.5">
          <Field label="Reason" required>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (err) setErr(false);
              }}
              invalid={err}
              placeholder="e.g. TDS rate applied wrong for 3 staff — সংশোধন প্রয়োজন"
            />
          </Field>
          {err && (
            <p className="mt-1.5 text-[11.5px] text-destructive-ink">
              A reason is required to reverse a posted run.
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="outline"
            className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
            onClick={reverse}
          >
            Reverse
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A small "Σ Dr = Σ Cr" balanced pill, reused in the draft posting-preview card. */
export function BalancedPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-ink">
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      Balanced
    </span>
  );
}
