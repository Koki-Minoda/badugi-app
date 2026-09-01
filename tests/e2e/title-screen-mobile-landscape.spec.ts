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
