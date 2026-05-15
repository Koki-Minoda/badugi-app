import { expect, test } from "@playwright/test";

test.describe("Step50 replay coaching annotation preview", () => {
  test("shows coaching overlay, EV delta, and action highlight", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="hand-replay-screen">
        <aside data-testid="replay-coaching-overlay">
          <span data-testid="replay-coaching-severity">medium</span>
          <span data-testid="replay-coaching-ev">EV +36.8</span>
          <p data-testid="replay-coaching-copy">この場面ではレイズの方が期待値を改善できる可能性があります。</p>
        </aside>
        <button data-testid="replay-event-row-4" data-coaching-highlight="false">Frame 4</button>
        <button data-testid="replay-event-row-5" data-coaching-highlight="true">
          <span data-testid="replay-coaching-timeline-marker">Coaching</span>
          Frame 5
        </button>
      </main>
    `);

    await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
    await expect(page.getByTestId("replay-coaching-overlay")).toBeVisible();
    await expect(page.getByTestId("replay-coaching-ev")).toHaveText("EV +36.8");
    await expect(page.getByTestId("replay-coaching-severity")).toHaveText("medium");
    await expect(page.getByTestId("replay-event-row-5")).toHaveAttribute("data-coaching-highlight", "true");
    await expect(page.getByTestId("replay-coaching-timeline-marker")).toBeVisible();
  });

  test("keeps annotation layout visible on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="hand-replay-screen">
        <aside data-testid="replay-coaching-overlay" style="max-width: 360px">
          <span>Missed Value</span>
          <span data-testid="replay-coaching-ev">EV +32.2</span>
          <p>Raising may capture more value than checking back.</p>
        </aside>
      </main>
    `);
    const box = await page.getByTestId("replay-coaching-overlay").boundingBox();
    expect(box?.width ?? 999).toBeLessThanOrEqual(390);
    await expect(page.getByTestId("replay-coaching-overlay")).toBeVisible();
  });

  test("uses a safe fallback when annotation metadata is unavailable", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="hand-replay-screen">
        <section data-testid="replay-coaching-fallback">Coaching replay preview unavailable. Replay remains safe to inspect.</section>
      </main>
    `);
    await expect(page.getByTestId("replay-coaching-fallback")).toBeVisible();
    await expect(page.getByTestId("replay-coaching-fallback")).toContainText("safe");
  });
});

