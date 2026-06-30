import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, CheckCircle2, AlertTriangle, CircleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline alert / banner (design-system §5.3). Tone carries meaning. */
const alertVariants = cva("flex gap-3 rounded-card border border-border p-3 text-sm", {
  variants: {
    tone: {
      info: "bg-info-soft",
      success: "bg-success-soft",
      warning: "bg-warning-soft",
      destructive: "bg-destructive-soft",
    },
  },
  defaultVariants: { tone: "info" },
});

type AlertTone = NonNullable<VariantProps<typeof alertVariants>["tone"]>;

const ICON: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: CircleAlert,
};
const ICON_COLOR: Record<AlertTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};
const TITLE_COLOR: Record<AlertTone, string> = {
  info: "text-info-ink",
  success: "text-success-ink",
  warning: "text-warning-ink",
  destructive: "text-destructive-ink",
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, tone, title, children, ...props }: AlertProps) {
  const t: AlertTone = tone ?? "info";
  const Icon = ICON[t];
  return (
    <div role="alert" className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_COLOR[t])} aria-hidden />
      <div className="min-w-0">
        {title ? <p className={cn("font-semibold", TITLE_COLOR[t])}>{title}</p> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
