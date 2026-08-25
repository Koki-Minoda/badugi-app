# MGX Tournament AI Feedback Status Audit

Date: 2026-05-24
Scope: tournament post-game user review / feedback only. This audit does not cover CPU strength tuning except where Pro baseline / EV artifacts are required to explain user-facing review readiness.

No implementation, gameplay, backend, RL, or UI behavior changes were made in this pass.

## 1. 現在ユーザーに見える機能

| Surface | User Visible | Data Source | Status |
| --- | --- | --- | --- |
| Tournament result overlay | `Tournament Complete`, champion, placement rows, stack, payout, Back to Menu / Play Again | `buildTournamentPlacementsPayload()` from tournament state | Production-visible, real result data |
| Hero bust overlay | Hero placement and in-money placements after bust / fast-forward | tournament state placements | Production-visible, real result data |
| `/history` screen play feedback | "プレイフィードバック" panel, tournament selector, hand count, scope selector, "AIフィードバック作成", saved feedback, key hands | local `history.tournaments` and `history.tournamentHands`, `/api/analysis/play-feedback` | Production route exists, requires login and 30+ hands |
| In-game hand history modal | "プレイフィードバック" from completed hand buffer | current in-memory hand history buffer | Production-visible, but wired as `mode: "cash"` only |
| Tournament result overlay coaching card | `CoachingPreviewCard` / `CoachingSummaryPanel` components can render inside `TournamentResultOverlay` | optional `coachingPreview` prop | Component exists, but not passed by `GameLayoutBase`; not user-visible in production finish flow |
| Learning dashboard preview | Preview entry from menu when coaching preview flag is enabled | Step48-57 preview artifacts | Preview-only behind `?mgxPreview=coaching`, env, or localStorage flag |

Current practical answer: after a tournament ends, users get a result overlay, not an automatic AI review. A tournament AI feedback request exists from the separate `/history` screen if enough tournament hands were persisted and the user is authenticated.

Evidence:

- `src/ui/App.jsx` finishes tournaments by computing placements, finalizing replay, and opening `TournamentResultOverlay`.
- `src/ui/screens/layouts/GameLayoutBase.jsx` renders `TournamentResultOverlay` with placements/title only; no `coachingPreview` is passed.
- `src/ui/screens/HistoryScreen.jsx` builds tournament feedback payloads when a tournament is selected.
- `src/ui/screens/HandHistoryScreen.jsx` builds feedback as `mode: "cash"` even when embedded from the game.

## 2. 内部にあるがUI未接続の機能

| Internal Capability | Exists | Connected To Tournament End UI | Notes |
| --- | --- | --- | --- |
| Coaching preview card | Yes | No | `TournamentResultOverlay` supports optional preview props, but `GameLayoutBase` does not pass them. |
| Coaching summary panel | Yes | No | Can show top lessons and EV total when given a summary object. |
| Replay coaching annotation | Yes | No production tournament-end path | Preview tests use fixture HTML / report artifacts. |
| Coaching telemetry store | Yes | Preview only | Local preview storage, not production backend analytics. |
| Tournament-end feedback preview payload | Yes | No | `src/ai/iron/buildTournamentFeedbackPayload.js` emits `previewOnly: true`. |
| Coaching handoff package | Yes | No | Built from Step46/47 report artifacts, not live user tournament logs. |
| Learning dashboard data | Yes | Preview only | Step58 docs explicitly keep production UI unchanged while flag is off. |
| Counterfactual / EV reports | Yes | No direct user review link | Used for AI/Pro/Iron evaluation artifacts, not per-user tournament review. |

The internal coaching stack is best described as "preview artifact pipeline + UI components", not a live post-tournament review product.

## 3. 実データ連動済みかモックか

| Area | Real Data | Mock / Preview | Assessment |
| --- | --- | --- | --- |
| Placement / payout result | Yes | No | Real tournament state. |
| Tournament replay summary | Partial | No | Stores handId/tableId/seatResults for tournament replay, not full coaching features. |
| Local tournament hands | Yes, if finalized hand history is persisted | No | `saveTournamentHandHistory()` stores snapshots under `history.tournamentHands`. |
| `/history` feedback payload | Yes, from local stored hands | No | Uses real local hand snapshots, but depends on 30+ hands and auth. |
| Backend `/play-feedback` | Yes | Fallback text if OpenAI unavailable | Persists payload/response to `play_feedback_results`. |
| Coaching preview lessons | No live user data | Yes | Built from `reports/ai-iron/step47-*` and Step48-58 preview artifacts. |
| Per-decision EV deltas in UI | No | Yes for preview examples | Preview examples use fixed S02 EV gains such as `+32.2` / `+36.8`. |
| Pro baseline comparison in UI | No | Yes for preview examples | `baselineAction -> recommendedAction` exists only in coaching preview lesson data. |

