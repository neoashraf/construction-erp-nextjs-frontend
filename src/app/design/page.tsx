import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export const metadata = { title: "Design System — Zakir ERP" };

/**
 * Living design-system gallery (design-system.md §12). A standalone route (outside
 * the auth shell) showing the tokens + primitives in one place — the visual contract
 * for screen design + a Playwright visual-regression target. Not a real app route.
 */
function Swatch({ name, hex, className }: { name: string; hex: string; className: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className={`h-14 ${className}`} />
      <div className="bg-surface px-2.5 py-2">
        <div className="text-xs font-semibold text-foreground">{name}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{hex}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-xs font-extrabold text-accent-foreground">
          ZE
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Zakir ERP — Design System
          </h1>
          <p className="text-sm text-muted-foreground">v1 · navy + lime · living component gallery</p>
        </div>
      </header>

      <Section title="Brand & neutrals">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Swatch name="Primary" hex="#1C2C4C" className="bg-primary" />
          <Swatch name="Accent" hex="#A3CE3C" className="bg-accent" />
          <Swatch name="Sidebar" hex="#16243F" className="bg-sidebar" />
          <Swatch name="Foreground" hex="#15181D" className="bg-foreground" />
          <Swatch name="Canvas" hex="#F6F7F9" className="bg-canvas" />
          <Swatch name="Border" hex="#ECEEF1" className="bg-border" />
        </div>
      </Section>

      <Section title="Functional / categorical">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Swatch name="Success" hex="#1FA46B" className="bg-success" />
          <Swatch name="Warning" hex="#E0922A" className="bg-warning" />
          <Swatch name="Destructive" hex="#E0484D" className="bg-destructive" />
          <Swatch name="Info" hex="#3B7DF6" className="bg-info" />
          <Swatch name="Violet" hex="#7C5CF6" className="bg-violet" />
          <Swatch name="Teal" hex="#12A8A8" className="bg-teal" />
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-2">
          <p className="text-2xl font-bold tracking-tight">Display / KPI — ৳ 1,84,00,000.00</p>
          <p className="text-lg font-semibold">Section header — Payment Voucher</p>
          <p className="text-base">Body emphasis — card title</p>
          <p className="text-sm">Body default (14px) — table cells, inputs, paragraphs.</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Micro label — field caption
          </p>
          <p className="font-mono text-sm">Mono — PV/2025-26/00042</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Post voucher</Button>
          <Button variant="outline">Save draft</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Reverse</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges & status">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status="posted" />
          <StatusBadge status="draft" />
          <StatusBadge status="overdue" />
          <StatusBadge status="reversed" />
          <Badge tone="info" dot>
            Info
          </Badge>
          <Badge tone="accent">Bridge-04</Badge>
        </div>
      </Section>

      <Section title="Inputs (lime focus)">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="f1">Party name</Label>
            <Input id="f1" placeholder="Search party…" defaultValue="ABC Cement Co." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f2">Voucher date</Label>
            <Input id="f2" placeholder="DD/MM/YYYY" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f3">Amount ৳</Label>
            <Input id="f3" invalid defaultValue="-100" />
            <p className="text-xs text-destructive-ink">Amount must be greater than zero.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f4">Reference</Label>
            <Input id="f4" disabled defaultValue="Auto-generated" />
          </div>
        </div>
        <p className="mt-3 text-xs text-faint">
          Click a field — focus shows the lime accent border + soft ring.
        </p>
      </Section>

      <Section title="Card">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Payment Voucher</CardTitle>
            <div className="ml-auto">
              <StatusBadge status="draft" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Party</span>
              <span>ABC Cement Co.</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Project</span>
              <span>Bridge-04 — Buriganga</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold tabular-nums">৳ 4,85,000.00</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              Save draft
            </Button>
            <Button size="sm">Post →</Button>
          </CardFooter>
        </Card>
      </Section>

      <p className="mt-12 border-t border-border pt-6 text-xs text-faint">
        Source of truth: docs/design/design-system.md · tokens in src/styles/tokens.css. Living
        gallery — not a route in the app shell.
      </p>
    </div>
  );
}
