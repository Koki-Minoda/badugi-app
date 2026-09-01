import { expect, test } from "@playwright/test";
import { validateReplayReadyHandHistory } from "../../../src/ui/utils/handHistoryReplayRequirements.js";
import { APP_URL, enterTitleIfPresent } from "../authHelper";
import { playOneHandProgression, waitForE2EDriver } from "../helpers/gameProgressHelper.js";
import {
  CORE5_VARIANTS,
  getHud,
} from "./tournamentIntegrationHelper";

async function startLocalTournament(page: any, variantId: string) {
  const selectorId: Record<string, string> = {
    badugi: "badugi",
    nlh: "nlh",
    D01: "deuce_to_seven_triple_draw",
    D02: "ace_to_five_triple_draw",
    S01: "deuce_to_seven_single_draw",
    S02: "ace_to_five_single_draw",
  };
  await page.route("**/api/**", async (route: any) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/auth/me")
      ? { id: 9001, username: "Core5 Hero", email: "core5.hero@mgx-e2e.test" }
      : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("mgx.previewVariants", "true");
    window.localStorage.setItem("mgx_auth", JSON.stringify({
      accessToken: "core5-local-token",
      tokenType: "Bearer",
      user: { id: 9001, username: "Core5 Hero", email: "core5.hero@mgx-e2e.test" },
      isAuthenticated: true,
    }));
  });
  await page.goto(`${APP_URL}?variant=${variantId}&mode=cash`, { waitUntil: "load" });
  await enterTitleIfPresent(page);
  await page.getByTestId("menu-ring").waitFor({ state: "visible", timeout: 20_000 });
  await page.getByTestId("menu-ring").click();
  if (variantId === "nlh") {
    await page.getByRole("button", { name: /Board|Hold'em|ボード|ホールデム/i }).click();
  } else if (variantId === "S01" || variantId === "S02") {
    await page.getByRole("button", { name: /Single Draw|シングルドロー/i }).click();
  }
  await page.getByTestId(`game-selector-play-${selectorId[variantId]}`).click();
  await waitForE2EDriver(page);
  await expect(page.getByTestId("decision-panel")).toBeVisible({ timeout: 20_000 });
  await page.evaluate((selectedVariant: string) => {
    window.__BADUGI_E2E__.startTournamentMTT({
      id: `core5-real-${selectedVariant.toLowerCase()}`,
      name: "Core5 Real Action Gate",
      tables: 1,
      seatsPerTable: 6,
      totalPlayers: 6,
      startingStack: 2000,
      gameVariant: selectedVariant,
      gameRotation: [selectedVariant],
      rotationPolicy: "fixed",
      levels: [{ levelIndex: 1, smallBlind: 25, bigBlind: 50, ante: 0, handsThisLevel: 999 }],
      payouts: [{ place: 1, percent: 100 }],
      reentryPolicy: { allowed: false, maxEntries: 1, closesAtLevel: 0 },
    });
  }, variantId);
  await expect(page.getByTestId("tournament-hud")).toBeVisible({ timeout: 20_000 });
}

test.describe("Core5 real-action tournament champion and review gate", () => {
  test.describe.configure({ timeout: 180_000 });

  for (const variant of CORE5_VARIANTS) {
    test(`${variant.displayName} uses UI actions before a verified championship`, async ({ page }) => {
      await startLocalTournament(page, variant.variant);
      const hand = await playOneHandProgression(page, {
        maxSteps: variant.maxSteps,
        policy: "safe",
        requireHeroButtonClick: true,
        requireDrawVisit: variant.expectsDraw !== false,
        drawCardIndexes: [0],
      });
      expect(hand.heroButtonClicks).toBeGreaterThan(0);
      if (variant.expectsDraw === false) {
        expect(hand.visitedPhases).not.toContain("DRAW");
      } else {
        expect(hand.visitedPhases).toContain("DRAW");
      }

      const persistedHands = await page.evaluate(() => JSON.parse(
        window.localStorage.getItem("badugi.history.tournamentHands") ?? "[]",
      ));
      expect(persistedHands.length).toBeGreaterThan(0);
      const record = persistedHands.at(-1);
      const replayCheck = validateReplayReadyHandHistory(record, {
        variantId: record.variantId,
      });
      expect(replayCheck.valid, replayCheck.missing.join(", ")).toBe(true);
      const recordedActions = record.seats.flatMap((seat: any) => seat.actions ?? []);
      const hasRecordedDraw = recordedActions.some((action: any) =>
        Number(action?.drawCount ?? action?.metadata?.drawInfo?.drawCount ?? 0) > 0,
      );
      if (variant.expectsDraw === false) {
        expect(hasRecordedDraw, "board games must not fabricate draw actions").toBe(false);
      } else {
        expect(
          hasRecordedDraw,
          "replay history should preserve at least one real card exchange",
        ).toBe(true);
      }

      await page.evaluate(() => window.__BADUGI_E2E__.forceHeroChampion());
      await expect(page.getByTestId("mtt-result-overlay")).toBeVisible({ timeout: 20_000 });
      const hud = await getHud(page);
      expect(hud).toMatchObject({
        isFinished: true,
        championId: "hero-player",
        heroFinishPlace: 1,
        playersRemaining: 1,
      });

      const review = await page.evaluate(() => window.__BADUGI_E2E__.getTournamentReview());
      expect(review).toMatchObject({
        placement: 1,
        reviewDepth: "hand-history",
      });
      expect(review.totalHands).toBeGreaterThan(0);
      expect(review.heroActions.length).toBeGreaterThan(0);
      expect(review.reviewSummary.facts.length).toBeGreaterThan(0);
      expect(review.reviewSummary.nextActions.length).toBeGreaterThan(0);
      const handIds = new Set(review.hands.map((entry: any) => entry.handId));
      review.keyHands.forEach((keyHand: any) => {
        expect(handIds.has(keyHand.handId)).toBe(true);
      });
    });
  }
});
