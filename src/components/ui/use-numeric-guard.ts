import * as React from "react";
import {
  applyEdit,
  isAllowedNumericValue,
  type NumericConstraints,
} from "@/lib/numeric-input";

/**
 * Returns a ref to attach to an `<input>` that HARD-BLOCKS non-numeric edits via a
 * native `beforeinput` listener. Shared by `NumericInput` and `MoneyInput`.
 *
 * React's synthetic `onBeforeInput` is not reliably cancelable across React/DOM
 * versions, so we bind the real event and `preventDefault()` a rejected edit. The
 * cancel happens before the browser mutates the field, so caret/selection/paste/
 * undo are all left intact. Values stay strings.
 */
export function useNumericGuard(
  constraints: NumericConstraints,
): React.MutableRefObject<HTMLInputElement | null> {
  const ref = React.useRef<HTMLInputElement | null>(null);
  // Latest constraints live in a ref so the listener never needs rebinding.
  const cRef = React.useRef(constraints);
  cRef.current = constraints;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onBeforeInput = (e: Event) => {
      const inserted = (e as InputEvent).data ?? "";
      // Deletions (data === "") only shrink the value → always still valid.
      if (inserted === "") return;

      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = applyEdit(el.value, start, end, inserted);

      if (!isAllowedNumericValue(next, cRef.current)) e.preventDefault();
    };

    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  return ref;
}

/** Merge the guard ref with a possibly-forwarded ref (e.g. RHF's `register` ref). */
export function useMergedGuardRef(
  guardRef: React.MutableRefObject<HTMLInputElement | null>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
): (node: HTMLInputElement | null) => void {
  return React.useCallback(
    (node: HTMLInputElement | null) => {
      guardRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [guardRef, forwardedRef],
  );
}
