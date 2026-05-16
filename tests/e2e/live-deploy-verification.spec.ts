import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { getLiveBuildInfo, LIVE_API_URL, LIVE_URL, writeLiveReport } from "./helpers/liveCore5Helper";

const REPORT_PATH = path.resolve("reports/alpha/live-deploy-verification.json");

function localHead() {
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}

test("live deploy exposes expected build info and bundle", async ({ page, request }) => {
  const healthResponse = await request.get(`${LIVE_API_URL}/health`);
  const health = await healthResponse.json().catch(() => null);
  const headResponse = await request.fetch(LIVE_URL, { method: "HEAD" });

  const live = await getLiveBuildInfo(page);
  const head = localHead();
  const deployedCommit = String(live.buildInfo?.commit ?? "unknown");
  const deployedBundle = live.scripts.find((src: string) => src.includes("/assets/index-")) ?? null;
  const matched = deployedCommit === head;

  const row = {
    status: matched ? "PASS" : "FAIL",
    localHead: head,
    deployedCommit,
    deployedBundle,
    buildTime: live.buildInfo?.buildTime ?? null,
    appVersion: live.buildInfo?.appVersion ?? null,
    buildBadgeText: live.buildBadgeText,
    matched,
    health,
    http: {
      status: headResponse.status(),
      etag: headResponse.headers().etag ?? null,
      lastModified: headResponse.headers()["last-modified"] ?? null,
    },
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeLiveReport(REPORT_PATH, [row], {
    liveUrl: LIVE_URL,
    localHead: head,
    deployedCommit,
    deployedBundle,
    matched,
  });

  expect(healthResponse.ok(), JSON.stringify(row, null, 2)).toBe(true);
  expect(headResponse.ok(), JSON.stringify(row, null, 2)).toBe(true);
  expect(live.buildInfo, JSON.stringify(row, null, 2)).toBeTruthy();
  expect(deployedBundle, JSON.stringify(row, null, 2)).toBeTruthy();
  expect(matched, JSON.stringify(row, null, 2)).toBe(true);
});
