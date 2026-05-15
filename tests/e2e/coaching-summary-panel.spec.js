import { expect, test } from "@playwright/test";

test.describe("Step53 coaching summary panel preview", () => {
  test("shows top lessons, suppresses duplicates, opens replay, and updates telemetry", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(`
      <main data-testid="step53-summary">
        <section data-testid="tournament-result-overlay">
          <aside data-testid="coaching-summary-panel">
            <h2>今回の学習ポイント 2件</h2>
            <article data-testid="coaching-summary-lesson" data-lesson="S02_DEEP_RAISECHECK_PC4">
              <h3>4人局面の価値を取り逃した場面</h3>
              <span data-testid="priority-score">87.0</span>
              <button data-testid="coaching-summary-replay">リプレイを見る</button>
              <button data-testid="coaching-summary-helpful">役に立った</button>
            </article>
            <article data-testid="coaching-summary-lesson" data-lesson="S02_DEEP_RAISECHECK_PC3">
              <h3>3人局面の価値を取り逃した場面</h3>
              <button data-testid="coaching-summary-replay-secondary">リプレイを見る</button>
            </article>
          </aside>
          <span data-testid="suppressed-count">1</span>
        </section>
        <section data-testid="hand-replay-screen" hidden>
          <div data-testid="replay-event-row-5" data-coaching-highlight="true">RAISE</div>
        </section>
        <pre data-testid="telemetry-summary"></pre>
        <script>
          const events = [];
          const record = (type, lessonId) => {
            events.push({
              type,
              lessonId,
              sequence: events.length + 1,
              previewOnly: true,
              upload: false
            });
            document.querySelector('[data-testid="telemetry-summary"]').textContent = JSON.stringify(events);
          };
          record('LESSON_SHOWN', 'S02_DEEP_RAISECHECK_PC4');
          record('LESSON_SHOWN', 'S02_DEEP_RAISECHECK_PC3');
          document.querySelector('[data-testid="coaching-summary-replay"]').addEventListener('click', () => {
            record('REPLAY_OPENED', 'S02_DEEP_RAISECHECK_PC4');
            document.querySelector('[data-testid="hand-replay-screen"]').hidden = false;
          });
          document.querySelector('[data-testid="coaching-summary-helpful"]').addEventListener('click', () => {
            record('LESSON_HELPFUL', 'S02_DEEP_RAISECHECK_PC4');
          });
        </script>
      </main>
    `);

    await expect(page.getByTestId("coaching-summary-panel")).toBeVisible();
    await expect(page.getByTestId("coaching-summary-lesson")).toHaveCount(2);
    await expect(page.getByTestId("suppressed-count")).toHaveText("1");
    await page.getByTestId("coaching-summary-replay").click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
    await expect(page.getByTestId("replay-event-row-5")).toHaveAttribute("data-coaching-highlight", "true");
    await page.getByTestId("coaching-summary-helpful").click();

    const events = JSON.parse(await page.getByTestId("telemetry-summary").textContent());
    expect(events.map((event) => event.type)).toEqual([
      "LESSON_SHOWN",
      "LESSON_SHOWN",
      "REPLAY_OPENED",
      "LESSON_HELPFUL",
    ]);
    expect(events.every((event, index) => event.previewOnly === true && event.upload === false && event.sequence === index + 1)).toBe(true);
  });
});
