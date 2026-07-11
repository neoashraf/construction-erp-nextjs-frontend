"use client";

import * as React from "react";

/**
 * Safety-net for a known Radix Dialog bug (@radix-ui/react-dialog 1.1.x): when a
 * dialog/sheet is closed programmatically right after a mutation resolves (our
 * `onSaved(); onClose()` flow), the component can unmount before Radix removes the
 * `pointer-events: none` it set on <body> to lock the background. The style is left
 * behind and the whole page becomes unclickable until reload.
 *
 * We watch <body>'s style attribute. Whenever `pointer-events: none` is present but
 * no dialog is genuinely open, we clear it. Runs on the next animation frame so it
 * never races Radix's own open/close transition — only a *stuck* lock is cleared.
 *
 * Mounted once in AppProviders → covers every Sheet and Dialog app-wide.
 */
export function PointerEventsGuard() {
  React.useEffect(() => {
    const body = document.body;

    /** True while Radix legitimately holds the page locked for an open modal. */
    function aDialogIsOpen(): boolean {
      // Radix marks <body> with data-scroll-locked while a modal owns the lock…
      if (body.hasAttribute("data-scroll-locked")) return true;
      // …and portalled dialog/menu content carries data-state="open" while visible.
      return document.querySelector('[data-state="open"][role="dialog"], [data-radix-popper-content-wrapper] [data-state="open"]') !== null;
    }

    function clearIfStuck() {
      if (body.style.pointerEvents === "none" && !aDialogIsOpen()) {
        body.style.removeProperty("pointer-events");
      }
    }

    let frame = 0;
    const observer = new MutationObserver(() => {
      // Defer to the frame after the mutation so Radix's own cleanup runs first;
      // we only step in if the lock is genuinely orphaned.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(clearIfStuck);
    });

    observer.observe(body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
