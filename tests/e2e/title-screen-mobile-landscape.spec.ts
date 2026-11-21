import { expect, test } from "@playwright/test";

const appUrl = process.env.E2E_APP_URL ?? "http://127.0.0.1:3000";

test("title CTA stays inside the short landscape viewport and enters the app", async ({
  page,
}) => {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });

  const title = page.getByTestId("title-screen");
  const enter = page.getByTestId("title-enter-button");
  await expect(title).toBeVisible();
  await expect(enter).toBeVisible();

  const geometry = await enter.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    return {
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
      viewport: { left, top, right: left + width, bottom: top + height },
    };
  });

  expect(geometry.rect.left).toBeGreaterThanOrEqual(geometry.viewport.left);
  expect(geometry.rect.top).toBeGreaterThanOrEqual(geometry.viewport.top);
  expect(geometry.rect.right).toBeLessThanOrEqual(geometry.viewport.right);
  expect(geometry.rect.bottom).toBeLessThanOrEqual(geometry.viewport.bottom);

  await enter.click();
  await expect(title).toBeHidden();
});

test("a late menu image cannot move the tournament button during a press", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({
    json: { id: 7003, username: "Menu Gate", email: "menu.gate@mgx-e2e.test" },
  }));
  await page.addInitScript(() => {
    localStorage.setItem("mgx_auth", JSON.stringify({
      accessToken: "local-menu-gate", tokenType: "Bearer", isAuthenticated: true,
      user: { id: 7003, username: "Menu Gate", email: "menu.gate@mgx-e2e.test" },
    }));
  });
  let releaseImage!: () => void;
  const imageReady = new Promise<void>((resolve) => { releaseImage = resolve; });
  await page.route(/mgx_kitsune_transparent.*\.png/, async (route) => {
    if (route.request().resourceType() !== "image") return route.continue();
    const response = await route.fetch();
    await imageReady;
    await route.fulfill({ response });
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("title-enter-button").click();
  const button = page.getByTestId("menu-tournament");
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  releaseImage();
  await expect.poll(() => page.getByRole("img", { name: "MGX Kitsune", exact: true })
    .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.mouse.up();
  await expect(page.getByTestId("tournament-stage-store")).toBeVisible();
});

// iOS QM #462: prevent one-character wrapping in profile navigation.
const base = process.env.E2E_APP_URL ?? 'http://127.0.0.1:3000/';
for (const width of [320, 390, 852]) for (const locale of ['ja', 'en']) {
  test(`settings header remains readable at ${width}px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(new URL('settings', base).href);
    await page.getByLabel('言語 / Language').selectOption(locale);
    const header = page.locator('header').first();
    await expect(header.getByRole('heading')).toHaveText(locale === 'ja' ? 'プロフィール設定' : 'Title & Avatar');
    const geometry = await header.evaluate(el => {
      const title = el.querySelector('h1')!;
      const range = document.createRange(); range.selectNodeContents(title);
      const titleLines = range.getClientRects().length;
      return { titleLines, overflow: document.documentElement.scrollWidth - innerWidth,
        buttons: [...el.querySelectorAll('button')].map(button => {
          const range = document.createRange(); range.selectNodeContents(button);
          const rect = button.getBoundingClientRect();
          return { lines: range.getClientRects().length, height: rect.height, right: rect.right };
        }) };
    });
    expect(geometry.titleLines).toBe(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    for (const button of geometry.buttons) {
      expect(button.lines).toBe(1);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.right).toBeLessThanOrEqual(width);
    }
    await header.getByRole('button', { name: locale === 'ja' ? 'ゲーム選択へ戻る' : 'Back to menu' }).click();
    await expect(page).not.toHaveURL(/settings/);
  });
}
