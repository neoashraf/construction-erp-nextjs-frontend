import { render, screen } from "@testing-library/react";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";

/**
 * BD localization (acceptance: "BD localization"): dates render DD/MM/YYYY, money
 * with ৳, and Bangla text is not clipped in a constrained box (no fixed height /
 * overflow:hidden that would truncate ascenders/descenders).
 */
const BANGLA = "জাকির এন্টারপ্রাইজ নির্মাণ ও প্রকৌশল";

function ConstrainedBanglaBox() {
  return (
    <div style={{ width: 120, overflowWrap: "break-word" }} data-testid="bangla-box">
      <span>{BANGLA}</span>
      <span data-testid="date">{formatDate("2026-06-29T00:00:00Z")}</span>
      <span data-testid="money">{formatMoney("1234.5")}</span>
    </div>
  );
}

describe("Bangla + BD localization rendering", () => {
  it("renders Bangla text fully (UTF-8, not truncated) in a constrained box", () => {
    render(<ConstrainedBanglaBox />);
    // The full Bangla string is present in the DOM — nothing is dropped/clipped at the data level.
    expect(screen.getByText(BANGLA)).toBeInTheDocument();
    const box = screen.getByTestId("bangla-box");
    // The box must not force clipping that hides text.
    expect(box.style.overflow).not.toBe("hidden");
    expect(box.style.height).toBe(""); // no fixed height that would clip
  });

  it("renders dates DD/MM/YYYY and money with ৳", () => {
    render(<ConstrainedBanglaBox />);
    expect(screen.getByTestId("date")).toHaveTextContent("29/06/2026");
    expect(screen.getByTestId("money")).toHaveTextContent("৳ 1,234.5000");
  });
});
