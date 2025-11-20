# Dealer's Choice Roulette Smoke Scenario

Use this scenario with `tests/scraping/runner.py` (Playwright) to ensure the Dealer’s Choice roulette can enqueue variants and launch a table.

1. Start the dev server (`npm run dev`) and launch the roulette page: `http://localhost:5173/dealers-choice`.
2. Spin the wheel until a result appears.
3. Click “このゲームですぐスタート” to enqueue the current variant and navigate to `/game?mode=dealers-choice`.
4. Verify that the Dealer’s Choice HUD (右上) shows the variant name / queue残数.
5. Play a hand (fold is OK). After “Next Hand” the HUD should update to the next queued variant (or fallback).
6. Return to `/dealers-choice`, click “キューをクリア”, and confirm the HUD disappears on the next `/game` visit.

Expected assertions (Playwright pseudo-code):

```ts
await page.goto("/dealers-choice");
await page.getByRole("button", { name: "Spin Roulette" }).click();
await page.getByRole("button", { name: "このゲームですぐスタート" }).click();
await expect(page.getByText("Dealer's Choice")).toBeVisible();
await page.getByRole("button", { name: "Next Hand" }).click();
await expect(page.getByText("キュー残数")).toBeVisible();
```

### Automated runner

The steps above are automated via the Playwright scenario called `dealers-choice`. With the dev server running (`npm run dev`), execute:

```bash
python -m tests.scraping.runner dealers-choice
```

This script spins the roulette, launches `/game?mode=dealers-choice`, folds once to reach the “Next Hand” flow, then clears the queue and verifies that the Dealer’s Choice HUD disappears on the following `/game` visit.
