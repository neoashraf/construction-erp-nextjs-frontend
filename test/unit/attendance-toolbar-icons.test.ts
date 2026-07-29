/**
 * Import and Export must carry OPPOSITE arrows.
 *
 * Two regressions motivate this. First, the buttons originally used lucide's `Upload` /
 * `Download`, which share a byte-identical tray path (`key: "ih7n3h"`) and differ only by a
 * flipped 5px arrowhead — side by side at 16px they read as the same button twice. Second,
 * the replacement pair was initially wired the wrong way round: Import pointed up and Export
 * pointed down, which inverts the meaning.
 *
 * This asserts on the SOURCE rather than the DOM because every lucide icon renders as an
 * anonymous `<svg>` with the same classes; a rendered-output assertion could not tell
 * `FileUp` from `FileDown` and would pass either way.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function source(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

/** The icon rendered by the button in a component file. */
function renderedIcon(file: string): string | undefined {
  return /<(File(?:Up|Down)|Upload|Download) className/.exec(source(file))?.[1];
}

/**
 * Import now lives in the Office-staff tab header (FE-64) — the same button, one component up.
 * `AttendanceLogsShell` was deleted when the logs view folded into that tab; Export moved off
 * this screen entirely to `/reports/hr`, but `ExportMenu` itself is kept and still owns the
 * opposite arrow, so the pair is still asserted against each other.
 */
const SHELL = "src/features/hr/components/OfficeStaffPanel.tsx";
const EXPORT_MENU = "src/features/hr/components/ExportMenu.tsx";

describe("attendance toolbar icons", () => {
  it("points Import down — data arriving in the table", () => {
    expect(renderedIcon(SHELL)).toBe("FileDown");
  });

  it("points Export up — data leaving the table", () => {
    expect(renderedIcon(EXPORT_MENU)).toBe("FileUp");
  });

  it("keeps the two arrows opposite", () => {
    const importIcon = renderedIcon(SHELL);
    const exportIcon = renderedIcon(EXPORT_MENU);
    expect(importIcon).toBeDefined();
    expect(exportIcon).toBeDefined();
    // The whole reason for a directional icon is lost if both point the same way.
    expect(importIcon).not.toBe(exportIcon);
  });

  it("avoids the Upload/Download pair, which are indistinguishable at 16px", () => {
    for (const file of [SHELL, EXPORT_MENU]) {
      expect(renderedIcon(file)).not.toBe("Upload");
      expect(renderedIcon(file)).not.toBe("Download");
    }
  });

  it("uses a non-directional icon for the file picker, which sends nothing", () => {
    // "Choose spreadsheet" only opens the OS picker; the upload happens on "Import N row(s)".
    // An upload arrow there implies picking a file already commits it.
    const drawer = source("src/features/hr/components/AttendanceImportDrawer.tsx");
    expect(/<FolderOpen className/.test(drawer)).toBe(true);
    expect(/<Upload className/.test(drawer)).toBe(false);
  });
});
