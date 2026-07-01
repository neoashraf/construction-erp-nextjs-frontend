/**
 * FE-20 action -> badge tone mapping unit test (design file — per-action tones).
 */
import { AUDIT_ACTIONS, AUDIT_ACTION_TONE } from "@/features/audit/types";

describe("AUDIT_ACTION_TONE", () => {
  it("maps every known action to a tone", () => {
    for (const action of AUDIT_ACTIONS) {
      expect(AUDIT_ACTION_TONE[action]).toBeDefined();
    }
  });

  it("CREATE/APPROVE/ACTIVATE are positive; DELETE/REJECT are negative; POST is brand", () => {
    expect(AUDIT_ACTION_TONE.CREATE).toBe("positive");
    expect(AUDIT_ACTION_TONE.APPROVE).toBe("positive");
    expect(AUDIT_ACTION_TONE.ACTIVATE).toBe("positive");
    expect(AUDIT_ACTION_TONE.DELETE).toBe("negative");
    expect(AUDIT_ACTION_TONE.REJECT).toBe("negative");
    expect(AUDIT_ACTION_TONE.POST).toBe("brand");
    expect(AUDIT_ACTION_TONE.UPDATE).toBe("info");
    expect(AUDIT_ACTION_TONE.CANCEL).toBe("warning");
    expect(AUDIT_ACTION_TONE.DEACTIVATE).toBe("warning");
  });
});