Backend persistence is real for generic session feedback. The tournament-end coaching card itself is still preview/not wired to live result flow.

## 4. EV評価できる判断とできない判断

| Decision Type | Current Capability | Limitation |
| --- | --- | --- |
| Session-level good/bad/improvement text | Available through `/history` feedback after 30+ hands | Text is generated from summary/keyHands, not exact EV per Hero action. |
| Key hand references | Available | Uses `handId` and `actionSeqRange`; not a ranked EV leak list. |
| Hero BET/CALL/RAISE/FOLD decision EV | Not production-ready | No live per-action EV calculation or Pro baseline comparison in feedback payload. |
| Hero DRAW discard count / draw choice EV | Not production-ready | Draw metadata exists in hand history, but no variant-aware EV evaluator is connected to feedback. |
| All-in / split / showdown importance | Partially summarized | Payload counts rates and can select key hands, but does not compute counterfactual EV. |
| Pro baseline action comparison | Preview-only | Step47/48 coaching examples compare baseline/recommended actions for S02 artifacts. |
| Counterfactual replay delta | Internal reports only | Not available from tournament result overlay or generic feedback endpoint. |

Current feedback can say "良かった点 / 悪かった点 / 改善点" at session-summary level. It cannot defensibly say "this exact Hero decision lost X EV versus Pro" for live tournaments.

## 5. 必要なログ/DB項目

Minimum data required to make tournament post-game AI review production-grade:

| Required Item | Current State | Gap |
| --- | --- | --- |
| tournamentId / mode / variantId | Present in local history and feedback payload | Must be consistently attached to every hand/action DB row. |
| handId | Present | Must be stable across replay, DB, feedback response, and UI deep link. |
| actionSeq / actor seat / Hero flag | Present in hand history/action log paths | Needs production audit for all variants, not only Badugi. |
| phase / round / street | Present | Phase names need normalized contract for mixed variants. |
| legalActions at decision time | Partial / metadata-dependent | Required for judging whether Hero had a better legal option. |
| toCall / pot / stack / currentBet / bet before-after | Present in action log | Needs variant-independent schema. |
| drawInfo before/after/discarded cards | Present in metadata for draw actions | Needs reviewer-safe redaction and variant-aware interpretation. |
| final result / heroNet / payout / ROI | Partial | Needed at tournament and hand level. |
| Pro baseline action | Not stored for Hero decisions | Required for "compared to Pro" review. |
| EV estimate / confidence / method | Not stored for live review | Required for per-decision EV claims. |
| feedback response id / version / source | Present for `play_feedback_results` | Needs link back to tournament result overlay and replay UI. |

Backend tables currently relevant:

- `play_feedback_results`: stores generic cash/tournament feedback payload and response.
- `badugi_hand_logs`, `badugi_hand_actions`, `badugi_hand_results`: Badugi-named hand log tables.
- `badugi_action_logs`: richer action rows with CPU/value telemetry metadata.

The DB model can store generic feedback responses, but it does not yet provide a cross-variant, per-Hero-decision EV review schema.

## 6. Badugi対応状況

| Feature | Badugi Status |
| --- | --- |
| Tournament result overlay | Supported through generic tournament state. |
| Result overlay AI review | Not wired. |
| `/history` generic feedback | Should work if Badugi tournament hands are persisted and hand count >= 30. |
| Hand/action DB logging | Strongest current backend naming/support is Badugi-specific. |
| Hero decision EV | Not live. |
| Pro baseline review | Not live. |
| Replay-linked coaching | Preview fixture support exists; production tournament-end link is not wired. |

Badugi is the best-supported variant for logging infrastructure, but not yet for production post-tournament AI coaching.

## 7. 2-7/A-5対応状況

| Variant | Result Overlay | Generic `/history` Feedback | Per-Decision EV | Coaching Preview Evidence |
| --- | --- | --- | --- | --- |
| 2-7 Triple Draw (`D01`) | Yes | Theoretically yes with persisted hands | No | No production coaching payload evidence in this audit |
| A-5 Triple Draw (`D02`) | Yes | Theoretically yes with persisted hands | No | AI/Pro reports exist, but no live tournament review UI |
| 2-7 Single Draw (`S01`) | Yes | Theoretically yes with persisted hands | No | No live review UI |
| A-5 Single Draw (`S02`) | Yes | Theoretically yes with persisted hands | No | Step47-58 preview coaching artifacts focus on S02 deep RAISE-vs-CHECK |

The 2-7/A-5 family can flow through the generic feedback payload if the hand snapshots carry usable `variantId`, actions, results, and enough volume. The current EV/coaching-specific proof is narrow and preview-only, mainly S02.

## 8. 次に実装すべきTop10

