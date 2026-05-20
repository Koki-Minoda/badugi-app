# MGX CPU Action Schema Spec

Status: active for Badugi runtime adapter fixes.

## Purpose

CPU policy layers may emit actions through different historical shapes. The runtime must apply a single canonical action shape before it reaches the game controller. This prevents pro-overlay pressure intents from being silently converted into passive check/call actions.

This is an adapter/schema contract only. It does not change evaluator logic, RL training, or CPU strategy tuning.

## Canonical CPU Action

Runtime adapters must normalize CPU decisions to:

```js
{
  action: "fold|check|call|bet|raise|draw|pat",
  amount,
  drawCount,
  discardIndexes,
  reason,
  decisionSource
}
```

Additional telemetry fields may be attached, but `action` is the canonical action field used by application code after normalization.

## Accepted Legacy Aliases

Legacy decision aliases are accepted only before runtime application:

| Legacy field | Canonical handling |
| --- | --- |
| `type` | Read as `action` when `action` is absent. |
| `bet` | Preserved when legal; in fixed-limit Badugi contexts it may normalize to `raise` when `RAISE` is the legal pressure action. |
| `raise` | Preserved when legal; may normalize to `bet` only when `BET` is the legal open action and no call is outstanding. |
| `draw`, `DRAW(n)` | Normalize to `draw`; discard payload is normalized separately. |
| `pat`, `stand pat` | Normalize to `pat` with `drawCount: 0`. |

## Runtime Rules

- Badugi BET runtime must call `normalizeCpuAction(rawDecision, context)` before applying a CPU decision.
- Pro-overlay output must not be read directly from `action` without checking the legacy `type` alias.
- Unknown pressure-like values must not silently collapse to check/call. They must be classified with `CPU_ACTION_INVALID_AFTER_NORMALIZATION`.
- Known actions that are not legal in the current context must be classified with `CPU_ACTION_ILLEGAL_AFTER_NORMALIZATION`.
- Fallback check/call is allowed only after recording the fallback reason in CPU telemetry.
- Draw payload normalization must remain separate from betting action normalization.

## Telemetry

CPU decision telemetry should retain enough fields to audit adapter behavior:

- `rawDecisionType`
- `rawDecisionAction`
- `rawActionSource`
- `sourceActionField`
- `normalizedAction`
- `normalizationWarnings`
- `legacyTypeAliasNormalized`
- `adapterMismatch`
- `fallbackReason`

For a valid pro-overlay `{ type: "raise" }` Badugi pressure decision, the expected trace is:

```js
{
  decisionSource: "pro-overlay",
  rawDecisionType: "raise",
  rawActionSource: "type",
  normalizedAction: "raise",
  finalAction: "raise",
  legacyTypeAliasNormalized: true,
  adapterMismatch: false
}
```
