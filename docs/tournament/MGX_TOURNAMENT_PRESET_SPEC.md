# MGX Tournament Preset Spec

Date: 2026-05-19

## Policy

MGX tournament structures are minutes-based. Hand-count level-up is not the target production model. Friend matches may use custom structures, while store/regional/national/world presets should be predictable and comparable.

Ante modes supported by the product direction:

- `BB_ANTE`
- `FULL_ANTE`
- `NONE`

## Preset Candidates

| Preset | Initial Stack | Blind Interval | Ante | Target Duration | Role |
| --- | ---: | ---: | --- | ---: | --- |
| Store Turbo | 20BB | 1 min | BB ante from level 2 | 12-15 min | fast store/friend event |
| Regional | 40BB | 2 min | BB ante from level 3 | 25-35 min | quick competitive event |
| National | 75BB | 4 min | BB ante from level 3 | about 45 min | default skill-expression preset |
| World Championship | 100BB | 5 min | BB ante default, full ante optional | about 60 min | flagship tournament |

These presets are defined in `src/tournament/structure/tournamentPresets.js` and checked by `scripts/run-tournament-structure-gate.js`.

## Latest Gate Result

`node scripts/run-tournament-structure-gate.js` returns `PASS_WITH_NOTES`.

| Preset | Status | Est. Duration | p95 | HU Risk | Meaningful Decisions | Push/Fold Ratio |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| Store Turbo | `PASS_WITH_NOTES` | 12 | 12 | LOW | 40 | 0.923 |
| Regional | `PASS` | 25 | 25 | LOW | 108 | 0.769 |
| National | `PASS` | 40 | 40 | LOW | 184 | 0.636 |
| World Championship | `PASS` | 55 | 55 | LOW | 282 | 0.583 |

## Guardrails

- Every preset must eventually force sub-10BB play so heads-up cannot become endless.
- Store Turbo may be push/fold heavy, but larger presets must preserve meaningful betting/draw choices.
- Full ante is allowed as a pressure option, but BB ante should be the default until live readability and decision-density checks clear.
- Structure changes must be rechecked with CPU realism and meaningful-decision density audits.

## Alpha Recommendation

Use Regional Turbo or National as the first friend-alpha tournament preset. Keep Store Turbo available only as a clearly fast custom/friend option. Do not use pro-overlay CPU as the default opponent source until the fold-heavy path is fixed or explicitly disabled for alpha.
