# Mixed Rotation Smoke Scenario

This scenario verifies that Mixed Game presets can be launched quickly and that the table HUD updates when the rotation advances.

1. Ensure the dev server is running (`npm run dev`).  
2. Unlock Mixed Game by storing a cleared progress flag:
   ```js
   localStorage.setItem(
     "playerProgress",
     JSON.stringify({
       worldChampCleared: true,
       stageWins: { store: 1, local: 1, national: 1, world: 1 },
     })
   );
   ```
3. Navigate to `http://localhost:5173/mixed?preset=mix-horse-pro`.  
4. Click **Mixed Game 開始** to activate the HORSE preset; the app transitions to `/game`.  
5. Confirm the Mixed HUD (右側) is visible and displays the current + next game names.  
6. Trigger a rotation (either by playing through a hand or, in dev builds, by running `window.__BADUGI_E2E__.rotateMixed()`). The “次のゲーム”ラベルが別のゲーム名へ更新されることを確認します。  
7. Optionally capture a screenshot for regression logs.

> Automated version: `python -m tests.scraping.runner mixed-rotation`
