import { expect, test } from "@playwright/test";

test.describe("Step52 coaching telemetry loop preview", () => {
  test("records deterministic preview telemetry through coaching and replay", async ({ page }) => {
    await page.goto("http://127.0.0.1:3000/");
    await page.setContent(`
      <main data-testid="step52-loop">
        <section data-testid="tournament-result-overlay">
          <article data-testid="coaching-preview-card">
            <span>missed-value</span>
            <button data-testid="coaching-preview-replay">Replay</button>
          </article>
        </section>
        <section data-testid="hand-replay-screen" hidden>
          <aside data-testid="replay-coaching-overlay">
            <span data-testid="replay-coaching-ev">EV +36.8</span>
            <button data-testid="replay-coaching-helpful">Helpful</button>
            <button data-testid="replay-close">Exit</button>
          </aside>
          <button data-testid="replay-event-row-5" data-coaching-highlight="true">
            <span data-testid="replay-coaching-timeline-marker">Coaching</span>
            RAISE
          </button>
        </section>
        <pre data-testid="telemetry-summary"></pre>
        <script>
          const events = [];
          const record = (type) => {
            events.push({
              type,
              lessonId: 'S02_DEEP_RAISECHECK_PC4',
              sessionId: 'step52-preview',
              previewOnly: true,
              upload: false,
              pii: false,
              sequence: events.length + 1
            });
            document.querySelector('[data-testid="telemetry-summary"]').textContent = JSON.stringify(events);
          };
          record('LESSON_SHOWN');
          document.querySelector('[data-testid="coaching-preview-replay"]').addEventListener('click', () => {
            record('REPLAY_OPENED');
            document.querySelector('[data-testid="tournament-result-overlay"]').hidden = true;
            document.querySelector('[data-testid="hand-replay-screen"]').hidden = false;
          });
          document.querySelector('[data-testid="replay-coaching-helpful"]').addEventListener('click', () => {
            record('LESSON_HELPFUL');
          });
          document.querySelector('[data-testid="replay-close"]').addEventListener('click', () => {
            record('REPLAY_COMPLETED');
          });
        </script>
      </main>
    `);

    await expect(page.getByTestId("coaching-preview-card")).toBeVisible();
    await page.getByTestId("coaching-preview-replay").click();
    await expect(page.getByTestId("hand-replay-screen")).toBeVisible();
    await expect(page.getByTestId("replay-event-row-5")).toHaveAttribute("data-coaching-highlight", "true");
    await page.getByTestId("replay-coaching-helpful").click();
    await page.getByTestId("replay-close").click();

    const events = JSON.parse(await page.getByTestId("telemetry-summary").textContent());
    expect(events.map((event) => event.type)).toEqual([
      "LESSON_SHOWN",
      "REPLAY_OPENED",
      "LESSON_HELPFUL",
      "REPLAY_COMPLETED",
    ]);
    expect(events.every((event, idx) => event.previewOnly && event.upload === false && event.sequence === idx + 1)).toBe(
      true,
    );
  });
});
