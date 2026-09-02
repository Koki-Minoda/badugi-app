# Classic Chinese Poker / OFC release boundary

Date: 2026-09-03

## Product boundary

- `CP1` / `chinese_poker` is Classic 13-card Chinese Poker: deal 13,
  arrange front 3 / middle 5 / back 5, score fouls and royalties, resolve
  zero-sum points, then start the next hand.
- `CP2` / `ofc` is Open-Face Chinese Poker. It is a separate unavailable
  game until five-card initial placement, subsequent street placement,
  Fantasyland entry/re-entry, and its own history/replay contract are complete.
- `ofc`, `open_face_chinese`, and `open-face-chinese` no longer route to CP1.
  Enabling preview flags does not unlock CP2.

## Classic release gate

`npm run test:qm:chinese-release` must pass on Desktop Chromium, Android
Chromium, and iPhone WebKit. Each target completes 10 hands through visible
Auto Arrange, Score Hand, and Next Hand buttons and verifies:

- 13 unique hero cards and 26 unique dealt cards per heads-up hand;
- one canonical `ROWS_SET` event, followed by `SHOWDOWN`;
- independently replayed rows and result points;
- zero-sum point settlement;
- 10 unique persisted histories;
- no horizontal overflow, HTTP 500, or browser runtime error.

The first run exposed a duplicate `ROWS_SET` event when Auto Arrange was
followed by Score Hand. The submit path now reuses the already-recorded rows
instead of writing the same action twice.

## Local evidence

- Focused configuration/controller/history/UI tests: PASS.
- Desktop Chromium: 10/10 hands PASS.
- Android Chromium: 10/10 hands PASS.
- iPhone WebKit: 10/10 hands PASS.
- OFC launch/alias isolation: PASS.

Production release still requires pull-request CI, main integration, manual
deployment, production health, and the same 30-hand live QM.
