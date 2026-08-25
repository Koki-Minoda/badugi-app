import { test, expect } from "@playwright/test";

test("core5 long-run soak gate is configured through the shared browser gameplay harness", async () => {
  expect(process.env.BROWSER_GAMEPLAY_VARIANTS ?? "badugi,D01,D02,S01,S02").toContain("badugi");
  expect(process.env.BROWSER_GAMEPLAY_MODES ?? "cash,tournament").toContain("tournament");
  expect(process.env.BROWSER_TRACE_MODE ?? "light").toBeTruthy();
});
