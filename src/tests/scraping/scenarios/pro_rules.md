# Pro Rule Warning Smoke Scenario

This scenario focuses on the kill-blind / declaration warning HUD.

1. Launch the dev server and open `http://localhost:5173/game?game=B01`.
2. In dev builds, the E2E helper is exposed as `window.__BADUGI_E2E__`.
3. Trigger a kill-blind warning:
   ```js
   window.__BADUGI_E2E__.setKillState({
     pending: { multiplier: 3 },
   });
   ```
   The red **Pro Rule Notice** card should appear with text that mentions “キルブラインド”.
4. Trigger a declaration warning:
   ```js
   window.__BADUGI_E2E__.setRuleWarningsFromTest([
     "宣言フェーズが必要です",
   ]);
   ```
   The same HUD lists the new warning.
5. Clear the warnings with `window.__BADUGI_E2E__.setKillState({ pending: null, active: null })` and `setRuleWarningsFromTest([])` if needed.

> Automated version: `python -m tests.scraping.runner pro-rules`
