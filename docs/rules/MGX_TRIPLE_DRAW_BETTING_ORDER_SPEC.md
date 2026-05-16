# MGX Triple Draw / Single Draw Betting Order Spec

Date: 2026-05-16

## Scope

This spec applies to the draw-lowball family currently exposed through the MGX draw engine:

| variantId | Game | Draw Count | Lowball Rule |
| --- | --- | ---: | --- |
| `D01` | 2-7 Triple Draw | 3 | 2-7 lowball |
| `D02` | A-5 Triple Draw | 3 | ace-to-five lowball |
| `S01` | 2-7 Single Draw | 1 | 2-7 lowball |
| `S02` | A-5 Single Draw | 1 | ace-to-five lowball |

## Betting Order

### Three or More Players

| Street | First Actor |
| --- | --- |
| Pre-draw betting | First active seat left of the big blind, commonly UTG |
| Post-draw betting | First active seat left of the button |

### Heads-Up

| Street | First Actor |
| --- | --- |
| Pre-draw betting | Button / small blind |
| Post-draw betting | Big blind |

## Skip Rules

Folded, busted, sitting-out, and all-in seats are skipped for betting actor election.

## No Eligible Actor

If no active non-all-in betting actor exists, the engine must close the betting round and transition to the next draw, showdown, or terminal hand state. It must not re-elect a stale actor or leave the UI in an `ACTING` state.

## Source of Truth

The controller's canonical `turn` / `nextTurn` / `currentActor` is the source of truth for actor state. UI metadata such as `metadata.actingPlayerIndex` is advisory and must not override a canonical controller actor.