1. Wire tournament finish to a "Review available" entry point instead of only result placement.
2. Decide one production source of truth for tournament hand/action logs: local history, backend history API, or both with sync status.
3. Add a tournament feedback session object that bundles tournament result, hands, key actions, replay links, and feedback request state.
4. Extend `TournamentResultOverlay` to request/show generic play feedback only when eligible, without using preview artifacts as if they were live analysis.
5. Add a structured feedback response schema: strengths, leaks, improvement points, key hands, replay targets, confidence, source.
6. Capture Hero legalActions, actionSeq, phase, pot, stack, and drawInfo consistently for Badugi/D01/D02/S01/S02.
7. Add per-variant feedback guards so mixed variant tournaments do not merge incompatible action schemas.
8. Build a Pro-baseline comparison service that returns legal baseline action plus reason without mutating gameplay AI.
9. Connect counterfactual / EV evaluation as an offline reviewer job, then surface only confidence-gated findings.
10. Add E2E coverage for tournament end -> feedback request -> saved result -> replay key hand path.

## 9. Alpha版で最低限出すべきフィードバック仕様

Alpha minimum should avoid overclaiming exact EV until the EV pipeline is wired.

Minimum user-facing output:

- Tournament result summary: finish place, prize/payout, ROI/chip delta, hands reviewed, variants included.
- 3 sections: 良かった点, 悪かった点, 次回の改善点.
- Key hands: up to 3-6 handId/actionSeqRange references with replay buttons.
- Variant scope label: Badugi / 2-7TD / A-5TD / mixed tournament.
- Source label: `openai`, `fallback`, or `local summary`.
- Eligibility state: "30 hands required" / "login required" / "not enough logged hands".
- No exact "EV lost" copy unless backed by a stored evaluator result with confidence/method.
- Safe fallback copy when OpenAI, replay, or stored hand logs are missing.

Alpha non-goals:

- Full solver/GTO claims.
- Every decision scored.
- Cross-variant EV comparison.
- Automatic Pro baseline claims for variants without verified evaluator coverage.

## 10. 将来の理想仕様

Target architecture:

1. Tournament completion writes a durable `tournament_review_session`.
2. Each Hero decision stores legal actions, selected action, phase, pot, stack, hand/draw context, and replay locator.
3. A reviewer job computes:
   - heuristic issue tags,
   - Pro baseline action,
   - counterfactual EV delta where supported,
   - confidence and method.
4. LLM feedback consumes only the audited structured facts, not raw logs alone.
5. Result overlay shows a compact post-tournament review:
   - 1 strongest play,
   - 1 biggest leak,
   - 1 next-session focus,
   - replay buttons.
6. Full review page expands to all scored decisions, filters by variant, and tracks repeated leaks over time.
7. Feedback records persist to backend with schema version, model version, evaluator version, and redaction metadata.
8. Mobile/PWA review is readable offline for saved feedback and clearly marks pending backend sync.

## Current Direct Answers

| Question | Answer |
| --- | --- |
| トーナメント終了後にレビュー画面があるか | Placement/payout result screen exists. AI review is not automatically shown at tournament end. |
| hand log / action log / tournament result を使っているか | Result overlay uses tournament result. `/history` feedback uses local hand/tournament history. Preview coaching uses report artifacts, not live logs. |
| Heroの各判断にEV評価が付くか | No, not in production. |
| 良かった判断 / 悪かった判断 / 改善点を出せるか | Yes at generic 30+ hand session-feedback level from `/history`; not as automatic tournament-end review. |
| どのvariantで対応済みか | Result overlay is generic. Generic feedback is variant-agnostic if logged hands exist. EV coaching evidence is preview-only and narrow, mainly S02. |
| Badugi / 2-7TD / A-5TDで使えるか | Result overlay: yes. Generic `/history` feedback: expected with enough persisted hands/auth. Per-decision EV review: no. |
| feedback/coaching/commentary UIが存在するか | Yes, but production tournament result flow does not pass coaching data. Preview/dashboard UI is flag-gated. |
| backendやDBに必要データが保存されているか | Generic feedback responses are saved. Raw logs exist, strongest for Badugi. Required per-decision EV/pro-baseline fields are missing. |
| まだモックなのか、実データ連動なのか | Result and generic feedback are real-data paths. Coaching card/summary EV examples are preview artifact paths. |

## Release Readiness Classification

| Capability | Classification |
| --- | --- |
| Tournament result display | Alpha-ready |
| Generic session feedback after tournament history | Prototype / partial alpha, gated by auth + 30 hands |
| Automatic post-tournament AI review | Not implemented |
| Per-Hero-decision EV scoring | Not implemented for production |
| Replay-linked coaching card | Preview-only |
| Pro baseline comparison | Preview/internal only |
| Badugi-specific logging foundation | Partial foundation |
| 2-7/A-5 production review foundation | Needs schema hardening |

