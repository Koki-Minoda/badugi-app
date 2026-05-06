"""Build and validate the 10-Game Beginner/Standard RL rollout plan.

This tool is intentionally a planning and safety gate, not a blind long-running
trainer. 10-Game CPUs should only be retrained after the per-variant command,
model routing, action mask, reward source, and short evaluation gate are known.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[3]
MODEL_REGISTRY_PATH = PROJECT_ROOT / "src/config/ai/modelRegistry.json"
VARIANT_CATALOG_PATH = PROJECT_ROOT / "src/games/config/multiGameList.json"
PRO_PRESETS_PATH = PROJECT_ROOT / "src/config/mixed/proPresets.js"

TEN_GAME_VARIANT_IDS = ["B01", "B02", "B06", "ST3", "ST1", "ST2", "D01", "B05", "D03", "S01"]
TIERS = ["beginner", "standard"]


@dataclass(frozen=True)
class RlFamilyPlan:
    family: str
    feature_set: str
    input_shape: int
    output_shape: int
    reward_source: str
    action_mask_source: str
    dataset_source: str
    short_eval_gate: str
    train_command_template: str | None
    eval_command_template: str | None
    long_run_command_template: str | None
    notes: str


FAMILY_PLANS: dict[str, RlFamilyPlan] = {
    "board:nlh": RlFamilyPlan(
        family="board:nlh",
        feature_set="board-betting-observation-v1",
        input_shape=16,
        output_shape=6,
        reward_source="BoardBettingEnv / BoardLongHorizonEnv EV-shaped reward",
        action_mask_source="BoardBettingEnv.legal_action_mask()",
        dataset_source="synthetic board fixtures + future hand-history EV gate",
        short_eval_gate="evaluate_board_onnx.py --advanced-gate",
        train_command_template=(
            "npm run ai:train-board -- --family nlh --tier {tier} --episodes {episodes} "
            "--long-horizon --max-steps 12 --teacher-warmup-episodes 800 "
            "--imitation-pretrain-steps 250 --fixture-replay-copies 120"
        ),
        eval_command_template=(
            "npm run ai:evaluate-board-onnx -- --model public/models/nlh_{tier}_dqn_v1.onnx "
            "--variant-id B01 --advanced-gate"
        ),
        long_run_command_template=(
            "npm run ai:train-board -- --family nlh --tier {tier} --episodes 50000 "
            "--long-horizon --max-steps 16 --teacher-warmup-episodes 3000 "
            "--imitation-pretrain-steps 1000 --fixture-replay-copies 300"
        ),
        notes="NLH needs real-log position/showdown EV before Pro promotion.",
    ),
    "board:flh": RlFamilyPlan(
        family="board:flh",
        feature_set="board-betting-observation-v1",
        input_shape=16,
        output_shape=6,
        reward_source="BoardBettingEnv fixed-limit reward",
        action_mask_source="BoardBettingEnv.legal_action_mask() with cap pressure",
        dataset_source="synthetic board fixtures + fixed-limit cap history gate",
        short_eval_gate="evaluate_board_onnx.py --advanced-gate",
        train_command_template=(
            "npm run ai:train-board -- --family flh --tier {tier} --episodes {episodes} "
            "--long-horizon --max-steps 12 --teacher-warmup-episodes 800 "
            "--imitation-pretrain-steps 250 --fixture-replay-copies 120"
        ),
        eval_command_template=(
            "npm run ai:evaluate-board-onnx -- --model public/models/flh_{tier}_dqn_v1.onnx "
            "--variant-id B02 --advanced-gate"
        ),
        long_run_command_template=(
            "npm run ai:train-board -- --family flh --tier {tier} --episodes 50000 "
            "--long-horizon --max-steps 16 --teacher-warmup-episodes 3000 "
            "--imitation-pretrain-steps 1000 --fixture-replay-copies 300"
        ),
        notes="FLH must retain cap/crying-call fixtures.",
    ),
    "board:plo": RlFamilyPlan(
        family="board:plo",
        feature_set="board-betting-observation-v1",
        input_shape=16,
        output_shape=6,
        reward_source="BoardBettingEnv PLO equity / multiway isolation reward",
        action_mask_source="BoardBettingEnv.legal_action_mask()",
        dataset_source="synthetic PLO fixtures + blocker/SPR real-log gate",
        short_eval_gate="evaluate_board_onnx.py --advanced-gate",
        train_command_template=(
            "npm run ai:train-board -- --family plo --tier {tier} --episodes {episodes} "
            "--long-horizon --max-steps 12 --teacher-warmup-episodes 800 "
            "--imitation-pretrain-steps 250 --fixture-replay-copies 120"
        ),
        eval_command_template=(
            "npm run ai:evaluate-board-onnx -- --model public/models/plo_{tier}_dqn_v1.onnx "
            "--variant-id B05 --advanced-gate"
        ),
        long_run_command_template=(
            "npm run ai:train-board -- --family plo --tier {tier} --episodes 50000 "
            "--long-horizon --max-steps 16 --teacher-warmup-episodes 3000 "
            "--imitation-pretrain-steps 1000 --fixture-replay-copies 300"
        ),
        notes="PLO needs multiway isolation and side-pot EV gates before stronger tiers.",
    ),
    "board:plo8": RlFamilyPlan(
        family="board:plo8",
        feature_set="board-betting-observation-v1",
        input_shape=16,
        output_shape=6,
        reward_source="BoardBettingEnv PLO8 scoop/no-low reward",
        action_mask_source="BoardBettingEnv.legal_action_mask()",
        dataset_source="synthetic PLO8 fixtures + split/quartering real-log gate",
        short_eval_gate="evaluate_board_onnx.py --advanced-gate",
        train_command_template=(
            "npm run ai:train-board -- --family plo8 --tier {tier} --episodes {episodes} "
            "--long-horizon --max-steps 12 --teacher-warmup-episodes 800 "
            "--imitation-pretrain-steps 250 --fixture-replay-copies 120"
        ),
        eval_command_template=(
            "npm run ai:evaluate-board-onnx -- --model public/models/plo8_{tier}_dqn_v1.onnx "
            "--variant-id B06 --advanced-gate"
        ),
        long_run_command_template=(
            "npm run ai:train-board -- --family plo8 --tier {tier} --episodes 50000 "
            "--long-horizon --max-steps 16 --teacher-warmup-episodes 3000 "
            "--imitation-pretrain-steps 1000 --fixture-replay-copies 300"
        ),
        notes="PLO8 must preserve scoop/no-low and quartering reward gates.",
    ),
    "draw:low-27:triple": RlFamilyPlan(
        family="draw:low-27:triple",
        feature_set="draw-lowball-observation-v1",
        input_shape=96,
        output_shape=11,
        reward_source="DrawLowballEnv low-27 reward",
        action_mask_source="DrawLowballEnv.legal_action_mask()",
        dataset_source="96-slot draw transition dataset, maxDraws=3",
        short_eval_gate="evaluate_draw_onnx.py fixture gate for D01",
        train_command_template=(
            "npm run ai:train-draw -- --family low-27 --max-draws 3 --episodes {episodes} "
            "--teacher-warmup-episodes 1000 --imitation-pretrain-steps 300 --fixture-replay-copies 80"
        ),
        eval_command_template=(
            "npm run ai:evaluate-draw-onnx -- --model public/models/27draw_{tier}_dqn_v1.onnx "
            "--variant-id D01"
        ),
        long_run_command_template=(
            "npm run ai:train-draw -- --family low-27 --max-draws 3 --episodes 50000 "
            "--teacher-warmup-episodes 5000 --imitation-pretrain-steps 1500 --fixture-replay-copies 250"
        ),
        notes="Shared model family with S01; evaluate both triple and single draw gates.",
    ),
    "draw:low-27:single": RlFamilyPlan(
        family="draw:low-27:single",
        feature_set="draw-lowball-observation-v1",
        input_shape=96,
        output_shape=11,
        reward_source="DrawLowballEnv low-27 reward",
        action_mask_source="DrawLowballEnv.legal_action_mask()",
        dataset_source="96-slot draw transition dataset, maxDraws=1",
        short_eval_gate="evaluate_draw_onnx.py fixture gate for S01",
        train_command_template=(
            "npm run ai:train-draw -- --family low-27 --max-draws 1 --episodes {episodes} "
            "--teacher-warmup-episodes 1000 --imitation-pretrain-steps 300 --fixture-replay-copies 80"
        ),
        eval_command_template=(
            "npm run ai:evaluate-draw-onnx -- --model public/models/27draw_{tier}_dqn_v1.onnx "
            "--variant-id S01"
        ),
        long_run_command_template=(
            "npm run ai:train-draw -- --family low-27 --max-draws 1 --episodes 50000 "
            "--teacher-warmup-episodes 5000 --imitation-pretrain-steps 1500 --fixture-replay-copies 250"
        ),
        notes="S01 can route shared low-27 ONNX, but long-run training should gate single-draw separately.",
    ),
    "badugi": RlFamilyPlan(
        family="badugi",
        feature_set="badugi-observation-v1-ev-range",
        input_shape=96,
        output_shape=6,
        reward_source="BadugiEnv EV/range shaped reward",
        action_mask_source="BadugiEnv.legal_action_mask()",
        dataset_source="Badugi 96-dim transition dataset + human/practice benchmark",
        short_eval_gate="evaluate_badugi_onnx.py 6-max practice gate",
        train_command_template=(
            "npm run ai:train-badugi -- --episodes {episodes} --max-steps 200 --table-size 6 "
            "--teacher-warmup-episodes 10000 --imitation-pretrain-steps 1000 "
            "--profitable-continue-replay-ratio 0.25 --first-in-value-bet-replay-ratio 0.25"
        ),
        eval_command_template=(
            "npm run ai:evaluate-badugi-onnx -- --model public/models/badugi_standard_dqn_v3.onnx "
            "--episodes 500 --max-steps 200 --table-size 6 --feature-set badugi-observation-v1-ev-range"
        ),
        long_run_command_template=(
            "npm run ai:train-badugi -- --episodes 50000 --max-steps 200 --table-size 6 "
            "--teacher-warmup-episodes 10000 --imitation-pretrain-steps 1500 "
            "--profitable-continue-replay-ratio 0.25 --first-in-value-bet-replay-ratio 0.25"
        ),
        notes="Beginner remains generic until a current-env beginner model clears the same safety gates.",
    ),
    "stud:stud": RlFamilyPlan(
        family="stud:stud",
        feature_set="stud-betting-observation-v1",
        input_shape=16,
        output_shape=6,
        reward_source="StudBettingEnv high-hand reward",
        action_mask_source="StudBettingEnv.legal_action_mask()",
        dataset_source="synthetic Stud fixture dataset + future bring-in/complete real logs",
        short_eval_gate="evaluate_stud_onnx.py fixture gate for ST1",
        train_command_template=(
            "npm run ai:train-stud -- --family stud --tier {tier} --episodes {episodes} "
            "--teacher-warmup-episodes 600 --imitation-pretrain-steps 160 --fixture-replay-copies 100"
        ),
        eval_command_template=(
            "npm run ai:evaluate-stud-onnx -- --model public/models/stud_{tier}_dqn_v1.onnx "
            "--variant-id ST1"
        ),
        long_run_command_template=(
            "npm run ai:train-stud -- --family stud --tier {tier} --episodes 50000 "
            "--teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300"
        ),
        notes="Stud long RL is blocked from higher tiers until UI/controller street E2E remains stable.",
    ),
    "stud:stud8": RlFamilyPlan(
        family="stud:stud8",
        feature_set="stud-betting-observation-v1",
        input_shape=16,
        output_shape=6,
        reward_source="StudBettingEnv Stud8 scoop/split reward",
        action_mask_source="StudBettingEnv.legal_action_mask()",
        dataset_source="synthetic Stud8 fixture dataset + future split/quartering logs",
        short_eval_gate="evaluate_stud_onnx.py fixture gate for ST2",
        train_command_template=(
            "npm run ai:train-stud -- --family stud8 --tier {tier} --episodes {episodes} "
            "--teacher-warmup-episodes 600 --imitation-pretrain-steps 160 --fixture-replay-copies 100"
        ),
        eval_command_template=(
            "npm run ai:evaluate-stud-onnx -- --model public/models/stud8_{tier}_dqn_v1.onnx "
            "--variant-id ST2"
        ),
        long_run_command_template=(
            "npm run ai:train-stud -- --family stud8 --tier {tier} --episodes 50000 "
            "--teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300"
        ),
        notes="Stud8 needs odd-chip and split-pot EV gates before stronger tiers.",
    ),
    "stud:razz": RlFamilyPlan(
        family="stud:razz",
        feature_set="stud-betting-observation-v1",
        input_shape=16,
        output_shape=6,
        reward_source="StudBettingEnv Razz low reward",
        action_mask_source="StudBettingEnv.legal_action_mask()",
        dataset_source="synthetic Razz fixture dataset + future low-board real logs",
        short_eval_gate="evaluate_stud_onnx.py fixture gate for ST3",
        train_command_template=(
            "npm run ai:train-stud -- --family razz --tier {tier} --episodes {episodes} "
            "--teacher-warmup-episodes 600 --imitation-pretrain-steps 160 --fixture-replay-copies 100"
        ),
        eval_command_template=(
            "npm run ai:evaluate-stud-onnx -- --model public/models/razz_{tier}_dqn_v1.onnx "
            "--variant-id ST3"
        ),
        long_run_command_template=(
            "npm run ai:train-stud -- --family razz --tier {tier} --episodes 50000 "
            "--teacher-warmup-episodes 5000 --imitation-pretrain-steps 1200 --fixture-replay-copies 300"
        ),
        notes="Razz needs complete/low-board pressure hand-history gates before stronger tiers.",
    ),
}


VARIANT_FAMILIES = {
    "B01": "board:nlh",
    "B02": "board:flh",
    "B05": "board:plo",
    "B06": "board:plo8",
    "D01": "draw:low-27:triple",
    "D03": "badugi",
    "S01": "draw:low-27:single",
    "ST1": "stud:stud",
    "ST2": "stud:stud8",
    "ST3": "stud:razz",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_model_registry() -> list[dict[str, Any]]:
    return load_json(MODEL_REGISTRY_PATH)


def load_variants() -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in load_json(VARIANT_CATALOG_PATH)}


def model_asset_exists(entry: dict[str, Any]) -> bool:
    onnx = entry.get("onnx")
    if not onnx:
        return False
    return (PROJECT_ROOT / "public" / onnx).exists()


def find_tier_model(registry: list[dict[str, Any]], variant_id: str, tier: str) -> dict[str, Any] | None:
    for entry in registry:
        if (
            variant_id in entry.get("variantIds", [])
            and entry.get("tier") == tier
            and not entry.get("characterIds")
            and entry.get("trainingStatus") != "legacy"
        ):
            return entry
    return None


def generic_fallback_model(registry: list[dict[str, Any]], tier: str) -> dict[str, Any] | None:
    # Tier config maps Beginner to model-generic-v1 today. Treat that as an
    # explicit safe-policy fallback when a variant-specific Beginner model is
    # intentionally withheld.
    if tier == "beginner":
        for entry in registry:
            if entry.get("id") == "model-generic-v1":
                return entry
    for entry in registry:
        if (
            entry.get("tier") == tier
            and not entry.get("variantIds")
            and not entry.get("characterIds")
            and entry.get("trainingStatus") != "legacy"
        ):
            return entry
    return None


def shape_matches(entry: dict[str, Any] | None, plan: RlFamilyPlan) -> bool:
    if not entry:
        return False
    return entry.get("inputShape") == [plan.input_shape] and entry.get("outputShape") == [plan.output_shape]


def build_variant_plan(short_episodes: int = 2_000) -> dict[str, Any]:
    registry = load_model_registry()
    variants = load_variants()
    rows = []
    blocking_issues = []

    for variant_id in TEN_GAME_VARIANT_IDS:
        variant = variants.get(variant_id)
        family_key = VARIANT_FAMILIES[variant_id]
        family = FAMILY_PLANS[family_key]
        tier_rows = []
        for tier in TIERS:
            entry = find_tier_model(registry, variant_id, tier)
            fallback = None
            route_status = "variant-model"
            if entry is None:
                fallback = generic_fallback_model(registry, tier)
                route_status = "generic-fallback" if fallback else "missing"
            selected = entry or fallback
            asset_exists = model_asset_exists(selected) if selected else False
            expected_shape = shape_matches(selected, family)
            fallback_allowed = variant_id == "D03" and tier == "beginner" and route_status == "generic-fallback"
            route_ok = bool(selected and ((asset_exists and expected_shape) or fallback_allowed))
            if not route_ok:
                blocking_issues.append(
                    {
                        "variantId": variant_id,
                        "tier": tier,
                        "issue": "missing_or_shape_mismatched_model_route",
                        "routeStatus": route_status,
                        "modelId": selected.get("id") if selected else None,
                    }
                )
            tier_rows.append(
                {
                    "tier": tier,
                    "routeStatus": route_status,
                    "modelId": selected.get("id") if selected else None,
                    "trainingStatus": selected.get("trainingStatus") if selected else None,
                    "assetExists": asset_exists,
                    "shapeMatchesFamily": expected_shape,
                    "fallbackAllowed": fallback_allowed,
                    "routeOk": route_ok,
                    "trainCommand": family.train_command_template.format(tier=tier, episodes=short_episodes)
                    if family.train_command_template
                    else None,
                    "shortEvalCommand": family.eval_command_template.format(tier=tier)
                    if family.eval_command_template
                    else None,
                    "longRunCommand": family.long_run_command_template.format(tier=tier)
                    if family.long_run_command_template
                    else None,
                }
            )
        rows.append(
            {
                "variantId": variant_id,
                "name": variant.get("name") if variant else None,
                "engineKey": variant.get("engineKey") if variant else None,
                "status": variant.get("status") if variant else None,
                "family": family.family,
                "featureSet": family.feature_set,
                "inputShape": family.input_shape,
                "outputShape": family.output_shape,
                "rewardSource": family.reward_source,
                "actionMaskSource": family.action_mask_source,
                "datasetSource": family.dataset_source,
                "shortEvalGate": family.short_eval_gate,
                "notes": family.notes,
                "tiers": tier_rows,
            }
        )

    return {
        "rotation": TEN_GAME_VARIANT_IDS,
        "shortEpisodes": short_episodes,
        "variants": rows,
        "blockingIssues": blocking_issues,
        "summary": {
            "targetVariants": len(TEN_GAME_VARIANT_IDS),
            "tierRoutes": len(TEN_GAME_VARIANT_IDS) * len(TIERS),
            "routeOk": sum(1 for row in rows for tier in row["tiers"] if tier["routeOk"]),
            "blockingIssueCount": len(blocking_issues),
            "longRlReady": len(blocking_issues) == 0,
        },
    }


def render_markdown(plan: dict[str, Any]) -> str:
    lines = [
        "# MGX 10-Game RL Readiness Report",
        "",
        "Date: 2026-05-06",
        "",
        "This report validates the Beginner/Standard RL rollout surface for the fixed 10-Game rotation. It does not claim Pro/Iron strength; long runs must still pass progression, EV, RL-safety, and human/practice gates before model promotion.",
        "",
        "## Summary",
        "",
        "| Item | Value |",
        "|---|---:|",
        f"| Target variants | {plan['summary']['targetVariants']} |",
        f"| Tier routes | {plan['summary']['tierRoutes']} |",
        f"| Route OK | {plan['summary']['routeOk']} |",
        f"| Blocking issues | {plan['summary']['blockingIssueCount']} |",
        f"| Long RL ready | {'YES' if plan['summary']['longRlReady'] else 'NO'} |",
        "",
        "## Variant Dataset / Reward / Action Mask Plan",
        "",
        "| Variant | Family | Feature | Reward Source | Action Mask | Dataset | Short Gate | Notes |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for row in plan["variants"]:
        lines.append(
            "| `{variantId}` {name} | {family} | {featureSet} `{inputShape}->{outputShape}` | {rewardSource} | {actionMaskSource} | {datasetSource} | {shortEvalGate} | {notes} |".format(
                **row
            )
        )
    lines.extend(
        [
            "",
            "## Beginner / Standard Routing",
            "",
            "| Variant | Tier | Route | Model | Status | Asset | Shape | Short Eval | Long Run Entry |",
            "|---|---|---|---|---|---|---|---|---|",
        ]
    )
    for row in plan["variants"]:
        for tier in row["tiers"]:
            lines.append(
                "| `{variant}` | {tier} | {route} | `{model}` | {status} | {asset} | {shape} | `{eval}` | `{long}` |".format(
                    variant=row["variantId"],
                    tier=tier["tier"],
                    route=tier["routeStatus"],
                    model=tier["modelId"] or "-",
                    status=tier["trainingStatus"] or "-",
                    asset="OK" if tier["assetExists"] else ("POLICY" if tier["fallbackAllowed"] else "MISSING"),
                    shape="OK" if tier["shapeMatchesFamily"] or tier["fallbackAllowed"] else "MISMATCH",
                    eval=tier["shortEvalCommand"] or "-",
                    long=tier["longRunCommand"] or "-",
                )
            )
    lines.extend(["", "## Blocking Issues", ""])
    if plan["blockingIssues"]:
        lines.extend(["| Variant | Tier | Issue | Route | Model |", "|---|---|---|---|---|"])
        for issue in plan["blockingIssues"]:
            lines.append(
                f"| `{issue['variantId']}` | {issue['tier']} | {issue['issue']} | {issue['routeStatus']} | `{issue['modelId'] or '-'}` |"
            )
    else:
        lines.append("No blocking model-route issues detected for Beginner/Standard.")
    lines.extend(
        [
            "",
            "## Required Gate Order",
            "",
            "1. `npm run test:mgx:safety`",
            "2. `npm run ai:plan-10game-rl -- --report docs/testing/MGX_10GAME_RL_READINESS_REPORT.md`",
            "3. Run each variant's short evaluation command from the table.",
            "4. Only then run the long-run command for the same variant/tier.",
            "5. Export ONNX, update checksums, run `npm run ai:verify-models`, and rerun `npm run test:rl:safety` before routing stronger tiers.",
            "",
            "## Decision",
            "",
            "- Beginner/Standard rollout surface: " + ("READY" if plan["summary"]["longRlReady"] else "BLOCKED"),
            "- Stronger than Standard: NOT granted by this report.",
            "- Badugi Beginner: generic fallback remains allowed until a current-env beginner DQN clears the same gates.",
            "",
        ]
    )
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate and render the 10-Game RL rollout plan.")
    parser.add_argument("--short-episodes", type=int, default=2_000)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--report", default=None)
    parser.add_argument("--fail-on-blocking", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plan = build_variant_plan(short_episodes=args.short_episodes)
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(render_markdown(plan), encoding="utf8")
    if args.json:
        print(json.dumps(plan, indent=2))
    else:
        print(
            "10-Game RL plan: "
            f"{plan['summary']['routeOk']}/{plan['summary']['tierRoutes']} tier routes OK; "
            f"blocking={plan['summary']['blockingIssueCount']}"
        )
    if args.fail_on_blocking and plan["blockingIssues"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
