# MGX Review Mode Separation

Date: 2026-05-24
Scope: design record for separating Cash Review and Tournament Review. No engine, backend, RL, evaluator, or gameplay changes.

## Executive Summary

MGX has two different user review modes:

| Mode | Entry Point | Unit | Gate | Primary Contract |
| --- | --- | --- | --- | --- |
| Cash Review / Session Review | `/history`, cash hand history | cash session or cash hand slice | existing 30-hand Cash Review gate | `CashReviewContract` |
| Tournament Review | `TournamentResultOverlay` | one completed tournament | no hard 30-hand gate | `TournamentReviewContract` |

The modes must stay separate. Cash Review can use existing `/api/analysis/play-feedback`; Tournament Review must always show a local result summary first and may add detailed AI generation later.

## Cash Review

Cash Review is session-level feedback.

| Field | Definition |
| --- | --- |
| Entry point | `/history`, cash/session hand history |
| Minimum data | 30 completed cash hands or current Cash Review eligibility |
| Data source | cash hand history, action history, optional stored feedback |
| API | existing `/api/analysis/play-feedback` |
| Content | good points, bad points, improvement points, key hands, session trends |
| Shared pieces | `KeyHand`, `ReplayRef`, broad feedback lifecycle |
| Excluded | placement, payout, tournament ROI, bust hand |

Existing `HistoryScreen` feedback should be treated as Cash/Session Review unless a separate tournament archive review mode is explicitly introduced.

## Tournament Review

Tournament Review is a single-tournament result review.

| Field | Definition |
| --- | --- |
| Entry point | `TournamentResultOverlay` |
| Display timing | automatically shown after tournament completion |
| Minimum data | tournament result; hand history can be incomplete |
| Gate | no mandatory 30-hand gate |
| Data source | result, placements, hand log, hero actions, replay refs |
| Content | placement, payout, hero net/ROI, reviewed hand count, variant/mixed label, bust hand, biggest win/loss, key hands, next improvement points |
| AI generation | optional enhancement, not required for V1 display |
| Excluded | exact EV claims, GTO/Pro baseline claims, cash-session eligibility wording |

If logs are thin, Tournament Review shows `insufficient_logs` and a simplified result review. It must not use Cash Review `not_enough_hands` or `ineligible` language.

## Shared Primitives

Only small primitives should be shared:

```ts
type ReviewKeyHand = {
  keyHandId: string;
  handId: string;
  variantId: string;
  reason: "biggest-win" | "biggest-loss" | "bust-hand" | "result-swing" | "manual";
  label: string;
  resultDelta?: number | null;
  actionSeqRange?: { start: number; end: number } | null;
  replayRef?: ReviewReplayRef | null;
};

type ReviewReplayRef = {
  handId: string;
  variantId?: string | null;
  target?: {
    handId: string;
    actionSeqStart?: number | null;
    actionSeqEnd?: number | null;
    seat?: number | null;
    street?: string | null;
  };
  available: boolean;
};
```

Do not put `MIN_FEEDBACK_HANDS`, tournament placement/payout, or cash-only session metrics into these shared primitives.

## CashReviewContract

Cash Review owns:

- `contractType: "mgx.cash-review"`
- `mode: "cash"`
- `sessionId`
- `handCount`
- `minHands: 30`
- `eligible`
- `eligibilityReason`
- cash/session summary metrics
- `keyHands`
- `replayRefs`
- `/play-feedback` payload and response lifecycle

This contract may call `/api/analysis/play-feedback`.

## TournamentReviewContract

Tournament Review owns:

- `contractType: "mgx.tournament-review"`
- `mode: "tournament"`
- `tournamentId`
- `variantId`
- `variantIds`
- `result.placement`
- `result.payout`
- `result.buyIn`
- `result.netResult`
- `result.roi`
- `result.championId`
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
- optional `aiFeedback`

Tournament feedback statuses:

| Status | Meaning |
| --- | --- |
| `summary` | Local tournament summary is ready. |
| `loading` | Optional detailed review request is in flight. |
| `complete` | Optional detailed review is available. |
| `insufficient_logs` | Result exists but hand/action logs are too thin for key-hand detail. |
| `unauthenticated` | Summary can be shown, but detailed review cannot be saved. |
| `error` | Optional detailed review failed. |

Tournament Review does not use `minHands`, `not_enough_hands`, or a hard `ineligible` state.

## UI Ownership

| UI | Mode | Rule |
| --- | --- | --- |
| `/history` feedback block | Cash Review / Session Review | Keep 30-hand gate and existing API semantics. |
| `TournamentResultOverlay` | Tournament Review | Always render compact review after placements and before footer buttons. |
| `coachingPreview` | Preview-only coaching | Do not merge into production Cash or Tournament contracts. |
| `ReplayScreen` | Shared replay surface | Consume `ReviewReplayRef.target` only. |

## Step 1-3 Impact

| Step | Correction |
| --- | --- |
| Step 1 implementation plan | Updated to describe automatic Tournament Review in the result overlay, not button-triggered AI generation. |
| Step 2 contract | Refactored away from `buildPlayFeedbackPayload`, `MIN_FEEDBACK_HANDS`, and cash-style eligibility. |
| Step 3 overlay | Removed `AIレビューを見る` and `reviewPanelVisible`; added always-visible compact Tournament Review section. |

## Remaining Work

1. Wire `TournamentReviewContract` from `App.jsx` final tournament state and hand buffers.
2. Add key-hand replay callbacks after replay refs are stable.
3. Decide whether `/history` needs a separate tournament archive review mode.
4. Add optional AI generation only after local summary and evidence capture are reliable.
