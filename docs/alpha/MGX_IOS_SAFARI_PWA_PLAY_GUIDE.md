# MGX iOS Safari / PWA Play Guide

Status: active friend-alpha mobile guidance.

## Safari Limitation

iPhone Safari URL and tab bars cannot be forcibly hidden by MGX JavaScript or CSS. The game must fit critical controls inside the current `window.visualViewport`, including normal Safari landscape where browser chrome can consume a large part of the screen.

## MGX Layout Requirement

- Use `window.visualViewport.height` when available.
- Fall back to `100dvh` / `100svh` behavior.
- Hero action buttons must be visible and tappable without page scroll.
- Tournament HUD, payout details, and phase details collapse before action buttons clip.
- PWA standalone mode is an enhancement, not a requirement for basic play.

## PWA Standalone Support

MGX now exposes:

- `public/manifest.webmanifest`
- `display: standalone`
- iOS `apple-mobile-web-app-capable`
- iOS title and status bar metadata

iOS standalone mode is only available after the tester manually chooses **Add to Home Screen**. It can reduce browser chrome, but it does not replace the normal Safari visual viewport gate.

## Physical Recheck

1. Open `https://mgx-poker.com/?mgxQa=mobile` in Safari.
2. Confirm Safari landscape tournament controls are visible before trying PWA.
3. Add MGX to Home Screen.
4. Launch from Home Screen and rotate to landscape.
5. Start Badugi tournament.
6. Reach a Hero action state.
7. Confirm Call / Raise / Fold or Draw buttons are fully visible and tappable.
8. If clipping recurs, capture screenshot plus QA export.
