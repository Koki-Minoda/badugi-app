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

The post-integration browser suite passed all 10 cases: Chromium and WebKit, six-seat cash, and MTT with 2/3/6 entrants, three hands per normal case. All 450 normal target decisions used the registered model with zero fallback; the longest measured inference was 192 ms. In both browsers an injected delayed fetch produced a legal eight-second fallback. The registered model is selected when the D03 Beginner tier is requested. Normal cash game selection and custom practice MTT now expose Beginner and Standard. Standard remains the default for cash and the tier for ranked Store tournaments. A second ten-case browser run through the normal cash selector and practice MTT config, with no developer tier override, passed: 450/450 normal model uses, zero normal fallback, maximum 191 ms, and legal timeout fallback in both browsers. Its immutable JSON is in `d03-v2-beginner-final-evaluation-20261104/browser-full/`. Two additional browser cases clicked the custom practice MTT checkbox and Beginner dropdown in the public tournament UI; Chromium and WebKit each used the model on 33/33 target decisions. Their evidence is in `browser-practice-ui/`.

The product-integrated code was frozen at `634f987944fb058714a6daee25a82aff76fcdf49` and tested on a second unused seed range. Candidate and reference each completed 1,200 independent controller sessions and 24,000 hands. Candidate overall was +1.768 BB/hand (session-bootstrap 95% interval [+1.696, +1.842]), cash +1.599 [+1.510, +1.688], MTT +1.936 [+1.821, +2.048], and pressure-opponent cells pooled +0.565 [+0.333, +0.803]. The unpaired candidate-minus-reference overall difference was +0.449 [+0.357, +0.540] BB/hand. All preregistered Beginner Q checks passed again. The exact browser JSON, manifests, session rows, hand traces, and audit are in `/Users/koki/Documents/Codex/MGX-RL-Artifacts/d03-v2-beginner-product-evaluation-20261104/`; `audit/audit.json` SHA-256 is `a457a89e8efcb7b5458cf6f469c51977193c656807853b732e61859d5d744f39`.

The second frozen evaluation still found 17/40 cells with a negative candidate-minus-reference point difference and eight whose unpaired 95% intervals were wholly below zero. The worst difference was six-seat cash with three occupied seats against the pressure policy: −1.054 BB/hand, interval [−1.763, −0.305]. Action, contribution, response, draw, and fallback counts for every lower-performing cell are in `underperforming-diagnostics.json`. They are descriptive because the arms use different session seeds. Beginner Q is a minimum playability gate, not a claim of uniform superiority. A public release additionally requires CI, deployment, and live model-use evidence; this branch has not yet been deployed.

The final normal-user route was frozen at code commit `25a5c878f63ff4e0650dcbbdeaa213d96641656a` and evaluated on a third unused seed range. Candidate and reference each completed 1,200 independent controller sessions and 24,000 hands. Candidate overall was +1.748 BB/hand (session-bootstrap 95% interval [+1.671,+1.821]), cash +1.525 [+1.431,+1.617], MTT +1.971 [+1.853,+2.086], pressure +0.625 [+0.396,+0.856]. The unpaired overall difference was +0.442 [+0.348,+0.536]. The minimum Beginner Q gate passed. Sixteen of 40 cells had a lower candidate point estimate than reference and eight had unpaired 95% intervals wholly below zero. The worst difference was six occupied seats in cash against draw-heavy opponents: −1.454 [−2.407,−0.471] BB/hand. The pressure and draw-heavy pooled reference differences were inconclusive, so no uniform superiority claim is made. Full frozen manifests, browser JSON, session rows, hand traces, and all lower-performing cell diagnostics are in `/Users/koki/Documents/Codex/MGX-RL-Artifacts/d03-v2-beginner-final-evaluation-20261104/`; audit SHA-256 is `678dc8b78405a82edeaa5dc11cefac5d68b6d7fa93fcd9a671e9e528f9308b6a`. This is local product quality evidence, pending CI, deployment, and live production confirmation.

Local frozen evidence: `/Users/koki/Documents/Codex/MGX-RL-Artifacts/d03-v2-beginner-frozen-evaluation-20261104/` (`audit/audit.json`, manifests, session rows, hand traces, and `underperforming-diagnostics.json`).
