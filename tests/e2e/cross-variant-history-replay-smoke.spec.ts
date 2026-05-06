import { test, expect, type Page } from "@playwright/test";
import { validateReplayReadyHandHistory } from "../../src/ui/utils/handHistoryReplayRequirements.js";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

type VariantCase = {
  variant: string;
  title: RegExp;
};

const VARIANT_CASES: VariantCase[] = [
  { variant: "nlh", title: /No-Limit Hold'em|NL Hold'em/i },
  { variant: "flh", title: /Fixed-Limit Hold'em|FL Hold'em/i },
  { variant: "super_holdem", title: /Super Hold'em/i },
  { variant: "fl_super_holdem", title: /FL Super Hold'em/i },
  { variant: "plo", title: /Pot-Limit Omaha|PLO/i },
  { variant: "plo8", title: /PLO8|Omaha Hi-Lo/i },
  { variant: "big_o", title: /Big-O|5-Card Omaha Hi-Lo/i },
  { variant: "five_card_plo", title: /5-Card PLO|Five-Card PLO/i },
  { variant: "flo8", title: /FLO8|Fixed-Limit Omaha/i },
  { variant: "D01", title: /2-7 Triple Draw/i },
  { variant: "D02", title: /A-5 Triple Draw/i },
  { variant: "badugi", title: /Badugi/i },
  { variant: "D04", title: /Badeucey TD/i },
  { variant: "D05", title: /Badacey TD/i },
  { variant: "D06", title: /Hidugi TD/i },
  { variant: "D07", title: /Archie TD/i },
  { variant: "S01", title: /2-7 Single Draw/i },
  { variant: "S02", title: /A-5 Single Draw/i },
  { variant: "S03", title: /5-Card Single Draw/i },
  { variant: "S04", title: /Badugi SD|Badugi Single Draw/i },
  { variant: "S05", title: /Badeucey Single Draw/i },
  { variant: "S06", title: /Badacey Single Draw/i },
  { variant: "S07", title: /Hidugi Single Draw/i },
  { variant: "dramaha_hi", title: /Dramaha Hi/i },
  { variant: "dramaha_27", title: /Dramaha 2-7/i },
  { variant: "dramaha_a5", title: /Dramaha A-5/i },
  { variant: "dramaha_zero", title: /Dramaha Zero/i },
  { variant: "dramaha_hidugi", title: /Dramaha Hidugi/i },
  { variant: "dramaha_badugi", title: /Dramaha Badugi/i },
  { variant: "stud", title: /^Stud$/i },
  { variant: "stud8", title: /Stud 8/i },
  { variant: "razz", title: /Razz/i },
  { variant: "razz27", title: /2-7 Razz/i },
  { variant: "razzdugi", title: /Razzdugi/i },
  { variant: "razzducey", title: /Razzducey/i },
];

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.resolveHandNow === "function" &&
          typeof api.forceDealNewHandNow === "function" &&
          typeof api.getHandHistory === "function" &&
          typeof api.getCurrentHandHistory === "function" &&
          typeof api.getStateSnapshot === "function",
      );
    },
    undefined,
    { timeout: 60000 },
  );
}

async function invokeE2E(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(
    async ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return await api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

async function getStateSnapshot(page: Page): Promise<any> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? null);
}

async function getHistoryBuffer(page: Page): Promise<any[]> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getHandHistory?.() ?? []);
}

function actionsFromRecord(record: any) {
  return (Array.isArray(record?.seats) ? record.seats : []).flatMap((seat: any) =>
    Array.isArray(seat?.actions)
      ? seat.actions.map((action: any) => ({ ...action, seat: seat.seat }))
      : [],
  );
}

function resultWinnerCount(record: any) {
  return (Array.isArray(record?.pots) ? record.pots : []).reduce(
    (sum: number, pot: any) => sum + (Array.isArray(pot?.winners) ? pot.winners.length : 0),
    0,
  );
}

function parseReplayCounter(value: string | null) {
  const match = String(value ?? "").match(/Frame\s+(\d+)\s*\/\s*(\d+)/i);
  if (!match) return { current: 0, total: 0 };
  return {
    current: Number(match[1]) || 0,
    total: Number(match[2]) || 0,
  };
}

