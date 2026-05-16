# MGX Friend Alpha Launch Scope Freeze

Date: 2026-05-16

## Playable Scope

Only these variants are in friend-alpha scope:

| Variant | Status | Reason |
| --- | --- | --- |
| D02 | alpha playable candidate | Desktop one-hand smoke passes; gated in menu |
| S01 | alpha playable candidate | Desktop one-hand smoke passes; gated in menu |
| S02 | alpha playable candidate | Desktop one-hand smoke passes; gated in menu |

## Excluded From Friend Alpha

| Variant / Family | Status | Reason |
| --- | --- | --- |
| Badugi | preview_only | Browser automation is green, but Badugi mobile full-hand/manual QA is not complete |
| Board / Omaha | preview_only | Broader long-run and mobile QA not alpha-cleared |
| Stud / Razz | preview_only | Long-run, result UX, and mobile QA not alpha-cleared |
| Dramaha / Badugi family variants | preview_only | Result/replay/mobile depth not alpha-cleared |
| Chinese / OFC | coming_soon | OFC street progression/fantasyland incomplete |
| Unknown variants | coming_soon or hidden | Safety-first default |

## Preview Flag Policy

- Default friend alpha should expose only `alpha_playable` variants.
- `preview_only` variants require the explicit preview variants flag and are for developer/internal QA.
- Do not ask friends to enable preview variants.

## Feedback Requests For Friends

Ask for feedback only on D02/S01/S02:

- Was the game easy to start?
- Were the action buttons readable and tappable?
- Was the pot/phase clear?
- Did the result overlay make sense?
- Did coaching/replay feedback help or confuse?
- Did anything freeze, disappear, or feel broken?

## Rollback

If a P0 appears in the friend-alpha scope:

1. Stop sharing the preview URL.
2. Revert to the previous deploy backup or redeploy the last known-good commit.
3. Keep Badugi and all non-alpha variants gated.
4. Record the incident in `docs/bugs/current_bugs.md`.

Current rollback baseline:

- Deployed snapshot: `90a830b7e1d2e9cb1a0683e59088874fd6f2972f`
- Previous dist backup: `/var/backups/mgx/dist/mgx-dist-20260516-105342-pre-alpha-preview.tar.gz`

## Launch Decision

Do not widen to friends until:

- Remote GitHub sync is resolved.
- Physical mobile QA is complete.
- D02/S01/S02 mobile gameplay action overflow is fixed or verified safe on real devices.
