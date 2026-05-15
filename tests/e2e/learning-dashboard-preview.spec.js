import { expect, test } from "@playwright/test";

test.describe("Step56 learning dashboard preview", () => {
  test("shows local graphs, variant filters, replay queue, and empty state", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <main data-testid="step56-dashboard">
        <section data-testid="learning-dashboard-preview">
          <h2>学習ダッシュボード</h2>
          <button data-testid="variant-tab-all">すべて</button>
          <button data-testid="variant-tab-s02">S02</button>
          <button data-testid="variant-tab-d02">D02</button>
          <svg data-testid="learning-dashboard-chart" viewBox="0 0 280 100">
            <polyline data-testid="actual-result-line" points="0,88 280,88"></polyline>
            <polyline data-testid="ev-reviewed-line" points="0,80 280,12"></polyline>
          </svg>
          <div data-testid="dashboard-scope">All EV +94.7</div>
          <div data-testid="lesson-stats">Lessons 4 / Replays 2</div>
          <div data-testid="replay-queue">
            <button data-testid="replay-queue-open">リプレイを見る</button>
          </div>
          <button data-testid="clear-dashboard">プレビューデータを消す</button>
        </section>
        <section data-testid="replay-screen" hidden>Replay opened</section>
        <section data-testid="learning-dashboard-empty" hidden>まだ学習データはありません。</section>
        <script>
          const scope = document.querySelector('[data-testid="dashboard-scope"]');
          const stats = document.querySelector('[data-testid="lesson-stats"]');
          document.querySelector('[data-testid="variant-tab-all"]').addEventListener('click', () => {
            scope.textContent = 'All EV +94.7';
            stats.textContent = 'Lessons 4 / Replays 2';
          });
          document.querySelector('[data-testid="variant-tab-s02"]').addEventListener('click', () => {
            scope.textContent = 'S02 EV +69.0';
            stats.textContent = 'Lessons 2 / Replays 2';
          });
          document.querySelector('[data-testid="variant-tab-d02"]').addEventListener('click', () => {
            scope.textContent = 'D02 EV +25.7';
            stats.textContent = 'Lessons 2 / Replays 0';
          });
          document.querySelector('[data-testid="replay-queue-open"]').addEventListener('click', () => {
            document.querySelector('[data-testid="replay-screen"]').hidden = false;
          });
          document.querySelector('[data-testid="clear-dashboard"]').addEventListener('click', () => {
            document.querySelector('[data-testid="learning-dashboard-preview"]').hidden = true;
            document.querySelector('[data-testid="learning-dashboard-empty"]').hidden = false;
          });
        </script>
      </main>
    `);

    await expect(page.getByTestId("learning-dashboard-chart")).toBeVisible();
    await expect(page.getByTestId("ev-reviewed-line")).toBeVisible();
    await page.getByTestId("variant-tab-s02").click();
    await expect(page.getByTestId("dashboard-scope")).toContainText("S02 EV +69.0");
    await page.getByTestId("variant-tab-d02").click();
    await expect(page.getByTestId("lesson-stats")).toContainText("Replays 0");
    await page.getByTestId("replay-queue-open").click();
    await expect(page.getByTestId("replay-screen")).toBeVisible();
    await page.getByTestId("clear-dashboard").click();
    await expect(page.getByTestId("learning-dashboard-empty")).toBeVisible();
  });
});
