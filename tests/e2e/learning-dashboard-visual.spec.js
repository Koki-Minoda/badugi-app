import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const screenshotDir = path.resolve("reports/screenshots");

const scopes = {
  all: {
    label: "All variants",
    ev: [36.8, 69, 83.5, 94.7, 113.2, 125.2, 146.7, 156.2],
    actual: [0, 0, 0, 0, 12, 8, 17, 22],
    lessons: 8,
    replays: 4,
    queue: ["S02 missed-value", "S02 missed-value", "D02 second-pressure"],
  },
  S02: {
    label: "S02",
    ev: [36.8, 69, 87.5, 109],
    actual: [0, 0, 12, 21],
    lessons: 4,
    replays: 4,
    queue: ["S02 missed-value", "S02 missed-value"],
  },
  D02: {
    label: "D02",
    ev: [14.5, 25.7, 37.7, 47.2],
    actual: [0, 0, -4, 1],
    lessons: 4,
    replays: 0,
    queue: ["D02 second-pressure", "D02 second-pressure"],
  },
};

function dashboardHtml() {
  return `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            background: #050505;
            color: #fff7d6;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          main {
            min-height: 100vh;
            padding: 28px;
            background:
              radial-gradient(circle at top left, rgba(250,204,21,0.16), transparent 32%),
              linear-gradient(135deg, #050505 0%, #121212 55%, #080808 100%);
          }
          section {
            max-width: 860px;
            border: 1px solid rgba(250,204,21,0.36);
            border-radius: 18px;
            background: rgba(0,0,0,0.68);
            padding: 18px;
            box-shadow: 0 18px 50px rgba(0,0,0,0.45);
          }
          .top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
          .eyebrow { color: #fde68a; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; font-weight: 800; }
          h1 { margin: 4px 0 0; font-size: 22px; }
          .pill { border: 1px solid rgba(16,185,129,0.45); border-radius: 999px; color: #d1fae5; padding: 8px 12px; font-size: 13px; font-weight: 800; }
          .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
          button { cursor: pointer; border: 1px solid rgba(255,255,255,0.14); border-radius: 999px; background: rgba(255,255,255,0.04); color: #d1d5db; padding: 8px 12px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; }
          button.active { border-color: rgba(250,204,21,0.72); background: rgba(250,204,21,0.16); color: #fef3c7; }
          .chartWrap { border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; background: rgba(0,0,0,0.36); padding: 10px; }
          svg { width: 100%; height: 220px; display: block; }
          .legend { display: flex; gap: 16px; flex-wrap: wrap; color: #cbd5e1; font-size: 12px; margin: 8px 0 0; }
          .legend span::before { content: ""; display: inline-block; width: 22px; height: 3px; margin-right: 7px; vertical-align: middle; border-radius: 99px; }
          .legend .actual::before { background: #94a3b8; }
          .legend .ev::before { background: #facc15; }
          .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
          .stat, .queue { border: 1px solid rgba(255,255,255,0.11); border-radius: 14px; background: rgba(255,255,255,0.04); padding: 12px; }
          .label { color: #cbd5e1; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 800; }
          .value { margin-top: 4px; color: #fef3c7; font-size: 16px; font-weight: 800; }
          .queue { margin-top: 14px; }
          .queueItem { display: flex; justify-content: space-between; gap: 10px; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; margin-top: 10px; }
          .queueItem:first-of-type { border-top: 0; padding-top: 0; }
          @media (max-width: 520px) {
            main { padding: 14px; }
            h1 { font-size: 18px; }
            svg { height: 170px; }
            .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .queueItem { align-items: flex-start; flex-direction: column; }
          }
        </style>
      </head>
      <body>
        <main>
          <section data-testid="learning-dashboard-preview">
            <div class="top">
              <div>
                <div class="eyebrow">Preview only</div>
                <h1>学習ダッシュボード</h1>
              </div>
              <div class="pill" data-testid="scope-total">EV +156.2</div>
            </div>
            <div class="tabs">
              <button data-testid="tab-all" class="active" data-scope="all">All</button>
              <button data-testid="tab-s02" data-scope="S02">S02</button>
              <button data-testid="tab-d02" data-scope="D02">D02</button>
            </div>
            <div class="chartWrap">
              <svg data-testid="learning-dashboard-chart" viewBox="0 0 420 220" role="img" aria-label="Learning chart">
                <line x1="18" y1="190" x2="404" y2="190" stroke="rgba(255,255,255,0.18)" />
                <g data-testid="chart-target"></g>
              </svg>
              <div class="legend"><span class="actual">実収支</span><span class="ev">見直しEV</span></div>
            </div>
            <div class="stats">
              <div class="stat"><div class="label">Scope</div><div class="value" data-testid="scope-label">All variants</div></div>
              <div class="stat"><div class="label">Points</div><div class="value" data-testid="point-count">8</div></div>
              <div class="stat"><div class="label">Lessons</div><div class="value" data-testid="lesson-count">8</div></div>
              <div class="stat"><div class="label">Replays</div><div class="value" data-testid="replay-count">4</div></div>
            </div>
            <div class="queue" data-testid="replay-queue">
              <div class="label">見直すリプレイ</div>
              <div data-testid="queue-target"></div>
            </div>
          </section>
        </main>
        <script>
          const scopes = ${JSON.stringify(scopes)};
          const chart = document.querySelector('[data-testid="chart-target"]');
          const queue = document.querySelector('[data-testid="queue-target"]');
          function toPoints(values) {
            const max = Math.max(1, ...values.map(Number));
            const step = values.length > 1 ? 366 / (values.length - 1) : 0;
            return values.map((value, index) => {
              const x = 24 + index * step;
              const y = 190 - (Number(value) / max) * 154;
              return [Number(x.toFixed(1)), Number(y.toFixed(1))];
            });
          }
          function render(scopeKey) {
            const data = scopes[scopeKey];
            const ev = toPoints(data.ev);
            const actual = toPoints(data.actual);
            chart.innerHTML = [
              '<polyline data-testid="actual-result-line" fill="none" stroke="#94a3b8" stroke-width="4" points="' + actual.map((p) => p.join(',')).join(' ') + '"></polyline>',
              '<polyline data-testid="ev-reviewed-line" fill="none" stroke="#facc15" stroke-width="4" points="' + ev.map((p) => p.join(',')).join(' ') + '"></polyline>',
              ...ev.map((p, index) => '<circle data-testid="ev-reviewed-point" cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="#facc15" stroke="#050505" stroke-width="2"><title>point ' + (index + 1) + '</title></circle>')
            ].join('');
            queue.innerHTML = data.queue.map((item) => '<div class="queueItem" data-testid="replay-queue-item"><strong>' + item + '</strong><button>リプレイを見る</button></div>').join('');
            document.querySelector('[data-testid="scope-total"]').textContent = 'EV +' + data.ev.at(-1).toFixed(1);
            document.querySelector('[data-testid="scope-label"]').textContent = data.label;
            document.querySelector('[data-testid="point-count"]').textContent = String(data.ev.length);
            document.querySelector('[data-testid="lesson-count"]').textContent = String(data.lessons);
            document.querySelector('[data-testid="replay-count"]').textContent = String(data.replays);
            document.querySelectorAll('button[data-scope]').forEach((button) => button.classList.toggle('active', button.dataset.scope === scopeKey));
          }
          document.querySelectorAll('button[data-scope]').forEach((button) => button.addEventListener('click', () => render(button.dataset.scope)));
          render('all');
        </script>
      </body>
    </html>
  `;
}

