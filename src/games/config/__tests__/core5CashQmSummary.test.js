import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PUBLIC_RING_PLAYABLE_VARIANTS } from "../variantAvailability.js";
import {
  QM_DEVICES,
  summarizeCore5CashQm,
} from "../../../../scripts/quality/summarize-core5-cash-qm.mjs";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function report(overrides = {}) {
  return {
    status: "PASS",
    handsCompleted: 10,
    nextHandClicks: 9,
    openingBlind: { level: 0, bigBlind: 20 },
    closingBlind: { level: 2, bigBlind: 50 },
    totalDrawClicks: 7,
    totalHeroButtonClicks: 10,
    history: { records: 10 },
    cashOut: true,
    rows: Array.from({ length: 10 }, (_, hand) => ({ hand: hand + 1 })),
    ...overrides,
  };
}

function completeReportDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mgx-core5-qm-"));
  dirs.push(dir);
  for (const variant of PUBLIC_RING_PLAYABLE_VARIANTS) {
    for (const device of QM_DEVICES) {
      fs.writeFileSync(
        path.join(dir, `${variant.id.toLowerCase()}-${device}-10-hands.json`),
        JSON.stringify(report({
          variant: variant.id,
          device,
          ...(variant.cashQm?.expectsDraw === false ? { totalDrawClicks: 0 } : {}),
          ...(variant.cashQm?.expectsBlindIncrease === false
            ? {
                openingBlind: { level: 0, bigBlind: 20 },
                closingBlind: { level: 0, bigBlind: 20 },
              }
            : {}),
        })),
      );
    }
  }
  return dir;
}

describe("Core5 cash QM summary", () => {
  it("passes only when every public game and device meets every threshold", () => {
    const summary = summarizeCore5CashQm({ reportDir: completeReportDir(), minimumHands: 10 });
    expect(summary.status).toBe("PASS");
    expect(summary.completedCases).toBe(PUBLIC_RING_PLAYABLE_VARIANTS.length * QM_DEVICES.length);
    expect(summary.issues).toEqual([]);
  });

  it("fails closed for a missing public-game report", () => {
    const dir = completeReportDir();
    fs.rmSync(path.join(dir, "s02-android-10-hands.json"));
    const summary = summarizeCore5CashQm({ reportDir: dir, minimumHands: 10 });
    expect(summary.status).toBe("FAIL");
    expect(summary.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_REPORT", variant: "S02", device: "android" }),
    );
  });

  it("fails closed when gameplay evidence misses a quality threshold", () => {
    const dir = completeReportDir();
    fs.writeFileSync(
      path.join(dir, "d01-desktop-10-hands.json"),
      JSON.stringify(report({ variant: "D01", device: "desktop", totalDrawClicks: 0 })),
    );
    const summary = summarizeCore5CashQm({ reportDir: dir, minimumHands: 10 });
    expect(summary.status).toBe("FAIL");
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        code: "QUALITY_THRESHOLD_FAILED",
        variant: "D01",
        failedChecks: expect.arrayContaining(["drawActions"]),
      }),
    );
  });
});
