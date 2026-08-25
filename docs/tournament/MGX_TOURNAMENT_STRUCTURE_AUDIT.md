# MGX Tournament Structure Audit

Date: 2026-05-19

## Scope

This audit measures tournament structure quality for Core5 without changing game rules, RL routing, evaluator logic, or UI. The measured variants are Badugi, D01, D02, S01, and S02. The Node CPU simulation runner currently measures D01/D02/S01/S02; Badugi tournament quality must be confirmed through browser/live telemetry because the existing Node runner intentionally skips the Badugi browser/controller path.

Generated reports:

- `reports/tournament/tournament-structure-audit.json`
- `reports/tournament/turbo-structure-simulation.json`
- `reports/tournament/meaningful-decision-density.json`
- `reports/ai/tournament-ai-feedback-audit.json`

## Structure Summary

| Preset | Initial Stack | Interval | Ante | Estimated Duration | HU Duration | Meaningful Decisions | Classification |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| Store Turbo | 20BB | 1 min | BB ante from level 2 | 12 min | 3.0 min | 40 | `PASS_WITH_NOTES`, push/fold heavy |
| Regional | 40BB | 2 min | BB ante from level 3 | 25 min | 6.0 min | 108 | `PASS` |
| National | 75BB | 4 min | BB ante from level 3 | 40 min | 9.6 min | 184 | `PASS` |
| World | 100BB | 5 min | BB ante from level 3 | 55 min | 13.2 min | 282 | `PASS` |

## Findings

- Store Turbo hits the requested 15-minute neighborhood, but it becomes push/fold almost immediately. It is viable for a casual store event only if the product accepts low skill expression.
- Regional is the first preset with acceptable decision density while still feeling fast.
- National and World presets preserve meaningful decisions better and have low heads-up endless risk in the simulation.
- Both World BB ante and World full ante are viable in the 60-120 minute target window. Full ante should be treated as a pressure variant, not the default, until live play confirms it is still readable and fun.
- Heads-up endless risk is low across all simulated presets because all structures eventually force sub-10BB pressure.

## Risks

| ID | Risk | Severity | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| `TOURNAMENT-STRUCTURE-001` | Store Turbo is very fast and push/fold heavy. | P2 | `store-turbo` returns `PASS_WITH_NOTES` with push/fold ratio `0.923`. | Keep as a friend/custom quick-match option, not the default competitive preset. |
| `HU-ENDLESS-001` | Heads-up could become endless if blind growth is flattened later. | P2 monitor | Current simulation says `LOW` risk. | Preserve eventual sub-10BB pressure in every preset. |

## Recommended Presets

| Tier | Stack | Blind Interval | Ante | Expected Duration | Skill Expression |
| --- | ---: | ---: | --- | ---: | --- |
| Store | 20BB | 1 min | BB ante | 12-18 min | Low, turbo/push-fold |
| Regional | 40BB | 2 min | BB ante | 25-35 min | Medium |
| National | 75BB | 4 min | BB ante | about 45 min | Medium-high |
| World | 100BB | 5 min | BB ante default, full ante optional | about 60 min | High |

## Release Decision

Tournament structure is usable for alpha as a measured preset framework, but Store Turbo should be labeled as a fast/fun option rather than the default quality benchmark. The larger release blocker is CPU decision quality on the pro-overlay path, not blind progression shape.