test.describe("Step57 learning dashboard visual evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true });
  });

  test("captures global, variant, and mobile dashboard screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.setContent(dashboardHtml());

    await expect(page.getByTestId("learning-dashboard-chart")).toBeVisible();
    await expect(page.getByTestId("ev-reviewed-line")).toBeVisible();
    await expect(page.getByTestId("ev-reviewed-point")).toHaveCount(8);
    await page.screenshot({ path: path.join(screenshotDir, "step57-learning-dashboard-global.png"), fullPage: true });

    await page.getByTestId("tab-s02").click();
    await expect(page.getByTestId("scope-label")).toContainText("S02");
    await expect(page.getByTestId("ev-reviewed-point")).toHaveCount(4);
    await page.screenshot({ path: path.join(screenshotDir, "step57-learning-dashboard-s02.png"), fullPage: true });

    await page.getByTestId("tab-d02").click();
    await expect(page.getByTestId("scope-label")).toContainText("D02");
    await expect(page.getByTestId("replay-queue-item")).toHaveCount(2);
    await page.screenshot({ path: path.join(screenshotDir, "step57-learning-dashboard-d02.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("tab-all").click();
    await expect(page.getByTestId("learning-dashboard-preview")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "step57-learning-dashboard-mobile-portrait.png"), fullPage: true });

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId("learning-dashboard-preview")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "step57-learning-dashboard-mobile-landscape.png"), fullPage: true });
  });
});
