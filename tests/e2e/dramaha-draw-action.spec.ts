import { test, expect, type Page } from "@playwright/test";
import { APP_URL, openAuthenticatedGame } from "./authHelper";

type Snapshot = {
  controllerSnapshot?: {
    street?: string;
    turn?: number | null;
    players?: Array<{
      holeCards?: string[];
      betThisStreet?: number;
      folded?: boolean;
      allIn?: boolean;
      seatOut?: boolean;
      hasDrawn?: boolean;
      lastDrawCount?: number;
    }>;
  } | null;
};

async function waitForE2EDriver(page: Page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.forceControllerAction === "function" &&
          typeof api.getStateSnapshot === "function",
      );
    },
    undefined,
    { timeout: 60000 },
  );
}

async function getSnapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot?.() ?? {});
}

async function forceControllerAction(page: Page, seat: number, payload: Record<string, unknown>) {
  return page.evaluate(
    ({ seatIndex, actionPayload }) =>
      window.__BADUGI_E2E__?.forceControllerAction?.(seatIndex, actionPayload),
    { seatIndex: seat, actionPayload: payload },
  );
}

function nextBetAction(snapshot: Snapshot, actor: number) {
  const players = snapshot.controllerSnapshot?.players ?? [];
  const maxBet = Math.max(0, ...players.map((player) => Number(player?.betThisStreet) || 0));
  const actorBet = Number(players[actor]?.betThisStreet) || 0;
  return maxBet > actorBet ? "call" : "check";
}

async function driveDramahaToHeroDraw(page: Page) {
  for (let step = 0; step < 80; step += 1) {
    const snapshot = await getSnapshot(page);
    const controller = snapshot.controllerSnapshot;
    if (controller?.street === "DRAW" && controller.turn === 0) {
      return controller;
    }
    const actor = controller?.turn;
    if (typeof actor !== "number" || actor < 0) {
      await page.waitForTimeout(100);
      continue;
    }
    if (controller?.street === "DRAW") {
      await forceControllerAction(page, actor, { type: "draw", discardIndexes: [] });
    } else {
      await forceControllerAction(page, actor, { type: nextBetAction(snapshot, actor) });
    }
    await page.waitForTimeout(75);
  }
  throw new Error("Dramaha did not reach a hero DRAW action within the step budget");
}

async function driveDramahaToResultOverlay(page: Page) {
  for (let step = 0; step < 160; step += 1) {
    const resultPots = page.getByTestId("hand-result-pot");
    if ((await resultPots.count()) > 0 && await resultPots.first().isVisible().catch(() => false)) {
      return;
    }

    const snapshot = await getSnapshot(page);
    const controller = snapshot.controllerSnapshot;
    const actor = controller?.turn;
    if (typeof actor !== "number" || actor < 0) {
      await page.waitForTimeout(100);
      continue;
    }

    if (controller?.street === "DRAW") {
      await forceControllerAction(page, actor, { type: "draw", discardIndexes: [] });
    } else {
      await forceControllerAction(page, actor, { type: nextBetAction(snapshot, actor) });
    }
    await page.waitForTimeout(75);
  }
  throw new Error("Dramaha did not reach result overlay within the step budget");
}

const DRAMAHA_VARIANTS = [
  "dramaha_hi",
  "dramaha_27",
  "dramaha_a5",
  "dramaha_zero",
  "dramaha_hidugi",
  "dramaha_badugi",
];

test.describe("Dramaha draw action regression", () => {
  test.describe.configure({ timeout: 120000 });

  DRAMAHA_VARIANTS.forEach((variant) => {
    test(`${variant} lets hero select and replace a draw card`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
      await waitForE2EDriver(page);

      const drawSnapshot = await driveDramahaToHeroDraw(page);
      const before = drawSnapshot.players?.[0]?.holeCards?.[0];
      expect(before).toBeTruthy();

      await page.mouse.move(8, 8);
      await page.getByTestId("player-0-card-0").click({ force: true });
      await expect(page.getByTestId("action-draw-selected")).toBeVisible({ timeout: 10000 });
      await page.getByTestId("action-draw-selected").click();

      await expect
        .poll(async () => {
          const snapshot = await getSnapshot(page);
          const hero = snapshot.controllerSnapshot?.players?.[0];
          return {
            firstCard: hero?.holeCards?.[0] ?? null,
            lastDrawCount: hero?.lastDrawCount ?? null,
            hasDrawn: hero?.hasDrawn ?? false,
          };
        }, { timeout: 10000 })
        .toMatchObject({
          lastDrawCount: 1,
          hasDrawn: true,
        });

      const afterSnapshot = await getSnapshot(page);
      expect(afterSnapshot.controllerSnapshot?.players?.[0]?.holeCards?.[0]).not.toBe(before);
    });
  });

  test("dramaha_hi result overlay separates high board and draw half component pots", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedGame(page, `${APP_URL}?variant=dramaha_hi`);
    await waitForE2EDriver(page);

    await driveDramahaToResultOverlay(page);

    const resultPots = page.getByTestId("hand-result-pot");
    await expect(resultPots.first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("High / Board half").first()).toBeVisible();
    await expect(page.getByText("Draw half").first()).toBeVisible();
    await expect(page.getByText(/Component pot:/).first()).toBeVisible();

    const components = await resultPots.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-component")).filter(Boolean),
    );
    expect(components).toContain("board");
    expect(components).toContain("draw");
  });
});
