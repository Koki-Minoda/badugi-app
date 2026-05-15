import { expect, test } from "@playwright/test";

test.describe("Step55 variant-aware coaching recap preview", () => {
  test("filters multi-tournament recap by variant and exports local JSON", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <main data-testid="step55-variant-recap">
        <section data-testid="coaching-recap-panel">
          <h2 data-testid="global-summary">4 lessons across 4 sessions</h2>
          <button data-testid="variant-tab-all">すべて</button>
          <button data-testid="variant-tab-s02">S02</button>
          <button data-testid="variant-tab-d02">D02</button>
          <button data-testid="variant-tab-s01">S01</button>
          <div data-testid="variant-view">All variants</div>
          <div data-testid="repeated-leak">missed-value x2</div>
          <button data-testid="export-json">JSONを書き出す</button>
          <button data-testid="clear-history">履歴を消す</button>
        </section>
        <section data-testid="coaching-recap-empty" hidden>まだ学習履歴はありません。</section>
        <pre data-testid="export-output" hidden></pre>
        <script>
          const sessions = [
            { lessonId: 'S02_PC3', variantId: 'S02', lessonTag: 'missed-value', previewOnly: true },
            { lessonId: 'S02_PC4', variantId: 'S02', lessonTag: 'missed-value', previewOnly: true },
            { lessonId: 'D02_A', variantId: 'D02', lessonTag: 'second-pressure', previewOnly: true },
            { lessonId: 'D02_B', variantId: 'D02', lessonTag: 'second-pressure', previewOnly: true }
          ];
          const view = document.querySelector('[data-testid="variant-view"]');
          const leak = document.querySelector('[data-testid="repeated-leak"]');
          document.querySelector('[data-testid="variant-tab-all"]').addEventListener('click', () => {
            view.textContent = 'All variants';
            leak.textContent = 'missed-value x2';
          });
          document.querySelector('[data-testid="variant-tab-s02"]').addEventListener('click', () => {
            view.textContent = 'S02 lessons';
            leak.textContent = 'S02 missed-value x2';
          });
          document.querySelector('[data-testid="variant-tab-d02"]').addEventListener('click', () => {
            view.textContent = 'D02 lessons';
            leak.textContent = 'D02 second-pressure x2';
          });
          document.querySelector('[data-testid="variant-tab-s01"]').addEventListener('click', () => {
            view.textContent = 'S01 lessons';
            leak.textContent = 'この種目の学習履歴はまだありません';
          });
          document.querySelector('[data-testid="export-json"]').addEventListener('click', () => {
            const output = document.querySelector('[data-testid="export-output"]');
            output.hidden = false;
            output.textContent = JSON.stringify({ previewOnly: true, piiIncluded: false, sessions });
          });
          document.querySelector('[data-testid="clear-history"]').addEventListener('click', () => {
            document.querySelector('[data-testid="coaching-recap-panel"]').hidden = true;
            document.querySelector('[data-testid="coaching-recap-empty"]').hidden = false;
          });
        </script>
      </main>
    `);

    await expect(page.getByTestId("global-summary")).toContainText("4 lessons");
    await page.getByTestId("variant-tab-s02").click();
    await expect(page.getByTestId("variant-view")).toContainText("S02");
    await expect(page.getByTestId("repeated-leak")).toContainText("missed-value");
    await page.getByTestId("variant-tab-d02").click();
    await expect(page.getByTestId("repeated-leak")).toContainText("second-pressure");
    await page.getByTestId("variant-tab-s01").click();
    await expect(page.getByTestId("repeated-leak")).toContainText("まだありません");
    await page.getByTestId("export-json").click();
    await expect(page.getByTestId("export-output")).toContainText('"previewOnly":true');
    await expect(page.getByTestId("export-output")).toContainText('"piiIncluded":false');
    await page.getByTestId("clear-history").click();
    await expect(page.getByTestId("coaching-recap-empty")).toBeVisible();
  });
});