async function waitForFinalizedHistory(page: Page, handId: string) {
  return expect
    .poll(
      async () => {
        const buffer = await getHistoryBuffer(page);
        return buffer.find((entry) => entry?.handId === handId) ?? null;
      },
      { timeout: 30000 },
    )
    .not.toBeNull();
}

async function openReplayFromHistoryUi(page: Page, handId: string) {
  await page.getByRole("button", { name: /履歴|History/i }).first().click();
  const modal = page.getByTestId("game-utility-modal");
  await expect(modal).toBeVisible({ timeout: 10000 });
  await modal.getByTestId(`hand-history-row-${handId}`).click();
  await expect(page.getByTestId("hand-replay-screen")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(`Hand ${handId}`).first()).toBeVisible();
}

async function expectReplayFrameJumpControls(page: Page, variant: string) {
  const counter = page.getByTestId("replay-frame-counter");
  await expect(counter).toBeVisible();
  const initial = parseReplayCounter(await counter.textContent());
  expect(initial.total, `${variant} replay should expose multiple frames`).toBeGreaterThan(1);
  expect(initial.current, `${variant} replay should start on first frame`).toBe(1);

  await page.getByTestId("replay-next-frame").click();
  await expect
    .poll(async () => parseReplayCounter(await counter.textContent()).current, {
      timeout: 5000,
    })
    .toBe(2);

  await page.getByTestId("replay-last-frame").click();
  await expect
    .poll(async () => parseReplayCounter(await counter.textContent()).current, {
      timeout: 5000,
    })
    .toBe(initial.total);

  await page.getByTestId("replay-first-frame").click();
  await expect
    .poll(async () => parseReplayCounter(await counter.textContent()).current, {
      timeout: 5000,
    })
    .toBe(1);

  await page.getByTestId("replay-event-row-1").click();
  await expect
    .poll(async () => parseReplayCounter(await counter.textContent()).current, {
      timeout: 5000,
    })
    .toBe(2);
}

test.describe("cross variant hand history replay smoke", () => {
  test.describe.configure({ timeout: 180000 });

  for (const { variant, title } of VARIANT_CASES) {
    test(`${variant} records handId/actions/result and supports replay frame jumps`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });

      const snapshot = await getStateSnapshot(page);
      const handId = snapshot?.handId;
      expect(handId, `${variant} should expose the active handId`).toEqual(
        expect.any(String),
      );

      const current = await page.evaluate(
        () => window.__BADUGI_E2E__?.getCurrentHandHistory?.() ?? null,
      );
      expect(current?.handId).toBe(handId);

      await invokeE2E(page, "resolveHandNow");
      await waitForFinalizedHistory(page, handId);

      const history = await getHistoryBuffer(page);
      const record = history.find((entry) => entry?.handId === handId);
      expect(record?.handId).toBe(handId);
      expect(record?.variantId, `${variant} should preserve variantId on history`).toEqual(
        expect.any(String),
      );
      expect(record?.events?.some((event: any) => event?.type === "HAND_START")).toBe(true);
      expect(record?.events?.some((event: any) => event?.type === "HAND_END")).toBe(true);

      const actions = actionsFromRecord(record);
      expect(actions.length, `${variant} should retain at least blind/ante/action rows`).toBeGreaterThan(0);
      expect(actions.every((action: any) => action.seq && action.street && action.type)).toBe(true);

      expect(Array.isArray(record?.pots)).toBe(true);
      expect(record.pots.length, `${variant} should retain pot result entries`).toBeGreaterThan(0);
      expect(resultWinnerCount(record), `${variant} should retain winner result entries`).toBeGreaterThan(0);

      const validation = validateReplayReadyHandHistory(record, {
        variantId: record.variantId,
      });
      expect(validation.valid, `${variant} replay fields missing: ${validation.missing.join(", ")}`).toBe(true);

      await openReplayFromHistoryUi(page, handId);
      await expectReplayFrameJumpControls(page, variant);

      await invokeE2E(page, "forceDealNewHandNow");
      const nextSnapshot = await getStateSnapshot(page);
      expect(nextSnapshot?.handId).not.toBe(handId);
    });
  }
});
