import { render, screen } from "@testing-library/react";
import { NumericBareInput, NumericInput } from "@/components/ui/numeric-input";

/**
 * Component-level wiring test for the numeric field primitives. We assert the guard
 * is actually attached to the DOM node by dispatching a real, cancelable `beforeinput`
 * event and checking whether the browser default was prevented — the mechanism that,
 * in a real browser, stops the character from ever appearing in the field.
 *
 * (We drive `beforeinput` directly rather than `user-event.type()` because jsdom does
 * not run the browser's default text-insertion for `beforeinput`, so a typed-text
 * assertion would test jsdom, not our guard.)
 */

/** Dispatch a cancelable InputEvent("beforeinput") with `data` and return it. */
function fireBeforeInput(el: HTMLInputElement, data: string): InputEvent {
  const ev = new InputEvent("beforeinput", {
    data,
    inputType: "insertText",
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(ev);
  return ev;
}

describe("NumericInput guard wiring", () => {
  it("cancels an insertion that would make the value non-numeric", () => {
    render(<NumericInput mode="integer" defaultValue="12" aria-label="qty" />);
    const el = screen.getByLabelText("qty") as HTMLInputElement;
    el.setSelectionRange(2, 2); // caret at end of "12"

    const letter = fireBeforeInput(el, "a");
    expect(letter.defaultPrevented).toBe(true);

    const digit = fireBeforeInput(el, "3");
    expect(digit.defaultPrevented).toBe(false);
  });

  it("blocks a decimal point in integer mode", () => {
    render(<NumericInput mode="integer" defaultValue="12" aria-label="count" />);
    const el = screen.getByLabelText("count") as HTMLInputElement;
    el.setSelectionRange(2, 2);
    expect(fireBeforeInput(el, ".").defaultPrevented).toBe(true);
  });

  it("allows a single decimal point in decimal mode but blocks a second", () => {
    render(<NumericInput mode="decimal" defaultValue="12" aria-label="rate" />);
    const el = screen.getByLabelText("rate") as HTMLInputElement;
    el.setSelectionRange(2, 2);
    expect(fireBeforeInput(el, ".").defaultPrevented).toBe(false);

    render(<NumericInput mode="decimal" defaultValue="12.3" aria-label="rate2" />);
    const el2 = screen.getByLabelText("rate2") as HTMLInputElement;
    el2.setSelectionRange(4, 4);
    expect(fireBeforeInput(el2, ".").defaultPrevented).toBe(true);
  });

  it("enforces the decimal-place cap on insertion", () => {
    render(<NumericInput mode="decimal" decimalPlaces={2} defaultValue="1.23" aria-label="pct" />);
    const el = screen.getByLabelText("pct") as HTMLInputElement;
    el.setSelectionRange(4, 4); // append a 3rd fraction digit
    expect(fireBeforeInput(el, "4").defaultPrevented).toBe(true);
  });

  it("does not cancel deletions (empty data)", () => {
    render(<NumericInput mode="integer" defaultValue="12" aria-label="del" />);
    const el = screen.getByLabelText("del") as HTMLInputElement;
    el.setSelectionRange(1, 2);
    // deleteContentBackward carries data === "" → guard must let it through
    const ev = new InputEvent("beforeinput", {
      data: "",
      inputType: "deleteContentBackward",
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("keeps the field as a text input with a numeric inputMode", () => {
    render(<NumericInput mode="decimal" aria-label="im" />);
    const el = screen.getByLabelText("im") as HTMLInputElement;
    expect(el.getAttribute("type")).toBe("text");
    expect(el.getAttribute("inputmode")).toBe("decimal");
  });

  it("blocks non-numeric paste over a selection", () => {
    render(<NumericInput mode="decimal" defaultValue="5" aria-label="paste" />);
    const el = screen.getByLabelText("paste") as HTMLInputElement;
    el.setSelectionRange(0, 1); // whole field selected
    expect(fireBeforeInput(el, "abc").defaultPrevented).toBe(true);
    expect(fireBeforeInput(el, "1234").defaultPrevented).toBe(false);
  });
});

describe("NumericBareInput", () => {
  it("renders a bare input (no token border classes) and guards it", () => {
    render(
      <NumericBareInput
        mode="decimal"
        decimalPlaces={4}
        allowGrouping
        defaultValue=""
        aria-label="bare"
        className="custom-bare"
      />,
    );
    const el = screen.getByLabelText("bare") as HTMLInputElement;
    // The caller's className is applied verbatim; no styled-Input border is injected.
    expect(el.className).toBe("custom-bare");
    el.setSelectionRange(0, 0);
    expect(fireBeforeInput(el, "x").defaultPrevented).toBe(true);
    // grouping/framing is tolerated
    expect(fireBeforeInput(el, "1,234.5600").defaultPrevented).toBe(false);
  });
});
