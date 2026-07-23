/**
 * Brand identity — single source of truth for the app logo and names.
 *
 * The logo is hosted on Cloudinary (a remote origin not whitelisted for
 * next/image), so the shared <BrandLogo> below renders a plain <img>. Keeping the
 * URL here means a logo swap touches one file, not every brand-mark call site
 * (sidebar, mobile drawer, login card).
 */

/** Company display name (topbar/sidebar/drawer/login brand text). */
export const BRAND_NAME = "Zakir Enterprise";
/** Product tagline shown beneath the name in the desktop brand block. */
export const BRAND_TAGLINE = "Construction ERP";
/** Cloudinary-hosted square logo mark used in place of the "ZE" chip. */
export const BRAND_LOGO_URL =
  "https://res.cloudinary.com/dzczxr9ns/image/upload/v1782117605/uploads/tqkwjq4urh5r13pir8oz.png";
