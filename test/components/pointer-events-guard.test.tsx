import { render, waitFor, act } from "@testing-library/react";
import { PointerEventsGuard } from "@/components/ui/pointer-events-guard";

/**
 * Unit coverage for the guard that recovers from the Radix Dialog "stuck
 * pointer-events" bug. The stuck condition itself is environment-independent —
 * `document.body` carries `pointer-events: none` while no dialog is open — so we
 * reproduce it directly and assert the guard clears it, and, crucially, that it
 * leaves the lock alone while a dialog is genuinely open.
 */

afterEach(() => {
  document.body.style.removeProperty("pointer-events");
  document.body.removeAttribute("data-scroll-locked");
  document.body.innerHTML = "";
});

test("clears an orphaned pointer-events lock left on <body>", async () => {
  render(<PointerEventsGuard />);

  // Simulate Radix leaving the lock behind after a dialog unmounted.
  act(() => {
    document.body.style.pointerEvents = "none";
  });

  await waitFor(() => {
    expect(document.body.style.pointerEvents).not.toBe("none");
  });
});

test("keeps the lock while a dialog is genuinely open (scroll-locked)", async () => {
  render(<PointerEventsGuard />);

  act(() => {
    // Radix marks <body> scroll-locked while a modal owns the lock.
    document.body.setAttribute("data-scroll-locked", "1");
    document.body.style.pointerEvents = "none";
  });

  // Give the guard a couple of frames; it must NOT strip the active lock.
  await new Promise((r) => setTimeout(r, 50));
  expect(document.body.style.pointerEvents).toBe("none");
});

test("keeps the lock while open dialog content is present", async () => {
  render(<PointerEventsGuard />);

  act(() => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    document.body.style.pointerEvents = "none";
  });

  await new Promise((r) => setTimeout(r, 50));
  expect(document.body.style.pointerEvents).toBe("none");
});
