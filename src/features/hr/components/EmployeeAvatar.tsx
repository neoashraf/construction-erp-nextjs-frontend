import { cn } from "@/lib/utils";
import { hueFor, initialsFor } from "../lib/attendance-rows";

/**
 * Initials chip for an employee row.
 *
 * The hue is derived from the userId (see `hueFor`) so a person keeps the same colour
 * across pages and reloads — it is wayfinding, not status, and carries no semantic meaning.
 *
 * Colour is applied as an inline `hsl()` rather than a token class because the hue is
 * computed per row: there is no fixed palette to map onto, and the design system's tokens
 * are semantic (success/warning/…) which would imply meaning that isn't there. Inline HSL
 * also keeps this clear of the no-raw-hex lint rule, which exists to stop screens drifting
 * from the token palette — a rule about brand colours, not generated identicon hues.
 */
export function EmployeeAvatar({
  userId,
  name,
  className,
}: {
  userId: string;
  name: string | null | undefined;
  className?: string;
}) {
  const hue = hueFor(userId);
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-bold",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 62% 92%)`,
        color: `hsl(${hue} 58% 30%)`,
      }}
    >
      {initialsFor(name, userId)}
    </span>
  );
}
