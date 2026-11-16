"""Stream D03 real-controller originals into auditable big-bet session units.

Historical input is for calibration only. A gate still needs a separately
frozen plan, fresh holdout, true score bounds, and independent model review.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path


def _next_json(stream, digest, label):
    raw = stream.readline()
    if not raw:
        raise ValueError(f"{label} ended before the expected row")
    digest.update(raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid {label} JSONL row") from error


def _number(value, label):
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError(f"invalid {label}")
    return value


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _ledger(value, *, terminal, hand_index, decision_index, seat_count, chip_pool):
    if (not isinstance(value, dict) or value.get("terminal") is not terminal or
            value.get("handIndex") != hand_index or
            value.get("decisionIndex") != decision_index or
            value.get("chipPool") != chip_pool):
        raise ValueError("missing or mismatched decision chip ledger")
    stacks = value.get("stacks")
    committed = value.get("committedBySeat")
    if (not isinstance(stacks, list) or len(stacks) != seat_count or
            any(type(chips) is not int or chips < 0 for chips in stacks)):
        raise ValueError("invalid decision ledger stacks")
    if terminal:
        if committed is not None:
            raise ValueError("terminal ledger has unsettled committed chips")
        accounted = sum(stacks)
    else:
        if (not isinstance(committed, list) or len(committed) != seat_count or
                any(type(chips) is not int or chips < 0 for chips in committed)):
            raise ValueError("invalid decision ledger committed chips")
        accounted = sum(stacks) + sum(committed)
    if value.get("accounted") != accounted or accounted != chip_pool:
        raise ValueError("decision chip ledger does not balance")
    return value


def audit_session(session, hand_stream, hand_digest, *, model_sha, contract_sha,
                  deadline_ms, index, require_decision_ledger=False,
                  frozen_manifest=False):
    seed = session.get("seed")
    group = session.get("group")
    profile = session.get("profile")
    hero = session.get("heroSeat")
    seat_count = session.get("seatCount")
    count = session.get("hands")
    if (type(seed) is not int or not isinstance(group, str) or
            not isinstance(profile, str) or type(hero) is not int or
            type(seat_count) is not int or not 2 <= seat_count <= 6 or
            not 0 <= hero < seat_count or type(count) is not int or count < 1):
        raise ValueError("invalid session identity or hand count")
    if (not isinstance(session.get("zeroSum"), bool) or
            session["zeroSum"] is not True):
        raise ValueError("session zero-sum claim failed")
    net_chips = 0
    blind_units = 0.0
    net_big_bets = 0.0
    requests = 0
    used = 0
    fallback = 0
    max_latency = 0.0
    no_decision_hands = 0
    actions = Counter()
    first_start = None
    previous_ending = None
    blind_values = set()
    for hand_index in range(count):
        hand = _next_json(hand_stream, hand_digest, "hand trace")
        if (hand.get("seed") != seed or hand.get("handIndex") != hand_index or
                hand.get("group") != group or hand.get("profile") != profile or
                hand.get("heroSeat") != hero):
            raise ValueError("hand/session identity or ordering mismatch")
        bb = _number(hand.get("activeBigBlind"), "active big blind")
        if bb <= 0:
            raise ValueError("active big blind must be positive")
        deltas = hand.get("chipDeltaBySeat")
        starting = hand.get("startingStacks")
        ending = hand.get("endingStacks")
        if (not all(isinstance(x, list) and len(x) == seat_count
                    for x in (deltas, starting, ending)) or
                any(type(value) is not int for array in (deltas, starting, ending)
                    for value in array) or
                any(value < 0 for array in (starting, ending) for value in array) or
                sum(deltas) != 0 or
                any(starting[seat] + deltas[seat] != ending[seat]
                    for seat in range(seat_count))):
            raise ValueError("all-seat terminal chip ledger mismatch")
        if previous_ending is not None and starting != previous_ending:
            raise ValueError("inter-hand chip continuity mismatch")
        if first_start is None:
            first_start = starting
        previous_ending = ending
        chip_pool = sum(first_start)
        blind_values.add(bb)
        hero_delta = deltas[hero]
        net_chips += hero_delta
        blind_units += hero_delta / bb
        net_big_bets += hero_delta / (2 * bb)
        decisions = hand.get("decisions")
        public = hand.get("publicActionTrace")
        if (not isinstance(decisions, list) or not isinstance(public, list) or
                len(decisions) != len(public)):
            raise ValueError("decision/action trace length mismatch")
        if require_decision_ledger:
            ledgers = [_ledger(decision.get("ledger"), terminal=False,
                               hand_index=hand_index, decision_index=ordinal,
                               seat_count=seat_count, chip_pool=chip_pool)
                       for ordinal, decision in enumerate(decisions)]
            terminal_ledger = _ledger(hand.get("terminalLedger"), terminal=True,
                                      hand_index=hand_index,
                                      decision_index=len(decisions),
                                      seat_count=seat_count, chip_pool=chip_pool)
            if terminal_ledger["stacks"] != ending:
                raise ValueError("terminal decision ledger differs from hand settlement")
        hero_decisions = 0
        for ordinal, (decision, event) in enumerate(zip(decisions, public)):
            seat = decision.get("seat")
            phase = decision.get("phase")
            action = decision.get("actionIndex")
            mask = decision.get("legalMask")
            latency = _number(decision.get("elapsedMs"), "decision latency")
            if (type(seat) is not int or not 0 <= seat < seat_count or
                    phase not in ("BET", "DRAW") or type(action) is not int or
                    not isinstance(mask, list) or len(mask) != 6 or
                    any(value not in (0, 1) for value in mask) or
                    not 0 <= action < len(mask) or mask[action] != 1 or latency < 0):
                raise ValueError("illegal controller action or malformed decision")
            if event.get("seat") != seat or event.get("type") != f"{phase}_ACTION":
                raise ValueError("decision/public event mismatch")
            if require_decision_ledger and event.get("stackBefore") != ledgers[ordinal]["stacks"][seat]:
                raise ValueError("action stack differs from pre-decision ledger")
            if phase == "BET":
                amount = _number(event.get("amount"), "bet amount")
                before = _number(event.get("stackBefore"), "stack before")
                after = _number(event.get("stackAfter"), "stack after")
                # The final public event observes the settled snapshot: its
                # stackAfter can include the awarded pot. Earlier events must
                # show the immediate contribution exactly.
                expected_after = (ending[seat] if require_decision_ledger and
                                  ordinal == len(decisions) - 1 else before - amount)
                if (amount < 0 or amount > before or
                        not math.isclose(expected_after, after, abs_tol=1e-9)):
                    raise ValueError("illegal bet amount or stack transition")
            else:
                draw_count = event.get("drawCount")
                if (type(draw_count) is not int or not 0 <= draw_count <= 4 or
                        event.get("amount") != 0):
                    raise ValueError("illegal draw count")
            if require_decision_ledger and ordinal + 1 < len(ledgers):
                next_stacks = ledgers[ordinal + 1]["stacks"]
                amount = event.get("amount")
                if (type(amount) is not int or
                        next_stacks[seat] != ledgers[ordinal]["stacks"][seat] - amount or
                        any(next_stacks[other] != ledgers[ordinal]["stacks"][other]
                            for other in range(seat_count) if other != seat)):
                    raise ValueError("intermediate decision stack transition mismatch")
            if seat == hero:
                hero_decisions += 1
                requests += 1
                actions[f"{phase}:{action}"] += 1
                max_latency = max(max_latency, latency)
                if decision.get("status") == "used":
                    used += 1
                else:
                    fallback += 1
                if latency > deadline_ms:
                    raise ValueError("inference deadline exceeded")
            elif decision.get("status") != "opponent":
                raise ValueError("opponent decision status mismatch")
        no_decision_hands += hero_decisions == 0
    if (net_chips != session.get("chipDelta") or
            no_decision_hands != session.get("noHeroDecisionHands") or
            dict(actions) != session.get("heroActions") or
            not math.isclose(blind_units / count, session.get("chipBbPerHand"),
                             abs_tol=1e-8) or
            not math.isclose(net_chips / count, session.get("chipPerHand"),
                             abs_tol=1e-8)):
        raise ValueError("session summary and hand originals disagree")
    if requests == 0 or fallback != 0 or used != requests:
        raise ValueError("normal-flow model use is incomplete")
    if net_chips != previous_ending[hero] - first_start[hero]:
        raise ValueError("session hero chip ledger does not telescope")
    return {
        "sessionId": f"{seed}:{group}:{profile}:{hero}",
        "sessionIndex": index, "seed": seed, "heroSeat": hero,
        "cell": f"{group}|{profile}", "hands": count,
        "netBigBets": net_big_bets,
        "modelSha256": model_sha,
        "controllerContractSha256": contract_sha,
        "source": "real-controller", "chipBalanced": True,
        "illegalActions": 0, "fallbacks": fallback,
        "inferenceRequests": requests, "inferenceUsed": used,
        "maxInferenceMs": max_latency,
        "initialStacks": first_start,
        "finalStacks": previous_ending,
        "initialChipPool": sum(first_start),
        "activeBigBlindMin": min(blind_values),
        "activeBigBlindMax": max(blind_values),
        "modelIdentityAttestedByManifest": True,
        "frozenManifestAttested": frozen_manifest,
        "decisionLedgerAudited": require_decision_ledger,
    }


def audit_files(*, manifest_path: Path, session_path: Path, hand_path: Path,
                output_path: Path | None, report_path: Path, deadline_ms: float,
                diagnostic_sessions: int | None = None,
                session_start_index: int = 0) -> dict:
    if type(session_start_index) is not int or session_start_index < 0:
        raise ValueError("session start index must be nonnegative")
    partial_path = (output_path.with_name(output_path.name + ".partial")
                    if output_path is not None else None)
    if (report_path.exists() or
            (output_path is not None and
             (output_path.exists() or partial_path.exists()))):
        raise ValueError("report and output must be new paths")
    root = Path(__file__).resolve().parents[3]
    protected = (root / "public", root / "src" / "config" / "ai")
    for path in (report_path, output_path):
        if path is not None and any(path.resolve() == item or item in path.resolve().parents
                                    for item in protected):
            raise ValueError("diagnostic output cannot target public model/registry paths")
    if diagnostic_sessions is not None and (diagnostic_sessions < 1 or output_path is not None):
        raise ValueError("diagnostic mode requires a positive limit and no gate output")
    if diagnostic_sessions is None and output_path is None:
        raise ValueError("full conversion requires an output JSONL path")
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    model_sha = manifest.get("modelSha256")
    contract_sha = manifest.get("contractSha256")
    frozen_manifest = manifest.get("status") == "FROZEN"
    require_decision_ledger = manifest.get("requireDecisionLedger", False)
    if (not all(isinstance(x, str) and len(x) == 64 and
                all(c in "0123456789abcdef" for c in x)
                for x in (model_sha, contract_sha)) or
            type(require_decision_ledger) is not bool or
            not 0 < deadline_ms <= 60_000):
        raise ValueError("invalid frozen manifest or deadline")
    session_digest = hashlib.sha256()
    hand_digest = hashlib.sha256()
    cells = Counter()
    count = 0
    total_hands = 0
    max_latency = 0.0
    score_min = math.inf
    score_max = -math.inf
    if output_path is not None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    with session_path.open("rb") as sessions, hand_path.open("rb") as hands:
        output = partial_path.open("x") if partial_path is not None else None
        try:
            while True:
                if diagnostic_sessions is not None and count >= diagnostic_sessions:
                    break
                raw = sessions.readline()
                if not raw:
                    break
                session_digest.update(raw)
                try:
                    session = json.loads(raw)
                except json.JSONDecodeError as error:
                    raise ValueError("invalid session JSONL row") from error
                cell = f"{session.get('group')}|{session.get('profile')}"
                cells[cell] += 1
                row = audit_session(session, hands, hand_digest,
                                    model_sha=model_sha, contract_sha=contract_sha,
                                    deadline_ms=deadline_ms,
                                    index=session_start_index + cells[cell],
                                    require_decision_ledger=require_decision_ledger,
                                    frozen_manifest=frozen_manifest)
                score = 100 * row["netBigBets"] / row["hands"]
                score_min = min(score_min, score)
                score_max = max(score_max, score)
                max_latency = max(max_latency, row["maxInferenceMs"])
                count += 1
                total_hands += row["hands"]
                if output is not None:
                    output.write(json.dumps(row, separators=(",", ":")) + "\n")
            if diagnostic_sessions is None and hands.readline():
                raise ValueError("unmatched extra hand trace rows")
            if count == 0:
                raise ValueError("no sessions were audited")
        finally:
            if output is not None:
                output.close()
    report = {
        "schema": "mgx-d03-big-bet-trace-audit/v1",
        "adapterSha256": _file_sha256(Path(__file__)),
        "status": "DIAGNOSTIC_PREFIX_ONLY_NOT_GATE_INPUT" if diagnostic_sessions is not None
                  else "FULL_TRACE_UNIT_AUDIT_INPUT_ONLY" if frozen_manifest
                  else "DIAGNOSTIC_UNFROZEN_NOT_GATE_INPUT",
        "frozenManifestAttested": frozen_manifest,
        "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "modelSha256AttestedByManifest": model_sha,
        "controllerContractSha256AttestedByManifest": contract_sha,
        "codeGitShaAttestedByManifest": manifest.get("codeGitSha"),
        "sessionsRead": count, "handsRead": total_hands,
        "cellsRead": dict(cells),
        "scoreUnit": "big_bet_per_100_hands",
        "decisionLedgerRequired": require_decision_ledger,
        "observedScoreMin": score_min, "observedScoreMax": score_max,
        "maxHeroInferenceMs": max_latency,
        "sessionInputSha256" if diagnostic_sessions is None else
        "sessionConsumedPrefixSha256": session_digest.hexdigest(),
        "handInputSha256" if diagnostic_sessions is None else
        "handConsumedPrefixSha256": hand_digest.hexdigest(),
        "outputSha256": None,
        "limitations": "The manifest attests model identity; this trace alone does not verify ONNX body bytes, every intermediate controller ledger transition, or fresh holdout status. Observed score extrema are not true score bounds.",
    }
    if output_path is not None:
        partial_path.replace(output_path)
        report["outputSha256"] = _file_sha256(output_path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("x") as stream:
        json.dump(report, stream, indent=2, sort_keys=True)
        stream.write("\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--sessions", type=Path, required=True)
    parser.add_argument("--hands", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--deadline-ms", type=float, default=8000)
    parser.add_argument("--diagnostic-sessions", type=int)
    parser.add_argument("--session-start-index", type=int, default=0)
    args = parser.parse_args()
    result = audit_files(
        manifest_path=args.manifest, session_path=args.sessions,
        hand_path=args.hands, output_path=args.output, report_path=args.report,
        deadline_ms=args.deadline_ms, diagnostic_sessions=args.diagnostic_sessions,
        session_start_index=args.session_start_index)
    print(json.dumps({key: result[key] for key in
                      ("status", "sessionsRead", "handsRead", "observedScoreMin",
                       "observedScoreMax")}))


if __name__ == "__main__":
    main()
