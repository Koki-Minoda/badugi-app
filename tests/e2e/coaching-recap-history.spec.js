import { expect, test } from "@playwright/test";

test.describe("Step54 coaching recap history preview", () => {
  test("persists local lesson history, revisits replay, and clears preview history", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <main data-testid="step54-recap">
        <section data-testid="tournament-result-overlay">
          <article data-testid="coaching-summary-lesson">
            <h3>4人局面の価値を取り逃した場面</h3>
            <button data-testid="summary-helpful">役に立った</button>
            <button data-testid="summary-replay">リプレイを見る</button>
          </article>
        </section>
        <section data-testid="hand-replay-screen" hidden>
          <button data-testid="replay-back">Back</button>
          <div data-testid="replay-event-row-5" data-coaching-highlight="true">RAISE</div>
        </section>
        <section data-testid="coaching-recap-panel" hidden>
          <h2>最近の学習</h2>
          <div data-testid="coaching-recap-lesson">4人局面の価値を取り逃した場面</div>
          <div data-testid="coaching-recap-repeated">missed-value x2</div>
          <button data-testid="coaching-recap-replay">リプレイを見る</button>
          <button data-testid="coaching-recap-clear">プレビュー履歴を消す</button>
        </section>
        <section data-testid="coaching-recap-empty" hidden>まだ学習履歴はありません。</section>
        <script>
          const history = [];
          const addHistory = () => history.push({
            lessonId: 'S02_DEEP_RAISECHECK_PC4',
            helpfulState: 'helpful',
            replayViewed: true,
            previewOnly: true,
            upload: false
          });
          document.querySelector('[data-testid="summary-helpful"]').addEventListener('click', addHistory);
          document.querySelector('[data-testid="summary-replay"]').addEventListener('click', () => {
            addHistory();
            document.querySelector('[data-testid="hand-replay-screen"]').hidden = false;
          });
          document.querySelector('[data-testid="replay-back"]').addEventListener('click', () => {
            document.querySelector('[data-testid="coaching-recap-panel"]').hidden = false;
          });
          document.querySelector('[data-testid="coaching-recap-replay"]').addEventListener('click', () => {
            document.querySelector('[data-testid="hand-replay-screen"]').hidden = false;
          });
          document.querySelector('[data-testid="coaching-recap-clear"]').addEventListener('click', () => {
            history.length = 0;
            document.querySelector('[data-testid="coaching-recap-panel"]').hidden = true;
            document.querySelector('[data-testid="coaching-recap-empty"]').hidden = false;
          });
        </script>
      </main>
    `);

    await expect(page.getByTestId("coaching-summary-lesson")).toBeVisible();
    await page.getByTestId("summary-helpful").click();
    await page.getByTestId("summary-replay").click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
    await expect(page.getByTestId("replay-event-row-5")).toHaveAttribute("data-coaching-highlight", "true");
    await page.getByTestId("replay-back").click();
    await expect(page.getByTestId("coaching-recap-panel")).toBeVisible();
    await expect(page.getByTestId("coaching-recap-repeated")).toContainText("missed-value");
    await page.getByTestId("coaching-recap-replay").click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
    await page.getByTestId("coaching-recap-clear").click();
    await expect(page.getByTestId("coaching-recap-empty")).toBeVisible();
  });
});
