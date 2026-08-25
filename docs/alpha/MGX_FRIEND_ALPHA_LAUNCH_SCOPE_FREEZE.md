# MGX Friend Alpha Launch Scope Freeze

Date: 2026-05-16

## Playable Scope

These five Core games are in friend-alpha scope:

| Variant | Status | Reason |
| --- | --- | --- |
| Badugi | alpha playable | Core MGX game; automated progression, pot, terminal, portrait/mobile, orientation, and actor-order gates pass |
| D01 / 2-7 Triple Draw | alpha playable | Core draw game; rule/mapping/actor/order/mobile gates pass |
| D02 / A-5 Triple Draw | alpha playable | Core draw game; rule/mapping/actor/order/mobile gates pass |
| S01 / 2-7 Single Draw | alpha playable | Core draw game; rule/mapping/actor/order/mobile gates pass |
| S02 / A-5 Single Draw | alpha playable | Core draw game; rule/mapping/actor/order/mobile gates pass |

## Excluded From Friend Alpha

| Variant / Family | Status | Reason |
| --- | --- | --- |
| Board / Omaha | preview_only | Broader long-run and mobile QA not alpha-cleared |
| Stud / Razz | preview_only | Long-run, result UX, and mobile QA not alpha-cleared |
| Dramaha / Badugi family variants | preview_only | Result/replay/mobile depth not alpha-cleared |
| Chinese / OFC | coming_soon | OFC street progression/fantasyland incomplete |
| Unknown variants | coming_soon or hidden | Safety-first default |

## Preview Flag Policy

- Default friend alpha exposes only `alpha_playable` variants.
- `preview_only` variants remain internal/developer QA only.
- Friends should not enable preview variants.

## Feedback Requests For Friends

Ask for feedback on the Core 5 games:

- Did the game start cleanly?
- Were the action buttons readable and tappable?
- Was the pot/phase/draw round clear?
- Did Badugi ever freeze, lose the pot, or get stuck after result?
- Did the result overlay and next-hand flow work?
- Did coaching/replay feedback help or confuse?
- Did anything disappear, overlap, or feel broken on mobile?

## Rollback

If a P0 appears in friend-alpha scope:

1. Stop sharing the preview URL.
2. Revert the affected availability entry, or redeploy the last known-good commit.
3. Record the incident in `docs/bugs/current_bugs.md`.

Current deployed baseline before Badugi promotion:

- Deployed snapshot: `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9`
- Previous dist backup: `/var/backups/mgx/dist/mgx-dist-20260516-105342-pre-alpha-preview.tar.gz`

## Launch Decision

Core5 automation is green, but final friend-alpha GO still requires:

- physical mobile QA on at least one real device, or explicit acceptance of that P1 risk
- remote GitHub sync, or explicit acceptance of that P1 operational risk

Current automated status:

- Core5 desktop/mobile/tournament/orientation/actor-order gates: PASS.
- Physical mobile QA: PENDING.
- Remote push/sync: BLOCKED in this shell by missing credentials.
