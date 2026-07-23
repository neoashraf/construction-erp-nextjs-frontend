import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The Zakir Enterprise logo — the Cloudinary-hosted image that replaces the former
 * "ZE" chip in every brand block (sidebar, mobile drawer, login card).
 *
 * The asset is a WIDE horizontal wordmark (~3.5:1: the "ZE" mark + "ZAKIR
 * ENTERPRISE" text), so callers must size it by HEIGHT and leave width auto —
 * forcing a square box (`h-N w-N`) squashes the wordmark into an illegible sliver.
 * The default `h-auto w-auto max-w-full` preserves the natural aspect ratio;
 * `object-contain` keeps it undistorted within whatever height class is passed.
 *
 * The logo art has a transparent background, so it sits on a white box
 * (`bg-white` + padding, square corners) — legible on the navy sidebar/drawer
 * and neutral on the light login card.
 *
 * Uses a plain <img>: the Cloudinary origin isn't whitelisted for next/image
 * (same reasoning as the profile avatar). `alt` carries the brand name for a11y.
 */
export function BrandLogo({ className, alt }: { className?: string; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_LOGO_URL}
      alt={alt ?? `${BRAND_NAME} logo`}
      className={cn("h-auto w-auto max-w-full shrink-0 bg-white object-contain p-1.5", className)}
    />
  );
}
