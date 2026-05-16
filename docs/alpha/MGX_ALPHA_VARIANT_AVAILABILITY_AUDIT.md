# MGX Alpha Variant Availability Audit

Date: 2026-05-16

## Policy

Friend alpha should expose fewer, safer games. Variants with active P0/P1 progression, pot, mobile, replay, or result-risk remain disabled for friends even if they are implemented.

## Availability Table

| Variant | Availability | Reason | Blockers | Required Before Alpha |
| ------- | ------------ | ------ | -------- | --------------------- |
| Badugi | preview_only | Round progression and pot display regression reproduced in browser QA. | `BADUGI-ALPHA-01`, `BADUGI-ALPHA-02` | Fix full 3-draw stall, pot continuity, no-next-alive actor election, mobile QA |
| A-5 Triple Draw | alpha_playable | Core draw flow is the initial friend-alpha safe draw target. | none active | Keep one-hand/EV/RL safety green |
| 2-7 Single Draw | alpha_playable | Single-draw core flow selected as safe alpha scope. | none active | Keep one-hand/EV/RL safety green |
| A-5 Single Draw | alpha_playable | Verified coaching/RL path and core single-draw flow are strongest current signal path. | none active | Keep one-hand/EV/RL safety green |
| 2-7 Triple Draw / D01 | preview_only | D01 remains excluded from Iron teacher/RL paths and is not friend-alpha selectable. | D01 teacher/RL exclusion | Separate gameplay-only approval if needed |
| Badeucey TD / Badacey TD | preview_only | Split draw flow exists but split result, replay, and mobile QA are not alpha-ready. | split-result QA | Split result UI/replay/mobile audit |
| Hidugi TD / Archie TD | preview_only | Special draw evaluators exist but natural long-run/mobile/replay coverage is not alpha-ready. | special evaluator QA | Long-run browser smoke and replay audit |
| 5-Card SD / Badugi SD / Badeucey SD / Badacey SD / Hidugi SD | preview_only | Basic paths exist but evaluator/mobile/replay coverage remains insufficient for friends. | mobile/replay QA | Variant-specific smoke and replay audit |
| NLH / FLH / Super Hold'em | preview_only | Board games are implemented but alpha mobile/replay/result gates are not complete. | board replay/EV gates | Board terminal replay and mobile QA |
| PLO / PLO8 / FLO8 / Big-O / 5-Card PLO | preview_only | Omaha flow exists but EV/replay/split-result gates remain open. | `EV-GUARD-06`, `EV-GUARD-08` | Terminal evaluator replay and split-pot QA |
| Stud / Stud8 / Razz / Razz27 | preview_only | Stud/Razz flows exist but alpha mobile/replay/result QA remains incomplete. | stud replay/mobile QA | Real browser replay/result smoke |
| Razzdugi / Razzducey | preview_only | Hybrid stud/draw flow is not friend-alpha ready. | hybrid evaluator QA | Hybrid progression/replay/mobile audit |
| Dramaha Hi / 2-7 / A-5 / Zero / Hidugi / Badugi | preview_only | Dramaha paths exist but split result UX and replay/mobile QA remain open. | split-result UX | Split result, replay, and mobile audits |
| Chinese Poker / OFC | coming_soon | Street progression and fantasyland are incomplete. | `CHINESE-03` | Complete OFC street/fantasyland and replay smoke |

## Hidden Variants

None currently. Unknown variants are treated as `coming_soon` by the gate.

## Implementation

The alpha gate is implemented in:

```txt
src/games/config/variantAvailability.js
src/games/config/canLaunchVariant.js
```

UI entry points:

```txt
src/ui/screens/GameSelectorScreen.jsx
src/ui/components/VariantSelectModal.jsx
src/ui/screens/MainMenuScreen.jsx
src/ui/App.jsx
```

Feature flags:

| Flag | Purpose |
| --- | --- |
| `VITE_MGX_SHOW_PREVIEW_VARIANTS` | allow preview-only variants |
| `VITE_MGX_ALPHA_ONLY_VARIANTS` | document alpha-only launch mode |
| `mgx.previewVariants=true` | local preview override |
| `mgx.alphaOnlyVariants=true` | local alpha-only override |

