# MGX Physical QA Evidence Template

Copy this template for each physical QA run. Store the completed packet beside screenshots and exports.

Recommended path:

```text
reports/physical/<YYYYMMDD>/<blocker-id>/evidence.md
```

## Evidence Packet

### Blocker

| Field | Value |
| --- | --- |
| Blocker ID |  |
| Related blocker docs | `docs/bugs/PHYSICAL_QA_PENDING.md`, `docs/bugs/ACTIVE_BLOCKERS.md` |
| Severity |  |
| Area |  |
| Scenario |  |
| Expected closure target | closed / verified monitor / keep active |

### Device / Browser / Mode

| Field | Value |
| --- | --- |
| Device model |  |
| OS version |  |
| Browser | Safari / PWA standalone / Chrome / other |
| Browser version |  |
| Mode | Safari tab / PWA standalone / browser tab |
| Orientation | portrait / landscape / both |
| Network | Wi-Fi / cellular / other |
| PWA install state | fresh install / existing install / not applicable |

### Release Identity

| Field | Value |
| --- | --- |
| URL |  |
| Release id / commit SHA |  |
| Deployed asset hash |  |
| API health checked | yes / no |
| API health result |  |
| QA timestamp start |  |
| QA timestamp end |  |

### Artifacts

| Artifact | Path |
| --- | --- |
| Screenshot: hand start |  |
| Screenshot: BET active |  |
| Screenshot: BET closing action |  |
| Screenshot: DRAW active |  |
| Screenshot: DRAW1 CPU action |  |
| Screenshot: next BET |  |
| Screenshot: SHOWDOWN/result |  |
| Screenshot: mobile controls portrait |  |
| Screenshot: mobile controls landscape |  |
| Screenshot: PWA safe area |  |
| Export JSON |  |
| Console/network log |  |
| Video recording |  |
| Other |  |

### Scenario Steps

| Step | Expected | Observed | Artifact path |
| --- | --- | --- | --- |
| 1. Start game |  |  |  |
| 2. Reach first BET |  |  |  |
| 3. Close BET |  |  |  |
| 4. Reach DRAW |  |  |  |
| 5. Complete DRAW1 / CPU action |  |  |  |
| 6. Reach next BET |  |  |  |
| 7. Reach SHOWDOWN/result |  |  |  |
| 8. Reach next hand or terminal stable state |  |  |  |

### Phase / Actor / Legal Actions

| Capture point | Raw phase | Display phase | Draw/Round | Acting seat | Hero active | Legal actions | Visible controls | Artifact path |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hand start |  |  |  |  |  |  |  |  |
| BET active |  |  |  |  |  |  |  |  |
| BET close |  |  |  |  |  |  |  |  |
| DRAW active |  |  |  |  |  |  |  |  |
| DRAW1 CPU action |  |  |  |  |  |  |  |  |
| Next BET |  |  |  |  |  |  |  |  |
| SHOWDOWN/result |  |  |  |  |  |  |  |  |
| Next hand |  |  |  |  |  |  |  |  |

### Player Statuses

| Seat | Position | Player type | Stack | Folded | All-in | Busted | Seat-out | Mucked | Card count | Notes |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | ---: | --- |
| 0 |  | Hero / CPU |  |  |  |  |  |  |  |  |
| 1 |  | Hero / CPU |  |  |  |  |  |  |  |  |
| 2 |  | Hero / CPU |  |  |  |  |  |  |  |  |
| 3 |  | Hero / CPU |  |  |  |  |  |  |  |  |
| 4 |  | Hero / CPU |  |  |  |  |  |  |  |  |
| 5 |  | Hero / CPU |  |  |  |  |  |  |  |  |

### Mobile Controls / Safe Area

| Field | Value |
| --- | --- |
| CSS viewport width x height |  |
| Visual viewport width x height |  |
| Layout mode | mobile-portrait / mobile-landscape / desktop |
| Horizontal overflow present | yes / no |
| Fold bounding box | x=, y=, w=, h= |
| Call/Check bounding box | x=, y=, w=, h= |
| Raise/Bet bounding box | x=, y=, w=, h= |
| Minimum bottom clearance |  |
| Covered by toolbar/home indicator | yes / no |
| Legal tap applied once | yes / no |

### DRAW RUSHER / Phase Accent

| Phase | Expected accent | Observed accent | Pass |
| --- | --- | --- | --- |
| BET | Non-red; no DRAW RUSHER |  | yes / no |
| DRAW | Red accent; DRAW RUSHER visible |  | yes / no |
| Next BET | Non-red; DRAW RUSHER removed |  | yes / no |
| SHOWDOWN/WAITING | No stale DRAW RUSHER |  | yes / no |

### Cross-Variant Contamination

Fill this section when the blocker involves prior variants before Badugi.

| Step | Variant | Mode | Hand/card shape | Phase | Actor | Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| Prior variant 1 |  |  |  |  |  |  |
| Prior variant 2 |  |  |  |  |  |  |
| Prior variant 3 |  |  |  |  |  |  |
| Badugi tournament start | badugi | tournament |  |  |  |  |
| Badugi after first boundary | badugi | tournament |  |  |  |  |

### Console / Network / Backend

| Field | Value |
| --- | --- |
| Console errors present | yes / no |
| Console errors |  |
| Failed network requests present | yes / no |
| Failed network requests |  |
| API/backend errors |  |
| CPU decision source captured | yes / no / not applicable |
| CPU decision source value |  |
| Fallback reason |  |
| Session id |  |
| Hand id |  |

### Pass / Fail

| Field | Value |
| --- | --- |
| Result | PASS / FAIL / INCONCLUSIVE |
| Historical failure point covered | yes / no |
| Scenario advanced beyond failure point | yes / no |
| Recurrence condition observed | yes / no |
| Recurrence condition details |  |
| Residual risk |  |
| Recommended blocker state | keep active / verified monitor / closed |

### Reviewer Signoff

| Field | Value |
| --- | --- |
| QA operator |  |
| Reviewer |  |
| Review date |  |
| Signoff statement |  |

Signoff statement:

```text
Physical QA evidence reviewed for <blocker-id> on <device/browser/mode>.
Release <commit/hash> was tested on the original required physical path.
No recurrence condition was observed.
Evidence packet and artifacts are stored at <path>.
Recommended state: <closed|verified monitor|keep active>.
Residual risk: <text>.
```

