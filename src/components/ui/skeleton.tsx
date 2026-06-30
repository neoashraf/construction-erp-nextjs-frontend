import * as React from "react";
import { cn } from "@/lib/utils";

/** Loading-state skeleton (design-system §5.1; state matrix). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-token bg-muted", className)} {...props} />;
}
