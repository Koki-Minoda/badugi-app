# Mobile switch performance investigation — 2026-11-21

Related: #433, #417, #423. Production tested: `45c7a36627be2d632884b426accb546b16a8bc10`. Fixed build: `39c77fa9`.

## Result

Repeated Badeucey → Badugi, Cash ↔ practice MTT, and pause/resume transitions completed without progressively severe whole-screen slowdown in the tested browser environments. This does **not** resolve the user's physical-phone incident: only one physical iPhone hand was measured successfully, and repeated hardware transitions remain unverified.

Confirmed separate defect: the browser retained console diagnostic strings and CPU decision traces without a bound. The fix limits console retention to the latest 256 entries / 262,144 characters (16,384 per entry), and browser CPU traces to the latest 2,000 rows. Browser console forwarding remains intact. Offline CPU trace export remains complete.

## Measurements

Values below are milliseconds; p95 covers browser-local samples across each run, not transport latency.

| Environment | Hands | Hero response p95 | CPU turn residence p95 | Frame gap p95 | Retained console characters |
|---|---:|---:|---:|---:|---:|
| Production, Android Chromium emulation | 26 | 16.2 | 916.1 | Not sampled | 7,706,664 |
| Production, iPhone WebKit emulation | 26 | 15.0 | 917.0 | Not sampled | 7,601,940 |
| Local before, Chromium CPU ×4, near-full history | 20 | 16.9 | 919.3 | 16.7 | 5,819,095 |
| Local fixed, Chromium CPU ×4, near-full history | 20 | 16.7 | 919.0 | 16.8 | 222,785 |
| Physical iPhone 16 Safari, portrait, production | 1 | 15.0 | 928.0 | 20.0 | Not drained |

The matched pressure runs reduce retained console characters by about 96%. They do not demonstrate a material speed improvement: aggregate latency is similar. Individual hero response samples reached 132.0 ms before and 135.4 ms after under synthetic pressure. The bounded retention fix addresses a proven growth problem; attributing the reported severe slowdown to it would exceed the evidence.

Both pressure runs seed roughly 10 MB of UTF-16-derived history bytes using copies of one real QA hand, then repeat three six-hand transition cycles without reload. Production emulation repeats four cycles. The full runs include a cold hand and a final reload hand. Artificial history seeding creates a 1.4–1.5 second event-loop/frame spike in the first subsequent probe; the summaries mark that probe and exclude it from event-loop incident flags and early/late comparisons. Raw metrics are preserved, including the spike. This fixture setup is not evidence of game-transition lag.

## Physical-device limitations

Safari reported 393 × 695 portrait. Landscape is not required by the application (`shouldGateOrientation=false`); the initial runner's landscape prerequisite was mistaken and removed. Native WebDriver clicks/touch actions selected text rather than consistently activating controls. The successful hand therefore used scripted DOM button activation on the real device. These samples measure physical-device CPU/render/event-loop behavior after activation, **not finger-to-screen touch latency**.

The first successful hand ended normally. The runner then timed out finding the Cash Out game-selection button because its selector searched only the first dialog, which could be hidden. The selector was corrected to search all matching dialogs. Subsequent new Safari sessions failed to connect to the device, so the correction and repeated hardware transitions have not been verified. These automation/setup failures are not classified as game freezes. The disposable production QA account was deleted (`account-cleanup.deleted=true` in the raw evidence).

## Validation and reproduction

- Production mobile emulation: 2 tests passed, 52 hands, about 17 minutes.
- Matched pressure comparison: 1 test passed per build, 40 hands total; bounded-buffer assertion passed on fixed build.
- Regression tests: 4 new retention tests passed; 50 known-game regressions and 66 RL safety tests passed.
- Lint: no errors, three pre-existing warnings. Production build passed.

Use `playwright.mobile-performance.config.js` with `E2E_APP_URL`, `MGX_PERF_RUN`, and `MGX_PERF_CYCLES`. For pressure comparison add `MGX_PERF_CPU_RATE=4 MGX_PERF_HISTORY_FILL=1`; add `MGX_PERF_EXPECT_BOUNDED=1` on the fixed build. Run only one pressure measurement at a time against a production build. `scripts/qa/summarize-mobile-performance.mjs <run-folder>` generates per-stage distributions and early/late comparisons. Thresholds are investigation heuristics, not approved release gates.

The `.jsonl.gz` files preserve raw timing rows without console payloads or account credentials. `manifest.json` records uncompressed SHA-256 hashes. Uncompress each file into `<run>/<project>/measurements.jsonl` to regenerate its summary. Heap samples are optional browser proxies and may be quantized. CPU turn residence includes the intentional action pause; it is not inference duration. Transition durations include automation transport overhead.

## Remaining verification

Repeat the full transition sequence on a reliably connected physical phone, then compare the fixed build under the same conditions. Confirm the user's original whole-screen symptom before closing #417. This change has not been deployed to production.
