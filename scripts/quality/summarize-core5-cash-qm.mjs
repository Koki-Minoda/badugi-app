import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PUBLIC_RING_PLAYABLE_VARIANTS } from "../../src/games/config/variantAvailability.js";

export const QM_DEVICES = Object.freeze(["desktop", "android"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function currentCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function summarizeCore5CashQm({ reportDir, minimumHands = 10 } = {}) {
  if (!reportDir) throw new Error("reportDir is required");
  const rows = [];
  const issues = [];

  for (const variant of PUBLIC_RING_PLAYABLE_VARIANTS) {
    for (const device of QM_DEVICES) {
      const fileName = `${variant.id.toLowerCase()}-${device}-${minimumHands}-hands.json`;
      const filePath = path.join(reportDir, fileName);
      if (!fs.existsSync(filePath)) {
        issues.push({ code: "MISSING_REPORT", variant: variant.id, device, fileName });
        continue;
      }
      let report;
      try {
        report = readJson(filePath);
      } catch (error) {
        issues.push({
          code: "INVALID_REPORT",
          variant: variant.id,
          device,
          fileName,
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      const checks = {
        passed: report.status === "PASS",
        identity: report.variant === variant.id && report.device === device,
        hands: Number(report.handsCompleted) >= minimumHands,
        nextHand: Number(report.nextHandClicks) >= minimumHands - 1,
        blindLevel: variant.cashQm?.expectsBlindIncrease === false
          ? Number(report.closingBlind?.level) === Number(report.openingBlind?.level)
          : Number(report.closingBlind?.level) > Number(report.openingBlind?.level),
        blindAmount: variant.cashQm?.expectsBlindIncrease === false
          ? Number(report.closingBlind?.bigBlind) === Number(report.openingBlind?.bigBlind)
          : Number(report.closingBlind?.bigBlind) > Number(report.openingBlind?.bigBlind),
        heroActions: Number(report.totalHeroButtonClicks) >= Math.ceil(minimumHands / 2),
        drawActions: variant.cashQm?.expectsDraw === false
          ? Number(report.totalDrawClicks) === 0
          : Number(report.totalDrawClicks) > 0,
        history: Number(report.history?.records) >= minimumHands,
        cashOut: report.cashOut === true,
        rowCount: Array.isArray(report.rows) && report.rows.length >= minimumHands,
      };
      const failedChecks = Object.entries(checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      if (failedChecks.length) {
        issues.push({
          code: "QUALITY_THRESHOLD_FAILED",
          variant: variant.id,
          device,
          failedChecks,
        });
      }
      rows.push({
        variant: variant.id,
        displayName: variant.displayName,
        device,
        fileName,
        checks,
        metrics: {
          hands: Number(report.handsCompleted ?? 0),
          heroActions: Number(report.totalHeroButtonClicks ?? 0),
          drawActions: Number(report.totalDrawClicks ?? 0),
          historyRecords: Number(report.history?.records ?? 0),
          openingBigBlind: Number(report.openingBlind?.bigBlind ?? 0),
          closingBigBlind: Number(report.closingBlind?.bigBlind ?? 0),
        },
      });
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: currentCommit(),
    target: process.env.E2E_APP_URL ?? "local",
    status: issues.length === 0 ? "PASS" : "FAIL",
    expectedVariants: PUBLIC_RING_PLAYABLE_VARIANTS.map((entry) => entry.id),
    expectedDevices: [...QM_DEVICES],
    expectedCases: PUBLIC_RING_PLAYABLE_VARIANTS.length * QM_DEVICES.length,
    completedCases: rows.length,
    minimumHands,
    issues,
    rows,
  };
}

function main() {
  const reportDir = path.resolve(process.argv[2] ?? "reports/all-live-cash");
  const minimumHands = Math.max(10, Number(process.env.MGX_ALL_LIVE_CASH_HANDS ?? 10));
  const summary = summarizeCore5CashQm({ reportDir, minimumHands });
  fs.mkdirSync(reportDir, { recursive: true });
  const outputPath = path.join(reportDir, "qm-summary.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(
    `Core5 cash QM ${summary.status}: ${summary.completedCases}/${summary.expectedCases} cases\n`,
  );
  if (summary.status !== "PASS") {
    process.stderr.write(`${JSON.stringify(summary.issues, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
