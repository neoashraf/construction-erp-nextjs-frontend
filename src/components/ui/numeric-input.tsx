"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { useMergedGuardRef, useNumericGuard } from "@/components/ui/use-numeric-guard";
import { type NumericConstraints } from "@/lib/numeric-input";

/**
 * Numeric text field: a token-styled `Input` that HARD-BLOCKS any keystroke, paste,
 * or drop that would make the value non-numeric — a letter or stray symbol never
 * reaches the field. See `lib/numeric-input` for the why (over `type="number"` /
 * onChange-stripping) and the intermediate-value rules.
 *
 * The value stays a STRING throughout (this app's forms register strings and coerce
 * via decimal.js later), so this works as a drop-in for both:
 *   - RHF `register("qty")`            → uncontrolled, spread `{...register(...)}`
 *   - controlled `value` + `onChange`  → e.g. line grids that lift state up
 *
 * Zod remains the final gate (non-empty, range, scale). This only removes the ability
 * to type garbage in the first place.
 *
 * Not `type="number"`: we keep `type="text"` + `inputMode` so the string value is
 * verbatim and the mobile keyboard is still numeric.
 */
export interface NumericInputProps
  extends Omit<InputProps, "type">,
    NumericConstraints {}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    { mode = "decimal", decimalPlaces, allowNegative, allowGrouping, inputMode, ...props },
    forwardedRef,
  ) => {
    const guardRef = useNumericGuard({ mode, decimalPlaces, allowNegative, allowGrouping });
    const setRef = useMergedGuardRef(guardRef, forwardedRef);

    return (
      <Input
        ref={setRef}
        type="text"
        inputMode={inputMode ?? (mode === "integer" ? "numeric" : "decimal")}
        {...props}
      />
    );
  },
);
NumericInput.displayName = "NumericInput";

/**
 * A BARE guarded `<input>` — same hard-block guard, but NO token `Input` styling
 * (no border/height/focus ring). Use inside composite controls that draw their own
 * frame — a ৳-adornment box, a −/＋ quantity stepper — where wrapping the styled
 * `Input` would paint a second border. Pass the field's own `className` verbatim.
 */
export interface NumericBareInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">,
    NumericConstraints {}

export const NumericBareInput = React.forwardRef<HTMLInputElement, NumericBareInputProps>(
  (
    { mode = "decimal", decimalPlaces, allowNegative, allowGrouping, inputMode, ...props },
    forwardedRef,
  ) => {
    const guardRef = useNumericGuard({ mode, decimalPlaces, allowNegative, allowGrouping });
    const setRef = useMergedGuardRef(guardRef, forwardedRef);

    return (
      <input
        ref={setRef}
        type="text"
        inputMode={inputMode ?? (mode === "integer" ? "numeric" : "decimal")}
        {...props}
      />
    );
  },
);
NumericBareInput.displayName = "NumericBareInput";
