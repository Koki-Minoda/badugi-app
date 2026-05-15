import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditDashboardScreenshotEvidenceSummary } from "../auditDashboardScreenshotEvidence.js";

describe("auditDashboardScreenshotEvidenceSummary", () => {
  it("passes when all screenshot files exist and are non-empty", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "step57-screens-"));
    const paths = Object.fromEntries(
      ["global", "S02", "D02", "mobilePortrait", "mobileLandscape"].map((view) => {
        const filePath = path.join(dir, `${view}.png`);
        fs.writeFileSync(filePath, "png");
        return [view, filePath];
      }),
    );
    const report = auditDashboardScreenshotEvidenceSummary({ screenshotPaths: paths });
    expect(report.status).toBe("PASS");
    expect(report.screenshots.global.exists).toBe(true);
  });

  it("fails when a required screenshot is missing", () => {
    const report = auditDashboardScreenshotEvidenceSummary({ screenshotPaths: { global: "/tmp/missing-step57.png" } });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toEqual(["global"]);
  });
});
