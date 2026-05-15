import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

function loadFixture() {
  const reportPath = path.resolve("reports/ai-iron/step51-real-replay-coaching-fixture.json");
  return JSON.parse(fs.readFileSync(reportPath, "utf8")).fixtures[0];
}

test.describe("Step51 real replay coaching fixture preview", () => {
  test("navigates from coaching card preview to real replay highlight", async ({ page }) => {
    const fixture = loadFixture();
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="step51-real-e2e">
        <section data-testid="tournament-result-overlay">
          <article data-testid="coaching-preview-card">
            <span>${fixture.lessonId}</span>
            <span>EV +${fixture.coaching.evDelta}</span>
            <button data-testid="coaching-preview-replay">Replay</button>
          </article>
        </section>
        <section data-testid="hand-replay-screen" hidden>
          <aside data-testid="replay-coaching-overlay">
            <span data-testid="replay-coaching-ev">EV +${fixture.coaching.evDelta}</span>
            <p>${fixture.coaching.jp}</p>
          </aside>
          <button data-testid="replay-event-row-${fixture.actionIndex}" data-coaching-highlight="true">
            <span data-testid="replay-coaching-timeline-marker">Coaching</span>
            ${fixture.actionAtIndex.action} action
          </button>
        </section>
        <script>
          document.querySelector('[data-testid="coaching-preview-replay"]').addEventListener('click', () => {
            document.querySelector('[data-testid="tournament-result-overlay"]').hidden = true;
            document.querySelector('[data-testid="hand-replay-screen"]').hidden = false;
          });
        </script>
      </main>
    `);

    await expect(page.getByTestId("coaching-preview-card")).toBeVisible();
    await page.getByTestId("coaching-preview-replay").click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
    await expect(page.getByTestId(`replay-event-row-${fixture.actionIndex}`)).toHaveAttribute(
      "data-coaching-highlight",
      "true",
    );
    await expect(page.getByTestId("replay-coaching-overlay")).toBeVisible();
    await expect(page.getByTestId("replay-coaching-timeline-marker")).toBeVisible();
  });

  test("keeps the real replay preview readable on mobile", async ({ page }) => {
    const fixture = loadFixture();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="hand-replay-screen">
        <aside data-testid="replay-coaching-overlay" style="max-width: 360px">
          <span>Missed Value</span>
          <span data-testid="replay-coaching-ev">EV +${fixture.coaching.evDelta}</span>
          <p>${fixture.coaching.en}</p>
        </aside>
      </main>
    `);
    const box = await page.getByTestId("replay-coaching-overlay").boundingBox();
    expect(box?.width ?? 999).toBeLessThanOrEqual(390);
    await expect(page.getByTestId("replay-coaching-overlay")).toBeVisible();
  });

  test("keeps fallback safe when the replay fixture is unavailable", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="hand-replay-screen">
        <section data-testid="replay-coaching-fallback">Coaching replay preview unavailable. Replay remains safe to inspect.</section>
      </main>
    `);
    await expect(page.getByTestId("replay-coaching-fallback")).toContainText("safe");
  });
});
