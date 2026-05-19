# MGX Tournament Seat Display Policy

Date: 2026-05-20

## Purpose

Tournament table readability must prioritize active seats, Hero cards, pot, actor state, and action controls. Eliminated players remain part of tournament state for placement and payout, but they must not continue to occupy full table seats after bust confirmation.

## Display Rules

| Player state | Full table panel | Eliminated rail | Actor eligible |
|---|---:|---:|---:|
| Active, non-folded | Yes | No | Yes |
| Folded, still in current hand | Compact/mucked panel allowed | No | No |
| All-in, not busted | Yes | No | BET no / DRAW yes |
| Busted/out/eliminated | No | Yes | No |
| Empty seat | No | No | No |

## Mobile Rule

On mobile, busted/out/eliminated players must not render as large seat panels because they can cover the pot, cards, Hero hand, or controls. Show only a compact eliminated rail entry with name and place/status. The rail must live outside the main table seat grid.

## State Ownership

This is a display policy only:

- Do not remove eliminated players from tournament state.
- Do not change placement, payout, or rebalance logic.
- Do not change hand winner evaluation.
- Do not make busted/out players eligible for BET or DRAW actions.

## Release Gate

`TOUR-SEAT-LIFECYCLE-001` remains open until physical mobile confirms:

- no large busted CPU panel blocks table content;
- eliminated CPU appears only in compact rail/log;
- active player count, result overlays, and payouts remain correct;
- busted/out players never become BET or DRAW actors.
