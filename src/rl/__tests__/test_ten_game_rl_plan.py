from rl.training.ten_game_rl_plan import (
    TEN_GAME_VARIANT_IDS,
    TIERS,
    build_variant_plan,
    load_fixed_ten_game_preset_ids,
)


def test_ten_game_plan_covers_fixed_rotation_and_tiers():
    plan = build_variant_plan(short_episodes=200)

    assert plan["rotation"] == ["B01", "B02", "B09", "ST3", "ST1", "ST2", "D01", "B05", "D03", "S01"]
    assert plan["rotation"] == load_fixed_ten_game_preset_ids()
    assert plan["summary"]["targetVariants"] == 10
    assert plan["summary"]["tierRoutes"] == len(TEN_GAME_VARIANT_IDS) * len(TIERS)

    by_variant = {row["variantId"]: row for row in plan["variants"]}
    assert set(by_variant) == set(TEN_GAME_VARIANT_IDS)

    for variant_id, row in by_variant.items():
        assert row["rewardSource"]
        assert row["actionMaskSource"]
        assert row["datasetSource"]
        assert row["shortEvalGate"]
        assert len(row["tiers"]) == 2
        for tier in row["tiers"]:
            assert tier["tier"] in TIERS
            if variant_id == "B09":
                assert tier["trainCommand"] is None
                assert tier["shortEvalCommand"] is None
                assert tier["longRunCommand"] is None
            else:
                assert tier["trainCommand"]
                assert tier["shortEvalCommand"]
                assert tier["longRunCommand"]


def test_ten_game_beginner_standard_routes_are_explicit_and_safe():
    plan = build_variant_plan(short_episodes=200)

    assert plan["summary"]["blockingIssueCount"] == 2
    assert plan["summary"]["routeOk"] == plan["summary"]["tierRoutes"] - 2
    assert {issue["variantId"] for issue in plan["blockingIssues"]} == {"B09"}

    badugi = next(row for row in plan["variants"] if row["variantId"] == "D03")
    badugi_beginner = next(tier for tier in badugi["tiers"] if tier["tier"] == "beginner")
    badugi_standard = next(tier for tier in badugi["tiers"] if tier["tier"] == "standard")

    assert badugi_beginner["routeStatus"] == "variant-model"
    assert badugi_beginner["modelId"] == "model-badugi-sixmax-standard-dqn-v2"
    assert badugi_beginner["fallbackAllowed"] is False
    assert badugi_standard["modelId"] == "model-badugi-sixmax-standard-e11"

    for row in plan["variants"]:
        if row["variantId"] in {"D03", "B09"}:
            continue
        for tier in row["tiers"]:
            assert tier["routeStatus"] == "variant-model"
            assert tier["assetExists"] is True
            assert tier["shapeMatchesFamily"] is True


def test_static_assets_cannot_approve_long_training():
    plan = build_variant_plan(short_episodes=200)
    assert plan['summary']['routeOk'] == plan['summary']['tierRoutes'] - 2
    assert plan['summary']['longRlReady'] is False
    assert plan['assessmentScope'] == 'static-registry-assets-and-dimensions'
    assert set(plan['longRlEvidenceRequired']) == {
        'game-semantics-and-reward-parity',
        'runtime-observation-and-action-parity',
        'preregistered-evaluation-and-stop-conditions',
        'approved-storage-and-single-job-budget',
    }
