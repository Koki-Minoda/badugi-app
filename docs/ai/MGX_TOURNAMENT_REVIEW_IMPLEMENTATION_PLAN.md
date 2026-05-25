# MGX Tournament Review Implementation Plan

Date: 2026-05-24
Scope: UI/contract planning for post-tournament review. No engine, roundFlow, backend, RL, or gameplay changes.

## Correction Summary

Step 1-3 initially mixed Cash Review and Tournament Review concepts:

| Mixed Area | Problem | Corrected Direction |
| --- | --- | --- |
| `TournamentReviewContract` | Imported Cash Review payload and 30-hand gate semantics. | Tournament contract is independent. It renders a local tournament summary for any completed tournament. |
| `TournamentResultOverlay` | Added an `AIレビューを見る` button and a visible API-not-connected placeholder. | Tournament Review is always shown inside the result overlay after the tournament ends. No start button is required. |
| Planning language | Treated `/api/analysis/play-feedback` as the main Tournament Review path. | Detailed AI generation is an optional enhancement. V1 uses result, hand log, key hands, and replay refs. |
| `/history` feedback | Could be interpreted as the same review mode. | `/history` remains Cash/Session Review. Tournament finish review uses a separate contract. |

## Review Mode Definitions

### Cash Review

- Entry point: `/history` and cash/session history surfaces.
- Unit: cash session or selected cash hand slice.
- Gate: 30 completed hands or the existing Cash Review eligibility rule.
- API: existing `/api/analysis/play-feedback` can be used.
- Content: good points, bad points, improvement points, key hands, session-level trends.
- Not included: tournament placement, payout, ROI, bust hand.

### Tournament Review

- Entry point: `TournamentResultOverlay`.
- Unit: one completed tournament.
- Gate: no hard 30-hand gate.
- Display timing: automatic, inside the tournament result overlay.
- V1 content: placement, payout, net result/ROI when available, reviewed hand count, variant/mixed label, bust hand, biggest win/loss, key hands, replay refs, next improvement points.
- AI generation: optional future enhancement. The review section must render without it.
- Not included: exact EV, GTO/Pro baseline claims, cash-session 30-hand eligibility wording.

Only `KeyHand`, `ReplayRef`, and broad `FeedbackStatus` concepts should be shared between modes.

## Minimal UI Path

The smallest safe insertion point remains `TournamentResultOverlay`.

Reason:

- It is already the post-tournament result surface.
- It preserves placement, payout, champion, Back to Menu, and Play Again flows.
- It avoids redirecting users to `/history` before they see the result.
- `GameLayoutBase` can pass a `tournamentReview` prop without touching table layout or gameplay.

## TournamentResultOverlay V1

Placement:

- Under placement/payout rows.
- Above Back to Menu / Play Again.
- Existing `coachingPreview` remains preview-only and separate.

Required states:

| State | Meaning | User Copy Direction |
| --- | --- | --- |
| `summary` | Local summary is available from result and hand history. | Show "簡易レビュー" plus good points, improvement points, and key hands. |
| `loading` | Optional AI or saved review request is in flight. | Show "レビュー作成中" without blocking result display. |
| `complete` | Optional detailed review exists. | Show saved/generated text, but do not invent exact EV or Pro baseline. |
| `insufficient_logs` | Result exists but hand/action logs are thin. | Show "ハンド履歴が少ないため簡易レビューのみ". |
| `unauthenticated` | User can view summary but cannot save detailed review. | Show "ログインすると詳細AIレビューを保存できます". |
| `error` | Optional review generation failed. | Show "レビューを作成できませんでした" while keeping result data visible. |

No primary "AIレビューを見る" button is needed in V1. A future secondary CTA may request a detailed AI review, but it must not be the entry point for seeing Tournament Review.

## TournamentReviewContract

Required fields:

- `contractType: "mgx.tournament-review"`
- `schemaVersion`
- `mode: "tournament"`
- `tournamentId`
- `variantId`
- `variantIds`
- `result`
- `hands`
- `heroActions`
- `bustHand`
- `biggestWin`
- `biggestLoss`
- `keyHands`
- `replayRefs`
- `reviewDepth`
- `dataQuality`
- `nextImprovements`
- `feedbackStatus`
- `aiFeedback`

Tournament-specific result fields:

- `placement`
- `payout`
- `buyIn`
- `netResult`
- `roi`
- `championId`
- `players`
- `placements`

The contract must not include:

- Cash Review `minHands`
- hard 30-hand `ineligible` state
- mandatory `/play-feedback` payload
- exact EV / GTO / Pro baseline fields without evaluator-backed data

## Cash Review Boundary

`/history` should continue to own Cash/Session Review. Its 30-hand gate and `/api/analysis/play-feedback` path are valid for that mode, but they should not be required for Tournament Review.

No forced `HistoryScreen` change is required for V1. If tournament archive feedback remains in `/history`, it should be labeled separately from the finish-overlay Tournament Review.

## Tests

Required regression coverage:

- `TournamentReviewContract` builds tournament result, hands, hero actions, key hands, and replay refs.
- Tournament Review does not require the Cash Review 30-hand gate.
- Missing auth is `unauthenticated`, not a blocker for local summary.
- Missing logs become `insufficient_logs`, not cash-style `not_enough_hands`.
- `TournamentResultOverlay` always renders Tournament Review when visible.
- The `AIレビューを見る` button and button-only placeholder are absent.
- Summary, loading, complete, insufficient logs, unauthenticated, and error states render naturally.
- Placement, payout, and Champion display remain unchanged.

## Next Steps

1. Wire real tournament hand buffers and placements into `tournamentReview` from `App.jsx`.
2. Add replay-open callbacks for key hands using existing `ReplayScreen` target support.
3. Add optional saved detailed review flow after the local summary is stable.
4. Keep `/history` Cash Review behavior separate unless a dedicated tournament archive review mode is designed.
