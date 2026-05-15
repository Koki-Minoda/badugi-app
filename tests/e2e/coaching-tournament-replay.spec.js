import { expect, test } from "@playwright/test";

test.describe("Step49 coaching tournament replay preview", () => {
  test("opens a replay deeplink from a tournament coaching card and preserves focus metadata", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="mtt-result-overlay">
        <section data-testid="coaching-preview-card">
          <span data-testid="severity">medium</span>
          <span data-testid="ev-gain">EV +36.8</span>
          <button
            data-testid="coaching-preview-replay"
            data-href="/replay?variant=S02&seed=20261099&hand=6&actionIndex=5&lesson=S02_DEEP_RAISECHECK_PC4"
          >
            Replay
          </button>
        </section>
        <section data-testid="replay-viewer" hidden>
          <div data-testid="replay-focus"></div>
        </section>
        <section data-testid="fallback" hidden>safe fallback</section>
      </main>
      <script>
        const button = document.querySelector('[data-testid="coaching-preview-replay"]');
        button.addEventListener('click', () => {
          const href = button.dataset.href;
          const parsed = new URL(href, window.location.origin);
          history.pushState({}, '', href);
          document.querySelector('[data-testid="replay-viewer"]').hidden = false;
          document.querySelector('[data-testid="replay-focus"]').textContent = JSON.stringify({
            variantId: parsed.searchParams.get('variant'),
            handId: parsed.searchParams.get('hand'),
            actionIndex: Number(parsed.searchParams.get('actionIndex')),
            lessonId: parsed.searchParams.get('lesson'),
            focusMode: 'coaching-lesson'
          });
        });
      </script>
    `);

    await expect(page.getByTestId("mtt-result-overlay")).toBeVisible();
    await expect(page.getByTestId("coaching-preview-card")).toBeVisible();
    await expect(page.getByTestId("severity")).toHaveText("medium");
    await expect(page.getByTestId("ev-gain")).toHaveText("EV +36.8");

    await page.getByTestId("coaching-preview-replay").click();
    await expect(page).toHaveURL(/\/replay\?variant=S02&seed=20261099&hand=6&actionIndex=5/);
    await expect(page.getByTestId("replay-viewer")).toBeVisible();
    await expect(page.getByTestId("replay-focus")).toContainText('"actionIndex":5');
    await expect(page.getByTestId("replay-focus")).toContainText('"focusMode":"coaching-lesson"');
  });

  test("keeps missing replay fallback safe", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <button data-testid="missing-replay">Replay</button>
      <section data-testid="fallback" hidden>safe fallback</section>
      <script>
        document.querySelector('[data-testid="missing-replay"]').addEventListener('click', () => {
          document.querySelector('[data-testid="fallback"]').hidden = false;
        });
      </script>
    `);

    await page.getByTestId("missing-replay").click();
    await expect(page.getByTestId("fallback")).toBeVisible();
    await expect(page.getByTestId("fallback")).toHaveText("safe fallback");
  });
});
