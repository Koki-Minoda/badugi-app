# D03 Badugi Beginner controller-v2 candidate

The Beginner candidate was trained against the real Badugi controller and passed its frozen minimum-quality gate. This gate establishes playable Beginner quality for the specified scripted opponents. It does not establish superiority in every matchup, human-opponent strength, or any higher tier.

## Frozen provenance

| Item | Value |
| --- | --- |
| Training | 1,000 reference-trajectory hands, 1,000 imitation updates, 1,000 RL hands, 851 DQN updates and 965 anchor updates; 2,816 optimizer updates total |
| Checkpoint SHA-256 | `c1d7a335953c188ba6edd512c6596cf0803a84a8405bc33fbd4e3b505d0a2322` |
| ONNX SHA-256 | `61681aa1c652410e52249be2834834eca569b56fb29305b462ac4de2e7a80f5d` |
| Frozen evaluation code | `8b5b72313aa769cf0d28bff907f75971ad04384a` |
| 96-input contract SHA-256 | `ddc6f900617b3a6ab62da1df9475f2ca97846ea6310cb4858aa331054d72bdd2` |
| Candidate manifest SHA-256 | `60533b14860d3e5df902a55fe9916fa330d1736d5f139c6857cd749f62164c5f` |
| Reference manifest SHA-256 | `2c2245fe6b7c0c1999ef093eaf84ded2fa063373c8af4f1211674a177588429a` |

The frozen evaluation used 10 seat/mode groups (native 2/3/6 seats and occupied 2/3/6 in a physical six-seat table; cash and MTT), four opponent policies, 30 independent sessions per cell, and 20 hands per session. Candidate and reference used disjoint, unused seeds: 1,200 sessions and 24,000 hands per arm. Every session conserved chips. Confidence intervals are stratified session-bootstrap percentile 95% intervals over independent sessions, not hand-level intervals. The reference-arm difference is unpaired and descriptive.

## Frozen quality result

| Condition | Candidate BB/hand | 95% interval | Reference BB/hand |
| --- | ---: | ---: | ---: |
| Overall | +1.714 | [+1.634, +1.794] | +1.292 |
| Cash | +1.593 | [+1.490, +1.695] | +1.199 |
| MTT | +1.834 | [+1.718, +1.954] | +1.385 |
| Pressure opponents | +0.541 | [+0.322, +0.770] | +0.762 |

Cash and MTT use different blind sizes, so raw chip/hand is reported by mode: cash +31.855 chips/hand (95% interval [+29.794, +33.901]) and MTT +91.721 chips/hand ([+85.912, +97.719]). The mixed-mode overall is normalized to BB/hand. Candidate minus reference overall was +0.422 BB/hand, unpaired 95% interval [+0.323, +0.521]. Fold frequency was 5.26%; pat frequency was 24.17%. All predeclared Beginner Q checks passed, including the 40-cell point-mean floor of −1 BB/hand. The lowest cell was 3/3 cash against pressure at −0.277 BB/hand (95% interval [−0.777, +0.322]).

Seventeen of the 40 cell point means were below the reference, and nine of their unpaired 95% difference intervals were wholly below zero. The most severe observed difference was 3/3 cash against pressure: candidate −0.277 versus reference +0.932 BB/hand; difference −1.208, interval [−1.954, −0.436]. In that cell the candidate folded 3 times in 342 faced bets, versus 321 in 1,395 for the reference; the candidate raised 84 times and invested more per raise. The separate-seed traces do not prove that any one action caused the loss. These weaknesses are recorded for the next training cycle and must not be described as universal strength.

## Runtime and release boundary

The isolated frozen browser gate used Chromium and WebKit, cash and MTT, three hands per normal case: 78/78 target-seat decisions used the ONNX model, with no normal fallback; BET/DRAW actions and chip conservation passed. A delayed model fetch caused legal fallback at the eight-second deadline in both browsers. The production registry entry retains the exact ONNX hash and routes only D03 Beginner through the controller-v2 adapter. Standard and higher tiers retain their own models and input contracts. The old Beginner asset remains available for historical replay but is not selected for new Beginner inference.

The post-integration browser suite separately verifies the registered model in Chromium and WebKit, cash and MTT with 2/3/6 entrants, legal decisions, chip conservation, and timeout fallback. The full result and artifact hashes must be attached before merging or deploying. The worktree branch and the evaluation gate do not by themselves mean the public application has changed.

Local frozen evidence: `/Users/koki/Documents/Codex/MGX-RL-Artifacts/d03-v2-beginner-frozen-evaluation-20261104/` (`audit/audit.json`, manifests, session rows, hand traces, and `underperforming-diagnostics.json`).
